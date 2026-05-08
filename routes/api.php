<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomFoodController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FoodLogController;
use App\Http\Controllers\Api\FoodSearchController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\WaterLogController;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::prefix('auth')->group(function () {
    Route::post('/register',       [AuthController::class, 'register']);
    Route::post('/login',          [AuthController::class, 'login']);
    Route::post('/forgot-password',[AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout',          [AuthController::class, 'logout']);
        Route::get('/user',             [AuthController::class, 'user']);
        Route::put('/user',             [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
        Route::post('/avatar',          [AuthController::class, 'uploadAvatar']);
    });

    // Onboarding
    Route::post('/onboarding', [OnboardingController::class, 'store']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Food search
    Route::prefix('food')->group(function () {
        Route::get('/search',           [FoodSearchController::class, 'search']);
        Route::get('/barcode/{barcode}',[FoodSearchController::class, 'barcode']);
        Route::get('/recent',           [FoodLogController::class,    'recent']);
        Route::post('/custom',          [CustomFoodController::class,  'store']);
        Route::get('/custom',           [CustomFoodController::class,  'index']);
    });

    // Food log
    Route::prefix('food-log')->group(function () {
        Route::get('/',          [FoodLogController::class, 'index']);
        Route::post('/',         [FoodLogController::class, 'store']);
        Route::post('/from-api', [FoodLogController::class, 'storeFromApi']);
        Route::put('/{foodLog}', [FoodLogController::class, 'update']);
        Route::delete('/{foodLog}', [FoodLogController::class, 'destroy']);
        Route::get('/summary',   [FoodLogController::class, 'summary']);
        Route::get('/history',   [FoodLogController::class, 'history']);
    });

    // Water log
    Route::prefix('water-log')->group(function () {
        Route::get('/',          [WaterLogController::class, 'show']);
        Route::post('/increment',[WaterLogController::class, 'increment']);
        Route::post('/decrement',[WaterLogController::class, 'decrement']);
        Route::put('/',          [WaterLogController::class, 'update']);
    });

    // Super Admin — API key management
    Route::prefix('admin')->group(function () {
        Route::get('/settings',              [AdminController::class, 'getSettings']);
        Route::post('/settings/smtp',        [AdminController::class, 'updateSmtp']);
        Route::post('/settings/nutritionix', [AdminController::class, 'updateNutritionix']);
        Route::post('/settings/test-smtp',   [AdminController::class, 'testSmtp']);
        Route::post('/settings/test-nutritionix', [AdminController::class, 'testNutritionix']);
    });
});
