<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Potrero;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

trait ResolvesPotrero
{
    /**
     * Resuelve un potrero aplicando el aislamiento estricto por granja.
     * Devuelve un JsonResponse de error (404/403) o el Potrero.
     */
    protected function resolvePotrero($id, $user): Potrero|JsonResponse
    {
        $potrero = Potrero::withoutGlobalScopes()->find($id);

        if (! $potrero) {
            return response()->json([
                'status' => 'error',
                'message' => 'Potrero no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && (int) $potrero->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este potrero pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $potrero;
    }
}
