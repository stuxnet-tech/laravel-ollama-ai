<?php

namespace App\Http\Controllers;

use App\Services\OllamaApiService;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AIController extends Controller
{
    protected OllamaApiService $ollamaApiService;

    public function __construct(OllamaApiService $ollamaApiService)
    {
        $this->ollamaApiService = $ollamaApiService;
    }

    public function index()
    {
        return Inertia::render('Chat/Index');
    }

    public function generate(Request $request)
    {
        $prompt = $request->input('prompt', '');
        
        return response()->stream(function () use ($prompt) {
            try {
                $stream = $this->ollamaApiService->streamGenerate($prompt);
                
                while (!$stream->eof()) {
                    $chunk = $stream->read(10);
                    if (!empty(trim($chunk))) {
                        echo $chunk;
                        ob_flush();
                        flush();
                    }
                }
                
                $stream->close();
            } catch (\Exception $e) {
                echo json_encode(['error' => $e->getMessage()]);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}



