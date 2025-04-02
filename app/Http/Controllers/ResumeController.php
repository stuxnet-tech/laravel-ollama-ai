<?php

namespace App\Http\Controllers;

use App\Services\OllamaApiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class ResumeController extends Controller
{
    protected $ollamaApiService;

    public function __construct(OllamaApiService $ollamaApiService)
    {
        $this->ollamaApiService = $ollamaApiService;
    }

    public function index()
    {
        return Inertia::render('ResumeChat/Index');
    }

    public function upload(Request $request)
    {
        try {
            $request->validate([
                'resume' => [
                    'required',
                    'file',
                    function ($attribute, $value, $fail) {
                        $allowedMimes = [
                            'application/pdf',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'text/plain'
                        ];
                        
                        if (!in_array($value->getMimeType(), $allowedMimes)) {
                            $fail('Only PDF, DOC, DOCX, and TXT files are allowed.');
                        }
                    },
                    'max:2048'
                ]
            ]);
    
            $file = $request->file('resume');
            
            $content = $this->extractTextFromFile($file->getRealPath(), 5, 5000);
            
            $request->session()->put('resume_content', $content);
    
            return response()->json([
                'success' => true,
                'message' => 'Resume processed successfully',
                'file_type' => $file->getMimeType(),
                'content_length' => strlen($content),
                'truncated' => strlen($content) >= 5000
            ]);
    
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error processing file: ' . $e->getMessage(),
                'uploaded_file' => [
                    'original_name' => $request->file('resume')->getClientOriginalName(),
                    'temp_path' => $request->file('resume')->getRealPath(),
                    'mime_type' => $request->file('resume')->getMimeType(),
                    'size' => $request->file('resume')->getSize()
                ]
            ], 500);
        }
    }

    public function generate(Request $request)
    {
        if (ob_get_level()) {
            ob_end_clean();
        }
        
        $resumeContent = $request->session()->get('resume_content');
        $prompt = $request->input('prompt', '');

        if (empty($resumeContent)) {
            return response()->json(['error' => 'No resume content found'], 400);
        }

        $fullPrompt = "Based on the following resume:\n\n$resumeContent\n\nAnswer this question: $prompt";

        $headers = [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ];

        return response()->stream(function () use ($fullPrompt) {
            try {
                $stream = $this->ollamaApiService->streamGenerate($fullPrompt);
                
                $buffer = '';
                
                while (!$stream->eof()) {
                    $chunk = $stream->read(1024);
                    
                    if ($chunk === false) {
                        usleep(100000);
                        continue;
                    }
                    
                    $buffer .= $chunk;
                    
                    while (($newlinePos = strpos($buffer, "\n")) !== false) {
                        $line = substr($buffer, 0, $newlinePos);
                        $buffer = substr($buffer, $newlinePos + 1);
                        
                        if (empty(trim($line))) continue;
                        
                        try {
                            $data = json_decode($line, true);
                            
                            if (isset($data['response'])) {
                                echo "data: " . json_encode(['content' => $data['response']]) . "\n\n";
                            }
                        } catch (\Exception $e) {
                            echo "data: " . json_encode(['content' => $line]) . "\n\n";
                        }
                        
                        if (ob_get_level()) {
                            ob_flush();
                        }
                        flush();
                        
                        if (connection_aborted()) {
                            $stream->close();
                            exit;
                        }
                    }
                }
                
                echo "data: [DONE]\n\n";
                if (ob_get_level()) {
                    ob_flush();
                }
                flush();
                
            } catch (\Exception $e) {
                echo "data: " . json_encode(['error' => $e->getMessage()]) . "\n\n";
                if (ob_get_level()) {
                    ob_flush();
                }
                flush();
            }
        }, 200, $headers);
    }

private function extractTextFromFile($path, $pageLimit = null, $charLimit = null)
{
    $originalExtension = pathinfo($path, PATHINFO_EXTENSION);
    
    $fileExtension = ($originalExtension === 'tmp') 
        ? $this->detectFileExtension($path)
        : $originalExtension;

    $content = '';

    switch (strtolower($fileExtension)) {
        case 'pdf':
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($path);
            $pages = $pdf->getPages();
            
            foreach (array_slice($pages, 0, $pageLimit) as $page) {
                $content .= $page->getText();
                if ($charLimit && strlen($content) >= $charLimit) {
                    return substr($content, 0, $charLimit);
                }
            }
            break;

        case 'doc':
        case 'docx':
            $content = $this->extractTextFromDoc($path);
            break;

        case 'txt':
            case 'tmp':
            $content = file_get_contents($path);
            break;

        default:
            throw new \Exception("Unsupported file type: $fileExtension");
    }

    return $charLimit ? substr($content, 0, $charLimit) : $content;
}

private function detectFileExtension($filePath)
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $filePath);
    finfo_close($finfo);

    $mimeMap = [
        'application/pdf' => 'pdf',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'text/plain' => 'txt',
        'application/octet-stream' => 'txt'
    ];

    return $mimeMap[$mime] ?? 'tmp';
}

private function extractTextFromDoc($path)
{
    $phpWord = \PhpOffice\PhpWord\IOFactory::load($path);
    $sections = $phpWord->getSections();
    $text = '';
    
    foreach ($sections as $section) {
        $elements = $section->getElements();
        foreach ($elements as $element) {
            if ($element instanceof \PhpOffice\PhpWord\Element\TextRun) {
                foreach ($element->getElements() as $textElement) {
                    if ($textElement instanceof \PhpOffice\PhpWord\Element\Text) {
                        $text .= $textElement->getText();
                    }
                }
            } elseif ($element instanceof \PhpOffice\PhpWord\Element\Text) {
                $text .= $element->getText();
            }
        }
    }
    
    return $text;
}
}