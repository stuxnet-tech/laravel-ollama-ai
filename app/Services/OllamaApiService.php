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

    public function generate(string $prompt, string $model = 'llama2')
    {
        $response = Http::post("{$this->url}/api/generate", [
            'model' => $model,
            'prompt' => $prompt,
            'stream' => false,
        ]);
        if ($response->failed()) {
            return 'Failed to generate response.';
        }

        return $response->json()['response'] ?? 'No response.';
    }
}


