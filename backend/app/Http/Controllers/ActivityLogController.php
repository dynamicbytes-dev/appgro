<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ActivityLogController extends Controller
{
    /**
     * Display a listing of the activity logs based on user privileges and farm scope.
     *
     * - Root: Global access to all logs with optional farm_id filter.
     * - Admin / Subordinate: Strictly and exclusively filtered by authenticated user's farm_id (no orWhere).
     */
    public function index(Request $request)
    {
        $user = $request->user() ?? Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = ActivityLog::query()
            ->with(['user', 'farm']);

        // Strict exclusive farm filter: discard orphan or global records (whereNotNull)
        if ($user->role !== 'root') {
            if (!$user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El usuario no tiene una granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }

            $query->where('farm_id', $user->farm_id)
                  ->whereNotNull('farm_id');
        } elseif ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
            $query->where('farm_id', (int) $request->farm_id);
        }

        // Filter by module (e.g. 'Especies', 'Galpones', 'Lotes', 'Encargados')
        if ($request->filled('module')) {
            $query->where('module', $request->query('module'));
        }

        // Filter by action (e.g. 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'INHABILITAR')
        if ($request->filled('action')) {
            $query->where('action', strtoupper($request->query('action')));
        }

        // Filter by specific user_id
        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->query('user_id'));
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->query('date_to'));
        }

        // Search text in description, module or action
        if ($request->filled('search')) {
            $searchTerm = '%' . trim($request->query('search')) . '%';
            $query->where(function ($q) use ($searchTerm) {
                $q->where('description', 'like', $searchTerm)
                  ->orWhere('module', 'like', $searchTerm)
                  ->orWhere('action', 'like', $searchTerm);
            });
        }

        // Order by latest activity first
        $query->orderBy('created_at', 'desc')->orderBy('id', 'desc');

        $perPage = max(1, min((int) $request->query('per_page', 15), 100));
        $logs = $query->paginate($perPage);

        $stats = $this->computeHistoryStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Historial de actividades obtenido con éxito.',
            'current_page' => $logs->currentPage(),
            'data' => $logs->items(),
            'first_page_url' => $logs->url(1),
            'from' => $logs->firstItem(),
            'last_page' => $logs->lastPage(),
            'last_page_url' => $logs->url($logs->lastPage()),
            'next_page_url' => $logs->nextPageUrl(),
            'path' => $logs->path(),
            'per_page' => $logs->perPage(),
            'prev_page_url' => $logs->previousPageUrl(),
            'to' => $logs->lastItem(),
            'total' => $logs->total(),
            'stats' => $stats,
            'total_records' => $stats['total_records'],
            'creations' => $stats['creations'],
            'modifications' => $stats['modifications'],
            'deletions' => $stats['deletions'],
            'totalRecords' => $stats['total_records'],
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Return contextual summary statistics for history activity logs.
     */
    public function stats(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->isRoot() && !$user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'El usuario no tiene una granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $stats = $this->computeHistoryStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de auditoría obtenidas con éxito.',
            'total_records' => $stats['total_records'],
            'creations' => $stats['creations'],
            'modifications' => $stats['modifications'],
            'deletions' => $stats['deletions'],
            'totalRecords' => $stats['total_records'],
            'data' => $stats,
        ], Response::HTTP_OK);
    }

    /**
     * Compute aggregate metrics from activity_logs strictly filtered by user farm scope.
     */
    protected function computeHistoryStats(Request $request, $user): array
    {
        $farmId = $user->farm_id ?? (Auth::user() ? Auth::user()->farm_id : null);

        // Strict role-based exclusive farm scope
        if ($user->role === 'root') {
            $baseQuery = ActivityLog::query();
            if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $baseQuery->where('farm_id', (int) $request->farm_id);
            }
        } else {
            if (!$farmId) {
                return [
                    'total_records' => 0,
                    'creations' => 0,
                    'modifications' => 0,
                    'deletions' => 0,
                    'totalRecords' => 0,
                    'farm_id' => null,
                ];
            }
            // Exclusively own farm_id - no orWhere and discard null farm_id
            $baseQuery = ActivityLog::where('farm_id', (int) $farmId)->whereNotNull('farm_id');
        }

        // Filtros contextuales (los mismos del listado) para que los KPIs
        // reflejen exactamente la selección activa del usuario.
        if ($request->filled('module')) {
            $baseQuery->where('module', $request->query('module'));
        }
        if ($request->filled('action')) {
            $baseQuery->where('action', strtoupper($request->query('action')));
        }
        if ($request->filled('date_from')) {
            $baseQuery->whereDate('created_at', '>=', $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $baseQuery->whereDate('created_at', '<=', $request->query('date_to'));
        }
        if ($request->filled('search')) {
            $searchTerm = '%' . trim($request->query('search')) . '%';
            $baseQuery->where(function ($q) use ($searchTerm) {
                $q->where('description', 'like', $searchTerm)
                  ->orWhere('module', 'like', $searchTerm)
                  ->orWhere('action', 'like', $searchTerm);
            });
        }

        $totalRecords = (int) (clone $baseQuery)->count();
        $creations = (int) (clone $baseQuery)->whereIn('action', ['CREATE', 'CREAR', 'HABILITAR', 'create', 'crear', 'habilitar'])->count();
        $modifications = (int) (clone $baseQuery)->whereIn('action', ['UPDATE', 'ACTUALIZAR', 'MODIFICAR', 'update', 'actualizar', 'modificar'])->count();
        $deletions = (int) (clone $baseQuery)->whereIn('action', ['DELETE', 'ELIMINAR', 'INHABILITAR', 'delete', 'eliminar', 'inhabilitar', 'BAJA', 'baja'])->count();

        $hasSpecificFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';

        $targetFarmId = $user->role === 'root'
            ? ($hasSpecificFarm ? (int) $request->farm_id : null)
            : (int) $farmId;

        return [
            'total_records' => $totalRecords,
            'creations' => $creations,
            'modifications' => $modifications,
            'deletions' => $deletions,
            'totalRecords' => $totalRecords,
            'farm_id' => $targetFarmId,
        ];
    }

    /**
     * Display the specified activity log.
     */
    public function show($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $log = ActivityLog::with([
            'user:id,name,lastname,email,role',
            'farm:id,name,code',
        ])->find($id);

        if (!$log) {
            return response()->json([
                'status' => 'error',
                'message' => 'Registro de historial no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Tenant boundary check: Admin or Subordinate can only view their own farm's logs
        if (!$user->isRoot() && $log->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este registro pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Detalle de actividad obtenido con éxito.',
            'data' => $log,
        ], Response::HTTP_OK);
    }
}
