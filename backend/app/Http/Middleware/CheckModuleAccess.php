<?php

namespace App\Http\Middleware;

use App\Models\Farm;
use App\Models\Module;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class CheckModuleAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $moduleCode): Response
    {
        $user = Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'No autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // a) Root user has global access to all modules
        if ($user->isRoot()) {
            return $next($request);
        }

        // Validate user belongs to an active farm
        if (! $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no tiene una granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $farm = Farm::find($user->farm_id);
        if (! $farm || ! $farm->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'La granja del usuario se encuentra inactiva o deshabilitada.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Find requested module (supporting galpones/barns and lots/lotes aliases)
        $module = Module::where('code', $moduleCode)->first();
        if (! $module) {
            $alias = match ($moduleCode) {
                'galpones' => 'barns',
                'barns' => 'galpones',
                'lotes' => 'lots',
                'history' => 'historial',
                'historial' => 'history',
                default => null,
            };
            if ($alias) {
                $module = Module::where('code', $alias)->first();
            }
        }

        if (! $module) {
            return response()->json([
                'status' => 'error',
                'message' => "El módulo '{$moduleCode}' no existe en el sistema.",
            ], Response::HTTP_NOT_FOUND);
        }

        $equivalentModuleIds = [$module->id];
        if (in_array($module->code, ['galpones', 'barns'])) {
            $equiv = Module::whereIn('code', ['galpones', 'barns'])->pluck('id')->toArray();
            $equivalentModuleIds = array_unique(array_merge($equivalentModuleIds, $equiv));
        }
        if (in_array($module->code, ['lots', 'lotes'])) {
            $equiv = Module::whereIn('code', ['lots', 'lotes'])->pluck('id')->toArray();
            $equivalentModuleIds = array_unique(array_merge($equivalentModuleIds, $equiv));
        }

        // b) Admin Role: Check farm_modules
        if ($user->isAdmin()) {
            $farmModuleEnabled = DB::table('farm_modules')
                ->where('farm_id', $user->farm_id)
                ->whereIn('module_id', $equivalentModuleIds)
                ->where('is_enabled', true)
                ->exists();

            if (! $farmModuleEnabled) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Acceso denegado: El módulo '{$moduleCode}' no está habilitado para su granja.",
                ], Response::HTTP_FORBIDDEN);
            }

            return $next($request);
        }

        // c) Subordinate Role: Check subordinate_modules AND farm_modules
        if ($user->isSubordinate()) {
            $farmModuleEnabled = DB::table('farm_modules')
                ->where('farm_id', $user->farm_id)
                ->whereIn('module_id', $equivalentModuleIds)
                ->where('is_enabled', true)
                ->exists();

            if (! $farmModuleEnabled) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Acceso denegado: El módulo '{$moduleCode}' no está habilitado en su granja.",
                ], Response::HTTP_FORBIDDEN);
            }

            $subordinateModuleEnabled = DB::table('subordinate_modules')
                ->where('user_id', $user->id)
                ->whereIn('module_id', $equivalentModuleIds)
                ->where('is_enabled', true)
                ->exists();

            if (! $subordinateModuleEnabled) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Acceso denegado: No tiene asignados permisos para el módulo '{$moduleCode}'.",
                ], Response::HTTP_FORBIDDEN);
            }

            return $next($request);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Rol de usuario inválido o no reconocido.',
        ], Response::HTTP_FORBIDDEN);
    }
}
