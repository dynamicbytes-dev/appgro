<?php

namespace App\Http\Controllers;

use App\Models\Farm;
use App\Models\FarmModule;
use App\Models\Module;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AdminDashboardController extends Controller
{
    /**
     * Display the Admin dashboard summary and modules list for the authenticated farm owner.
     * Guaranteed response structures with fallbacks.
     */
    public function index(Request $request)
    {
        $user = Auth::guard('api')->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if ($user->isAdmin() && !$user->farm_id) {
            \Illuminate\Support\Facades\Log::warning('ADMIN WITHOUT FARM:', [
                'user_id' => $user->id,
                'email' => $user->email,
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'El usuario administrador no tiene una granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $isRoot = $user->isRoot();
        $farmId = $user->farm_id;

        // If user is root and passed a specific numeric farm_id in query params, use it (ignore 'all' or empty)
        if ($isRoot && $request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
            $farmId = (int) $request->query('farm_id');
        }

        \Illuminate\Support\Facades\Log::info('USER LOGGED:', [
            'user_id' => Auth::id(),
            'farm_id' => Auth::user() ? Auth::user()->farm_id : null,
        ]);
        \Illuminate\Support\Facades\Log::info('MODULES FOUND:', [
            'modules' => Auth::user() && Auth::user()->farm_id
                ? FarmModule::where('farm_id', Auth::user()->farm_id)->get()
                : [],
        ]);

        // 1. Ensure farm_modules entries exist for this farm if farm_id is present
        if ($farmId) {
            Farm::ensureDefaultModules($farmId);
        }

        // Default farm object structure
        $farmData = [
            'id' => $user->farm ? (int) $user->farm->id : ($farmId ? (int) $farmId : 0),
            'code' => $user->farm ? (string) $user->farm->code : '',
            'name' => $user->farm ? (string) $user->farm->name : 'Sin Granja Asignada',
            'sector' => $user->farm ? (string) $user->farm->sector : '',
            'location' => $user->farm ? (string) $user->farm->location : '',
            'is_active' => $user->farm ? (bool) $user->farm->is_active : false,
        ];

        // 2. Fetch all official system modules combined with real farm_modules pivot state
        $allOfficialModules = Module::orderBy('id', 'asc')->get();
        $farmPivotMap = $farmId
            ? DB::table('farm_modules')->where('farm_id', $farmId)->pluck('is_enabled', 'module_id')
            : collect([]);

        $formattedModules = $allOfficialModules->map(function ($mod) use ($farmPivotMap, $isRoot) {
            $isEnabled = $isRoot
                ? true
                : ($farmPivotMap->has($mod->id) ? (bool) $farmPivotMap->get($mod->id) : false);

            return [
                'id' => (int) $mod->id,
                'module_id' => (int) $mod->id,
                'code' => (string) $mod->code,
                'name' => (string) $mod->name,
                'description' => (string) $mod->description,
                'is_enabled' => (bool) $isEnabled,
            ];
        })->values();

        $targetFarmId = $farmId ?? ($user->farm_id ?? (Auth::user() ? Auth::user()->farm_id : null));

        $subordinatesCount = $targetFarmId
            ? (int) User::where('role', 'subordinate')->where('farm_id', $targetFarmId)->count()
            : 0;

        $enabledCount = $formattedModules->where('is_enabled', true)->count();

        $dashboardData = [
            'farm' => $farmData,
            'farm_modules' => $formattedModules,
            'modules' => $formattedModules,
            'enabled_modules_count' => (int) $enabledCount,
            'subordinates_count' => (int) $subordinatesCount,
            'total_subordinates' => (int) $subordinatesCount,
            'totalSubordinates' => (int) $subordinatesCount,
            'subordinatesCount' => (int) $subordinatesCount,
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Panel de control obtenido con éxito.',
            'farm' => $farmData,
            'farm_modules' => $formattedModules,
            'modules' => $formattedModules,
            'enabled_modules_count' => (int) $enabledCount,
            'subordinates_count' => (int) $subordinatesCount,
            'total_subordinates' => (int) $subordinatesCount,
            'totalSubordinates' => (int) $subordinatesCount,
            'subordinatesCount' => (int) $subordinatesCount,
            'data' => $dashboardData,
        ], Response::HTTP_OK);
    }
}
