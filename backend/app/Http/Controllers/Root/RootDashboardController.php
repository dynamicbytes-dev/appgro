<?php

namespace App\Http\Controllers\Root;

use App\Http\Controllers\Controller;
use App\Models\Farm;
use App\Models\Module;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RootDashboardController extends Controller
{
    /**
     * Get Root global dashboard metrics and counts with guaranteed fallback structures.
     */
    public function stats(Request $request)
    {
        $totalFarms = Farm::count();
        $activeFarms = Farm::where('is_active', true)->count();
        $inactiveFarms = Farm::where('is_active', false)->count();

        $totalAdmins = User::where('role', 'admin')->count();
        $activeAdmins = User::where('role', 'admin')->where('is_active', true)->count();
        $inactiveAdmins = User::where('role', 'admin')->where('is_active', false)->count();

        $totalSubordinates = User::where('role', 'subordinate')->count();
        $totalModules = Module::count();

        $recentFarms = Farm::orderBy('created_at', 'desc')->take(5)->get();
        $recentAdmins = User::where('role', 'admin')->with('farm')->orderBy('created_at', 'desc')->take(5)->get();

        $statsData = [
            'total_farms' => (int) ($totalFarms ?? 0),
            'active_farms' => (int) ($activeFarms ?? 0),
            'inactive_farms' => (int) ($inactiveFarms ?? 0),
            'farms_count' => (int) ($totalFarms ?? 0),

            'total_admins' => (int) ($totalAdmins ?? 0),
            'active_admins' => (int) ($activeAdmins ?? 0),
            'inactive_admins' => (int) ($inactiveAdmins ?? 0),
            'admins_count' => (int) ($totalAdmins ?? 0),

            'total_subordinates' => (int) ($totalSubordinates ?? 0),
            'subordinates_count' => (int) ($totalSubordinates ?? 0),
            'total_modules' => (int) ($totalModules ?? 0),

            'recent_farms' => $recentFarms,
            'recent_admins' => $recentAdmins,
            'farms_by_sector' => [],
        ];

        return response()->json(array_merge([
            'success' => true,
            'status' => 'success',
            'message' => 'Estadísticas globales obtenidas correctamente.',
            'data' => $statsData,
        ], $statsData), Response::HTTP_OK);
    }
}
