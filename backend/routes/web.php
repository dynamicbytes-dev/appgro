<?php

use App\Http\Controllers\AppConfigController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/config', [AppConfigController::class, 'index']);
Route::get('/metadata', [AppConfigController::class, 'index']);

