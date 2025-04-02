<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\AIController;
use App\Http\Controllers\ResumeController;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/chat', [AIController::class, 'index'])->name('chat.index');
    Route::post('/chat/generate', [AIController::class, 'generate'])->name('chat.generate');

    Route::get('/resume-chat', [ResumeController::class, 'index'])->name('resume.chat');
    Route::post('/resume/upload', [ResumeController::class, 'upload'])->name('resume.upload');
    Route::post('/resume/generate', [ResumeController::class, 'generate'])->name('resume.generate');

});

require __DIR__.'/auth.php';
