<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restringe el acceso a usuarios con rol Administrador o Root.
 *
 * Se usa para rutas de gestión (encargados, dashboard administrativo,
 * módulos de granja) que nunca deben ser accesibles por un encargado
 * (rol `subordinate`).
 */
class EnsureIsAdminOrRoot
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->isAdmin() && !$user->isRoot()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado. Este recurso requiere rol Administrador o Root.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
