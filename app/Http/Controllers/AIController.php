<?php

namespace App\Http\Controllers;

use App\Services\OllamaApiService;
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
        $prompt = $request->input('prompt', $request->prompt);
        $response = $this->ollamaApiService->generate($request->prompt);

        return response()->json(['response' => $response]);
    }
}

