<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bandeja de notificaciones del usuario autenticado.
 *
 * Consume la tabla `notifications` (canal database de Laravel, trait
 * Notifiable en User). El frontend la consulta por polling para
 * actualizar el contador de la campana del navbar.
 *
 * Nota: estas rutas solo exigen JWT (sin module.access) para que la
 * campana siga funcionando aunque el módulo de Actividades esté
 * deshabilitado para la granja.
 */
class NotificationController extends Controller
{
    /**
     * Listado de notificaciones del usuario + contador de no leídas.
     */
    public function index(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $limit = min(max((int) $request->input('limit', 20), 1), 50);

        $notifications = $user->notifications()
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        $unreadCount = (int) $user->unreadNotifications()->count();
        $total = (int) $user->notifications()->count();

        return response()->json([
            'status' => 'success',
            'message' => 'Notificaciones obtenidas con éxito.',
            'data' => $notifications,
            'unread_count' => $unreadCount,
            'unreadCount' => $unreadCount,
            'total' => $total,
        ], Response::HTTP_OK);
    }

    /**
     * Marcar una notificación como leída.
     */
    public function markAsRead($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $notification = $user->notifications()->where('id', $id)->first();

        if (!$notification) {
            return response()->json([
                'status' => 'error',
                'message' => 'Notificación no encontrada.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$notification->read_at) {
            $notification->markAsRead();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Notificación marcada como leída.',
            'data' => $notification->fresh(),
            'unread_count' => (int) $user->unreadNotifications()->count(),
        ], Response::HTTP_OK);
    }

    /**
     * Marcar todas las notificaciones como leídas.
     */
    public function markAllAsRead()
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $updated = $user->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'status' => 'success',
            'message' => 'Todas las notificaciones fueron marcadas como leídas.',
            'updated' => (int) $updated,
            'unread_count' => 0,
        ], Response::HTTP_OK);
    }
}
