<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class OllamaApiService
{
    protected string $url;

    public function __construct()
    {
        $this->url = env('OLLAMA_API_URL', 'http://localhost:11434');
    }

    public function streamGenerate(string $prompt, string $model = 'llama2')
    {
        $response = Http::withOptions([
            'stream' => true,  
            'timeout' => 0,    
        ])->post("{$this->url}/api/generate", [
            'model' => $model,
            'prompt' => $prompt,
            'stream' => true,  
        ]);

        if ($response->failed()) {
            throw new \Exception('Failed to connect to Ollama API.');
        }

        return $response->toPsrResponse()->getBody();
    }
}




