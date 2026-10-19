<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\User;
use App\Notifications\ActivityAssignedNotification;
use App\Notifications\ActivityCompletedNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Módulo operativo Actividades ('activities' / alias 'actividades').
 *
 * El administrador crea actividades y las asigna a un subordinado de
 * su granja; el subordinado cambia el estado entre 'en_proceso' y
 * 'terminada'. Cada creación y culminación genera una notificación
 * persistida en la tabla `notifications` (canal database).
 */
class ActivityController extends Controller
{
    /**
     * Listado de actividades para administradores/root, con filtros
     * y estadísticas, siempre acotado a la granja del usuario.
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

        // El listado global es exclusivo del administrador/root: los
        // subordinados usan su bandeja (/activities/my) con SUS tareas.
        if (!$user->isRoot() && !$user->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: este listado es exclusivo del administrador. Use /activities/my.',
            ], Response::HTTP_FORBIDDEN);
        }

        $query = Activity::query()->with([
            'assignee:id,name,lastname,email',
            'creator:id,name,lastname',
            'farm:id,name',
        ]);

        // Scope: root puede filtrar por farm_id; el resto queda estricto a su granja
        if ($user->isRoot()) {
            if ($request->filled('farm_id') && $request->farm_id !== 'all'
                && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $query->where('farm_id', (int) $request->farm_id);
            }
        } else {
            if (!$user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }

            // Se ignora cualquier farm_id recibido: el admin solo ve SU granja
            // (evita el 403 espurio cuando el frontend envía su propia granja,
            // y garantiza que nunca filtra datos de otra granja)
            $query->where('farm_id', $user->farm_id)->whereNotNull('farm_id');
        }

        // Filtro por estado
        if ($request->filled('status')) {
            if (!array_key_exists($request->status, Activity::STATUS_LABELS)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El estado proporcionado no es válido.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $query->where('status', $request->status);
        }

        // Filtro por subordinado asignado
        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', (int) $request->assigned_to);
        }

        // Filtro de vencidas
        if (filter_var($request->input('overdue'), FILTER_VALIDATE_BOOLEAN)) {
            $query->overdue();
        }

        // Búsqueda por título o descripción
        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                    ->orWhere('description', 'like', $term);
            });
        }

        $activities = $query->orderBy('status', 'asc')
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(fn (Activity $activity) => $this->decorateActivity($activity))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Lista de actividades obtenida con éxito.',
            'data' => $activities,
            'stats' => $this->computeStats($request, $user),
        ], Response::HTTP_OK);
    }

    /**
     * Bandeja del subordinado: solo las actividades asignadas al usuario
     * autenticado.
     */
    public function myActivities(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = Activity::query()
            ->where('assigned_to', $user->id)
            ->with('creator:id,name,lastname');

        if ($request->filled('status')) {
            if (!array_key_exists($request->status, Activity::STATUS_LABELS)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El estado proporcionado no es válido.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $query->where('status', $request->status);
        }

        if (filter_var($request->input('overdue'), FILTER_VALIDATE_BOOLEAN)) {
            $query->overdue();
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                    ->orWhere('description', 'like', $term);
            });
        }

        $activities = $query->orderBy('status', 'asc')
            ->orderBy('due_date', 'asc')
            ->get()
            ->map(fn (Activity $activity) => $this->decorateActivity($activity))
            ->values();

        $allMine = Activity::query()->where('assigned_to', $user->id);

        return response()->json([
            'status' => 'success',
            'message' => 'Actividades asignadas obtenidas con éxito.',
            'data' => $activities,
            'stats' => [
                'total' => (int) (clone $allMine)->count(),
                'pending' => (int) (clone $allMine)->where('status', Activity::STATUS_PENDING)->count(),
                'in_progress' => (int) (clone $allMine)->where('status', Activity::STATUS_IN_PROGRESS)->count(),
                'completed' => (int) (clone $allMine)->where('status', Activity::STATUS_COMPLETED)->count(),
                'overdue' => (int) (clone $allMine)->overdue()->count(),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Registrar una nueva actividad y asignarla a un subordinado.
     * Genera la notificación en base de datos para el subordinado.
     */
    public function store(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Solo root y admin pueden crear actividades
        if (!$user->isRoot() && !$user->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo administradores pueden crear actividades.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Resolución de granja (root debe indicar farm_id si no tiene asignada)
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');
            if (!$farmId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Debe especificar el ID de la granja (farm_id) para registrar la actividad.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        } else {
            if (!$user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }
            $farmId = $user->farm_id;
        }

        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['required', 'date', 'after_or_equal:today'],
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
        ], [
            'title.required' => 'El título de la actividad es obligatorio.',
            'title.max' => 'El título no puede superar los 255 caracteres.',
            'due_date.required' => 'La fecha límite es obligatoria.',
            'due_date.date' => 'La fecha límite debe ser una fecha válida.',
            'due_date.after_or_equal' => 'La fecha límite no puede ser anterior a hoy.',
            'assigned_to.required' => 'Debe seleccionar el subordinado que recibirá la actividad.',
            'assigned_to.exists' => 'El usuario seleccionado no existe.',
        ]);

        // El asignado debe ser un subordinado ACTIVO de la MISMA granja
        $validator->after(function ($v) use ($request, $farmId) {
            if ($v->errors()->has('assigned_to') || !$request->filled('assigned_to')) {
                return;
            }

            $assignee = User::find((int) $request->assigned_to);

            if (!$assignee) {
                return;
            }

            if (!$assignee->isSubordinate()) {
                $v->errors()->add('assigned_to', 'El usuario seleccionado no es un subordinado (encargado).');
            } elseif ((int) $assignee->farm_id !== (int) $farmId) {
                $v->errors()->add('assigned_to', 'El subordinado seleccionado pertenece a otra granja.');
            } elseif (! $assignee->is_active) {
                $v->errors()->add('assigned_to', 'El subordinado seleccionado está inactivo.');
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $activity = DB::transaction(function () use ($request, $farmId, $user) {
            $activity = Activity::create([
                'farm_id' => $farmId,
                'created_by' => $user->id,
                'assigned_to' => (int) $request->assigned_to,
                'title' => trim($request->title),
                'description' => $request->filled('description') ? trim($request->description) : null,
                'due_date' => $request->due_date,
                'status' => Activity::STATUS_PENDING,
            ]);

            // Notificación en base de datos para el subordinado asignado
            $assignee = User::find((int) $request->assigned_to);
            $assignee->notify(new ActivityAssignedNotification($activity));

            return $activity;
        });

        $activity->load([
            'assignee:id,name,lastname,email',
            'creator:id,name,lastname',
            'farm:id,name',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Actividad registrada y asignada correctamente.',
            'data' => $this->decorateActivity($activity),
        ], Response::HTTP_CREATED);
    }

    /**
     * Ficha de una actividad (asignado, admin de la granja o root).
     */
    public function show($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $activity = Activity::with([
            'assignee:id,name,lastname,email',
            'creator:id,name,lastname',
            'farm:id,name',
        ])->find($id);

        if (!$activity) {
            return response()->json([
                'status' => 'error',
                'message' => 'Actividad no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canView($user, $activity)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: esta actividad pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->decorateActivity($activity),
        ], Response::HTTP_OK);
    }

    /**
     * Actualizar datos de la actividad (solo admin de la granja o root,
     * y únicamente si aún no está terminada).
     */
    public function update(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $activity = Activity::find($id);

        if (!$activity) {
            return response()->json([
                'status' => 'error',
                'message' => 'Actividad no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canManage($user, $activity)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo el administrador de la granja puede editar esta actividad.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($activity->status === Activity::STATUS_COMPLETED) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede editar una actividad que ya fue terminada.',
                'errors' => [
                    'status' => ['No se puede editar una actividad que ya fue terminada.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['required', 'date'],
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
        ], [
            'title.required' => 'El título de la actividad es obligatorio.',
            'title.max' => 'El título no puede superar los 255 caracteres.',
            'due_date.required' => 'La fecha límite es obligatoria.',
            'due_date.date' => 'La fecha límite debe ser una fecha válida.',
            'assigned_to.required' => 'Debe seleccionar el subordinado que recibirá la actividad.',
            'assigned_to.exists' => 'El usuario seleccionado no existe.',
        ]);

        $validator->after(function ($v) use ($request, $activity) {
            if ($v->errors()->has('assigned_to') || !$request->filled('assigned_to')) {
                return;
            }

            $assignee = User::find((int) $request->assigned_to);

            if (!$assignee) {
                return;
            }

            if (!$assignee->isSubordinate()) {
                $v->errors()->add('assigned_to', 'El usuario seleccionado no es un subordinado (encargado).');
            } elseif ((int) $assignee->farm_id !== (int) $activity->farm_id) {
                $v->errors()->add('assigned_to', 'El subordinado seleccionado pertenece a otra granja.');
            } elseif (! $assignee->is_active) {
                $v->errors()->add('assigned_to', 'El subordinado seleccionado está inactivo.');
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $previousAssignee = (int) $activity->assigned_to;
        $newAssignee = (int) $request->assigned_to;

        $activity->title = trim($request->title);
        $activity->description = $request->filled('description') ? trim($request->description) : null;
        $activity->due_date = $request->due_date;
        $activity->assigned_to = $newAssignee;
        $activity->save();

        // Reasignación: el nuevo subordinado recibe la notificación
        if ($previousAssignee !== $newAssignee) {
            $assignee = User::find($newAssignee);
            if ($assignee) {
                $assignee->notify(new ActivityAssignedNotification($activity));
            }
        }

        $activity->load([
            'assignee:id,name,lastname,email',
            'creator:id,name,lastname',
            'farm:id,name',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Actividad actualizada correctamente.',
            'data' => $this->decorateActivity($activity),
        ], Response::HTTP_OK);
    }

    /**
     * Cambio de estado por el subordinado (o por admin/root).
     * Solo se admiten exactamente dos opciones: 'en_proceso' y 'terminada'.
     */
    public function updateStatus(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $activity = Activity::find($id);

        if (!$activity) {
            return response()->json([
                'status' => 'error',
                'message' => 'Actividad no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Regla de negocio: solo el asignado, un admin o root pueden cambiar el estado
        if (!$this->canChangeStatus($user, $activity)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo el subordinado asignado o un administrador pueden cambiar el estado de esta actividad.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in(Activity::SUBORDINATE_STATUS_OPTIONS)],
        ], [
            'status.required' => 'El estado es obligatorio.',
            'status.in' => 'El estado debe ser exactamente "en_proceso" o "terminada".',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $previousStatus = $activity->status;
        $activity->status = $request->status;
        $activity->completed_at = $request->status === Activity::STATUS_COMPLETED ? now() : null;
        $activity->save();

        // Al culminarse, se notifica al administrador que la creó
        if ($activity->status === Activity::STATUS_COMPLETED
            && $previousStatus !== Activity::STATUS_COMPLETED
            && $activity->created_by) {
            $admin = User::find($activity->created_by);
            if ($admin) {
                $admin->notify(new ActivityCompletedNotification($activity));
            }
        }

        $activity->load([
            'assignee:id,name,lastname,email',
            'creator:id,name,lastname',
            'farm:id,name',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Estado de la actividad actualizado correctamente.',
            'data' => $this->decorateActivity($activity),
        ], Response::HTTP_OK);
    }

    /**
     * Eliminar una actividad (solo admin de la granja o root, y si no
     * está terminada). Sus notificaciones asociadas se limpian también.
     */
    public function destroy($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $activity = Activity::find($id);

        if (!$activity) {
            return response()->json([
                'status' => 'error',
                'message' => 'Actividad no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canManage($user, $activity)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo el administrador de la granja puede eliminar esta actividad.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($activity->status === Activity::STATUS_COMPLETED) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar una actividad que ya fue terminada.',
                'errors' => [
                    'status' => ['No se puede eliminar una actividad que ya fue terminada.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $activityId = $activity->id;
        $farmId = $activity->farm_id;

        $activity->delete();

        // Limpieza de notificaciones huérfanas de esta actividad
        $this->purgeActivityNotifications($activityId, (int) $farmId);

        return response()->json([
            'status' => 'success',
            'message' => 'Actividad eliminada correctamente.',
        ], Response::HTTP_OK);
    }

    /**
     * Estadísticas del módulo para la granja del usuario.
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
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Las estadísticas globales son del panel del administrador.
        if (!$user->isRoot() && !$user->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: las estadísticas globales son exclusivas del administrador.',
            ], Response::HTTP_FORBIDDEN);
        }

        $computed = $this->computeStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de actividades obtenidas con éxito.',
            'data' => $computed,
            'total_activities' => $computed['total'],
            'pending_activities' => $computed['pending'],
            'in_progress_activities' => $computed['in_progress'],
            'completed_activities' => $computed['completed'],
            'overdue_activities' => $computed['overdue'],
        ], Response::HTTP_OK);
    }

    /**
     * Métricas KPI acotadas a la granja del usuario.
     */
    protected function computeStats(Request $request, $user): array
    {
        $base = Activity::query();

        if ($user->isRoot()) {
            if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $base->where('farm_id', (int) $request->farm_id);
            }
        } else {
            if (!$user->farm_id) {
                return ['total' => 0, 'pending' => 0, 'in_progress' => 0, 'completed' => 0, 'overdue' => 0];
            }
            $base->where('farm_id', (int) $user->farm_id);
        }

        return [
            'total' => (int) (clone $base)->count(),
            'pending' => (int) (clone $base)->where('status', Activity::STATUS_PENDING)->count(),
            'in_progress' => (int) (clone $base)->where('status', Activity::STATUS_IN_PROGRESS)->count(),
            'completed' => (int) (clone $base)->where('status', Activity::STATUS_COMPLETED)->count(),
            'overdue' => (int) (clone $base)->overdue()->count(),
        ];
    }

    /**
     * Enriquece la actividad con campos de presentación para el frontend.
     */
    protected function decorateActivity(Activity $activity): array
    {
        return array_merge($activity->toArray(), [
            'status_label' => $activity->statusLabel(),
            'is_overdue' => $activity->isOverdue(),
            // Nombre de la granja de origen (solo si la relación fue cargada,
            // para no provocar consultas N+1 en la bandeja del subordinado).
            'farm_name' => $activity->relationLoaded('farm') ? $activity->farm?->name : null,
        ]);
    }

    /**
     * ¿Puede ver la actividad? (asignado, admin/root de la granja)
     */
    protected function canView($user, Activity $activity): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->isRoot()) {
            return true;
        }

        if ((int) $activity->farm_id !== (int) $user->farm_id) {
            return false;
        }

        return (int) $activity->assigned_to === (int) $user->id || $user->isAdmin();
    }

    /**
     * ¿Puede editar/eliminar la actividad? (admin de la granja o root)
     */
    protected function canManage($user, Activity $activity): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->isRoot()) {
            return true;
        }

        return $user->isAdmin() && (int) $activity->farm_id === (int) $user->farm_id;
    }

    /**
     * ¿Puede cambiar el estado? (el subordinado asignado, o admin/root)
     */
    protected function canChangeStatus($user, Activity $activity): bool
    {
        if (!$user) {
            return false;
        }

        if ($this->canManage($user, $activity)) {
            return true;
        }

        return $user->isSubordinate()
            && (int) $activity->assigned_to === (int) $user->id
            && (int) $activity->farm_id === (int) $user->farm_id;
    }

    /**
     * Elimina las notificaciones (ya leídas o no) que referencian la
     * actividad borrada, recorriendo los usuarios de la granja.
     */
    protected function purgeActivityNotifications(int $activityId, int $farmId): void
    {
        $userIds = DB::table('users')
            ->where('farm_id', $farmId)
            ->pluck('id');

        foreach ($userIds as $userId) {
            DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->where('notifiable_id', $userId)
                ->where('data', 'like', '%"activity_id":'.$activityId.',%')
                ->delete();
        }
    }
}
