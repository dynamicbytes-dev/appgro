<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class AppConfigController extends Controller
{
    /**
     * Return official application configuration, metadata, branding, and assets.
     *
     * Returns:
     * - app_name: "Zootika"
     * - logo_url: "/logo-zootika.png"
     * - colors: #064E3B (Forest Green) and #10B981 (Emerald Green)
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $appName = config('zootika.app_name', config('app.name', 'Zootika'));
        $logoUrl = config('zootika.logo_url', config('app.logo_url', '/logo-zootika.png'));
        $colors = config('zootika.colors', config('app.colors', [
            'forest_green' => '#064E3B',
            'emerald_green' => '#10B981',
            'primary' => '#064E3B',
            'secondary' => '#10B981',
        ]));

        $data = [
            'app_name' => $appName,
            'logo_url' => $logoUrl,
            'colors' => $colors,
            'version' => '1.0.0',
            'environment' => config('app.env', 'production'),
        ];

        return response()->json([
            'status' => 'success',
            'app_name' => $appName,
            'logo_url' => $logoUrl,
            'colors' => $colors,
            'data' => $data,
        ], Response::HTTP_OK);
    }
}
