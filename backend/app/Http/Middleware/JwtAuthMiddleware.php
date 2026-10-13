<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;

class JwtAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            if (!$user = JWTAuth::parseToken()->authenticate()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario no encontrado',
                ], Response::HTTP_UNAUTHORIZED);
            }

            if (!$user->is_active) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario inactivo. Acceso denegado.',
                ], Response::HTTP_FORBIDDEN);
            }
        } catch (TokenExpiredException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'El token ha expirado.',
                'error_code' => 'TOKEN_EXPIRED',
            ], Response::HTTP_UNAUTHORIZED);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'El token es inválido.',
                'error_code' => 'TOKEN_INVALID',
            ], Response::HTTP_UNAUTHORIZED);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Token de autenticación no proporcionado o malformado.',
                'error_code' => 'TOKEN_ABSENT',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $next($request);
    }
}
