<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Módulo operativo Inventario ('inventory' / alias 'inventario').
 *
 *  - El administrador/root gestiona el catálogo de insumos (crear,
 *    editar, eliminar). El stock NO se edita a mano: se mueve con
 *    `InventoryMovementController`.
 *  - El subordinado (encargado) puede LEER el inventario de su granja
 *    y registrar movimientos, pero no crear/editar/borrar insumos.
 */
class InventoryController extends Controller
{
    /**
     * Listado del catálogo para administradores/root, con filtros y
     * estadísticas, acotado a la granja del usuario.
     */
    public function index(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // El listado global es del panel del administrador/root.
        if (! $user->isRoot() && ! $user->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: este listado es exclusivo del administrador. Use /inventory/my.',
            ], Response::HTTP_FORBIDDEN);
        }

        $query = InventoryItem::query()->with(['creator:id,name,lastname', 'supplier:id,name', 'warehouse:id,name', 'farm:id,name']);

        if (! $this->applyFarmScope($request, $user, $query)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $this->applyFilters($request, $query);

        $items = $query->orderBy('name')
            ->get()
            ->map(fn (InventoryItem $item) => $this->decorateItem($item))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Lista de insumos obtenida con éxito.',
            'data' => $items,
            'stats' => $this->computeStats($request, $user),
        ], Response::HTTP_OK);
    }

    /**
     * Inventario de la granja para cualquier rol (bandeja del
     * subordinado): sólo lectura del catálogo + métricas acotadas.
     */
    public function my(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = InventoryItem::query()->with(['supplier:id,name', 'warehouse:id,name', 'farm:id,name']);

        if (! $this->applyFarmScope($request, $user, $query)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $this->applyFilters($request, $query);

        $items = $query->orderBy('name')
            ->get()
            ->map(fn (InventoryItem $item) => $this->decorateItem($item))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Inventario de la granja obtenido con éxito.',
            'data' => $items,
            'stats' => $this->computeStats($request, $user),
        ], Response::HTTP_OK);
    }

    /**
     * Registrar un insumo (solo admin/root). Si se envía stock inicial
     * se registra automáticamente el movimiento de entrada.
     */
    public function store(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->isRoot() && ! $user->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo administradores pueden registrar insumos.',
            ], Response::HTTP_FORBIDDEN);
        }

        $farmId = $this->resolveFarmId($request, $user);

        if (! $farmId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Debe especificar la granja (farm_id) para registrar el insumo.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validator = $this->makeValidator($request, true, (int) $farmId);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $item = DB::transaction(function () use ($request, $farmId, $user) {
            $item = InventoryItem::create([
                'farm_id' => $farmId,
                'code' => InventoryItem::generateCode((int) $farmId),
                'name' => trim($request->name),
                'category' => $request->category,
                'unit' => $request->unit,
                'current_stock' => 0,
                'min_stock' => (float) $request->min_stock,
                'max_stock' => $request->filled('max_stock') ? (float) $request->max_stock : null,
                'batch_number' => $request->filled('batch_number') ? trim($request->batch_number) : null,
                'manufacturing_date' => $request->filled('manufacturing_date') ? $request->manufacturing_date : null,
                'expiration_date' => $request->filled('expiration_date') ? $request->expiration_date : null,
                'location' => $request->filled('location') ? trim($request->location) : null,
                'unit_cost' => (float) $request->unit_cost,
                'total_cost' => 0,
                'supplier' => $request->filled('supplier') ? trim($request->supplier) : null,
                'supplier_id' => $request->filled('supplier_id') ? (int) $request->supplier_id : null,
                'warehouse_id' => $request->filled('warehouse_id') ? (int) $request->warehouse_id : null,
                'last_purchase_date' => $request->filled('last_purchase_date') ? $request->last_purchase_date : null,
                'created_by' => $user->id,
            ]);

            $initialStock = (float) ($request->input('current_stock') ?? 0);

            if ($initialStock > 0) {
                InventoryMovement::applyMovement($item, [
                    'type' => InventoryMovement::TYPE_ENTRY,
                    'quantity' => $initialStock,
                    'notes' => 'Stock inicial',
                ], (int) $user->id);

                // Respeta una fecha de compra explícita por encima de "hoy".
                if ($request->filled('last_purchase_date')
                    && optional($item->last_purchase_date)->toDateString() !== $request->last_purchase_date) {
                    $item->last_purchase_date = $request->last_purchase_date;
                    $item->save();
                }
            } else {
                $item->evaluateLowStockAlert();
            }

            return $item;
        });

        $item = $item->fresh()->load(['creator:id,name,lastname', 'supplier:id,name', 'warehouse:id,name']);

        return response()->json([
            'status' => 'success',
            'message' => 'Insumo registrado correctamente.',
            'data' => $this->decorateItem($item),
        ], Response::HTTP_CREATED);
    }

    /**
     * Ficha de un insumo (cualquier rol de la granja).
     */
    public function show($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $item = InventoryItem::with(['creator:id,name,lastname', 'supplier:id,name', 'warehouse:id,name', 'farm:id,name'])->find($id);

        if (! $item || ! $this->canView($user, $item)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Insumo no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->decorateItem($item),
        ], Response::HTTP_OK);
    }

    /**
     * Actualizar los datos del insumo (solo admin/root). El stock no se
     * modifica aquí: se ajusta con movimientos.
     */
    public function update(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $item = InventoryItem::find($id);

        if (! $item) {
            return response()->json([
                'status' => 'error',
                'message' => 'Insumo no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $this->canManage($user, $item)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo el administrador de la granja puede editar insumos.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = $this->makeValidator($request, false, (int) $item->farm_id);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $item->name = trim($request->name);
        $item->category = $request->category;
        $item->unit = $request->unit;
        $item->min_stock = (float) $request->min_stock;
        $item->max_stock = $request->filled('max_stock') ? (float) $request->max_stock : null;
        $item->batch_number = $request->filled('batch_number') ? trim($request->batch_number) : null;
        $item->manufacturing_date = $request->filled('manufacturing_date') ? $request->manufacturing_date : null;
        $item->expiration_date = $request->filled('expiration_date') ? $request->expiration_date : null;
        $item->location = $request->filled('location') ? trim($request->location) : null;
        $item->unit_cost = (float) $request->unit_cost;
        $item->supplier = $request->filled('supplier') ? trim($request->supplier) : null;
        $item->supplier_id = $request->filled('supplier_id') ? (int) $request->supplier_id : null;
        $item->warehouse_id = $request->filled('warehouse_id') ? (int) $request->warehouse_id : null;
        $item->last_purchase_date = $request->filled('last_purchase_date') ? $request->last_purchase_date : null;
        $item->syncTotalCost();
        $item->save();

        // La alerta de mínimo puede cambiar si se editó el mínimo.
        $item->evaluateLowStockAlert();

        $item = $item->fresh()->load(['creator:id,name,lastname', 'supplier:id,name', 'warehouse:id,name']);

        return response()->json([
            'status' => 'success',
            'message' => 'Insumo actualizado correctamente.',
            'data' => $this->decorateItem($item),
        ], Response::HTTP_OK);
    }

    /**
     * Eliminar un insumo y sus movimientos (solo admin/root).
     */
    public function destroy($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $item = InventoryItem::find($id);

        if (! $item) {
            return response()->json([
                'status' => 'error',
                'message' => 'Insumo no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $this->canManage($user, $item)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: solo el administrador de la granja puede eliminar insumos.',
            ], Response::HTTP_FORBIDDEN);
        }

        $itemId = $item->id;
        $farmId = (int) $item->farm_id;

        DB::transaction(function () use ($item) {
            // Los movimientos se eliminan en cascada por la FK.
            $item->delete();
        });

        $this->purgeItemNotifications($itemId, $farmId);

        return response()->json([
            'status' => 'success',
            'message' => 'Insumo eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /**
     * Estadísticas del inventario (solo admin/root).
     */
    public function stats(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->isRoot() && ! $user->isAdmin()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: las estadísticas globales son exclusivas del administrador.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $this->hasFarmContext($request, $user)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de inventario obtenidas con éxito.',
            'data' => $this->computeStats($request, $user),
        ], Response::HTTP_OK);
    }

    /**
     * Listados de alertas: bajo mínimo, sobre stock, por vencer y
     * vencidos (cualquier rol de la granja).
     */
    public function alerts(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $base = InventoryItem::query()->with(['supplier:id,name', 'warehouse:id,name', 'farm:id,name']);

        if (! $this->applyFarmScope($request, $user, $base)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $today = now()->toDateString();
        $limit = now()->addDays(InventoryItem::EXPIRING_SOON_DAYS)->toDateString();

        $lowStock = (clone $base)->lowStock()->orderBy('name')->get()
            ->map(fn ($i) => $this->decorateItem($i))->values();

        $overStock = (clone $base)->overStock()->orderBy('name')->get()
            ->map(fn ($i) => $this->decorateItem($i))->values();

        $expired = (clone $base)->whereNotNull('expiration_date')
            ->whereDate('expiration_date', '<', $today)
            ->orderBy('expiration_date')->get()
            ->map(fn ($i) => $this->decorateItem($i))->values();

        $expiring = (clone $base)->whereNotNull('expiration_date')
            ->whereDate('expiration_date', '>=', $today)
            ->whereDate('expiration_date', '<=', $limit)
            ->orderBy('expiration_date')->get()
            ->map(fn ($i) => $this->decorateItem($i))->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Alertas de inventario obtenidas con éxito.',
            'data' => [
                'low_stock' => $lowStock,
                'over_stock' => $overStock,
                'expiring' => $expiring,
                'expired' => $expired,
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Reglas de validación compartidas por store/update.
     */
    protected function makeValidator(Request $request, bool $isCreate, ?int $farmId = null)
    {
        return Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(array_keys(InventoryItem::CATEGORY_LABELS))],
            'unit' => ['required', Rule::in(array_keys(InventoryItem::UNITS))],
            'min_stock' => ['required', 'numeric', 'min:0'],
            'max_stock' => ['nullable', 'numeric', 'min:0', 'gte:min_stock'],
            'batch_number' => ['nullable', 'string', 'max:255'],
            'manufacturing_date' => ['nullable', 'date'],
            'expiration_date' => ['nullable', 'date', 'after_or_equal:manufacturing_date'],
            'location' => ['nullable', 'string', 'max:255'],
            'warehouse_id' => array_filter([
                'nullable', 'integer',
                $farmId ? Rule::exists('inventory_warehouses', 'id')
                    ->where(fn ($query) => $query->where('farm_id', $farmId)) : null,
            ]),
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'supplier_id' => array_filter([
                'nullable', 'integer',
                $farmId ? Rule::exists('inventory_suppliers', 'id')
                    ->where(fn ($query) => $query->where('farm_id', $farmId)) : null,
            ]),
            'last_purchase_date' => ['nullable', 'date'],
            'current_stock' => [$isCreate ? 'nullable' : 'sometimes', 'numeric', 'min:0'],
        ], [
            'name.required' => 'El nombre del insumo es obligatorio.',
            'name.max' => 'El nombre no puede superar los 255 caracteres.',
            'category.required' => 'La categoría es obligatoria.',
            'category.in' => 'La categoría seleccionada no es válida.',
            'unit.required' => 'La unidad de medida es obligatoria.',
            'unit.in' => 'La unidad de medida seleccionada no es válida.',
            'min_stock.required' => 'El stock mínimo es obligatorio.',
            'min_stock.numeric' => 'El stock mínimo debe ser numérico.',
            'min_stock.min' => 'El stock mínimo no puede ser negativo.',
            'max_stock.gte' => 'El stock máximo debe ser mayor o igual al stock mínimo.',
            'expiration_date.after_or_equal' => 'La fecha de vencimiento no puede ser anterior a la de fabricación.',
            'warehouse_id.exists' => 'La bodega seleccionada no pertenece a esta granja.',
            'unit_cost.required' => 'El costo unitario es obligatorio.',
            'unit_cost.min' => 'El costo unitario no puede ser negativo.',
            'supplier_id.exists' => 'El proveedor seleccionado no pertenece a esta granja.',
            'current_stock.min' => 'El stock inicial no puede ser negativo.',
        ]);
    }

    /**
     * Aplica el filtro de granja. Devuelve false si no hay contexto de
     * granja válido (root sin farm_id o usuario sin granja).
     */
    protected function applyFarmScope(Request $request, $user, $query): bool
    {
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?? $request->input('farmId');
            if ($farmId !== null && $farmId !== '' && strtolower(trim((string) $farmId)) !== 'all') {
                $query->where('farm_id', (int) $farmId);
            }

            return true;
        }

        if (! $user->farm_id) {
            return false;
        }

        // Se ignora cualquier farm_id recibido: solo ve SU granja.
        $query->where('farm_id', $user->farm_id)->whereNotNull('farm_id');

        return true;
    }

    /**
     * ¿Hay contexto de granja para calcular métricas?
     */
    protected function hasFarmContext(Request $request, $user): bool
    {
        if ($user->isRoot()) {
            return true;
        }

        return (bool) $user->farm_id;
    }

    /**
     * Filtros comunes del listado.
     */
    protected function applyFilters(Request $request, $query): void
    {
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('code', 'like', $term)
                    ->orWhere('batch_number', 'like', $term)
                    ->orWhere('supplier', 'like', $term)
                    ->orWhere('location', 'like', $term)
                    ->orWhereHas('supplier', fn ($sub) => $sub->where('name', 'like', $term))
                    ->orWhereHas('warehouse', fn ($sub) => $sub->where('name', 'like', $term));
            });
        }

        $alert = $request->input('alert');

        if ($alert === 'low_stock') {
            $query->lowStock();
        } elseif ($alert === 'over_stock') {
            $query->overStock();
        } elseif ($alert === 'expired') {
            $query->whereNotNull('expiration_date')
                ->whereDate('expiration_date', '<', now()->toDateString());
        } elseif ($alert === 'expiring') {
            $query->whereNotNull('expiration_date')
                ->whereDate('expiration_date', '>=', now()->toDateString())
                ->whereDate('expiration_date', '<=', now()->addDays(InventoryItem::EXPIRING_SOON_DAYS)->toDateString());
        }
    }

    /**
     * Métricas KPI del inventario acotadas a la granja.
     */
    protected function computeStats(Request $request, $user): array
    {
        $base = InventoryItem::query();

        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?? $request->input('farmId');
            if ($farmId !== null && $farmId !== '' && strtolower(trim((string) $farmId)) !== 'all') {
                $base->where('farm_id', (int) $farmId);
            }
        } else {
            if (! $user->farm_id) {
                return $this->emptyStats();
            }
            $base->where('farm_id', (int) $user->farm_id);
        }

        $today = now()->toDateString();
        $limit = now()->addDays(InventoryItem::EXPIRING_SOON_DAYS)->toDateString();

        return [
            'total_items' => (int) (clone $base)->count(),
            'total_value' => round((float) (clone $base)->sum('total_cost'), 2),
            'low_stock' => (int) (clone $base)->lowStock()->count(),
            'over_stock' => (int) (clone $base)->overStock()->count(),
            'expiring' => (int) (clone $base)->whereNotNull('expiration_date')
                ->whereDate('expiration_date', '>=', $today)
                ->whereDate('expiration_date', '<=', $limit)->count(),
            'expired' => (int) (clone $base)->whereNotNull('expiration_date')
                ->whereDate('expiration_date', '<', $today)->count(),
        ];
    }

    protected function emptyStats(): array
    {
        return [
            'total_items' => 0,
            'total_value' => 0,
            'low_stock' => 0,
            'over_stock' => 0,
            'expiring' => 0,
            'expired' => 0,
        ];
    }

    /**
     * Enriquece el insumo con campos de presentación.
     */
    public function decorateItem(InventoryItem $item): array
    {
        // Nombres resueltos de los catálogos: si la relación fue cargada
        // se usa su `name`; si no, se cae al texto libre heredado.
        // Nota: se usa getRelation() porque la columna de texto `supplier`
        // colisiona con el nombre de la relación homónima.
        $supplierRelation = $item->relationLoaded('supplier') ? $item->getRelation('supplier') : null;
        $warehouseRelation = $item->relationLoaded('warehouse') ? $item->getRelation('warehouse') : null;
        $farmRelation = $item->relationLoaded('farm') ? $item->getRelation('farm') : null;

        $supplierName = $supplierRelation?->name ?? $item->getRawOriginal('supplier');
        $warehouseName = $warehouseRelation?->name ?? $item->getRawOriginal('location');
        $farmName = $farmRelation?->name ?? null;

        return array_merge($item->toArray(), [
            'category_label' => $item->categoryLabel(),
            'alert_flags' => $item->alertFlags(),
            'is_low_stock' => $item->isLowStock(),
            'is_over_stock' => $item->isOverStock(),
            'is_expired' => $item->isExpired(),
            'is_expiring_soon' => $item->isExpiringSoon(),
            'unit' => $item->unit,
            'unit_label' => $item->unitLabel(),
            'unit_short' => $item->unitShort(),
            // El frontend espera strings en `supplier`/`location`.
            'supplier' => $supplierName,
            'location' => $warehouseName,
            'supplier_name' => $supplierName,
            'warehouse_name' => $warehouseName,
            'farm_name' => $farmName,
            'farm' => $farmRelation ? ['id' => $farmRelation->id, 'name' => $farmRelation->name] : null,
            'supplier_id' => $item->supplier_id,
            'warehouse_id' => $item->warehouse_id,
        ]);
    }

    /**
     * Resuelve la granja destino (root debe indicarla; el resto usa la
     * suya). Devuelve null si no hay contexto válido.
     */
    protected function resolveFarmId(Request $request, $user): ?int
    {
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');

            return $farmId ? (int) $farmId : null;
        }

        return $user->farm_id ? (int) $user->farm_id : null;
    }

    /**
     * ¿Puede ver el insumo? (cualquier rol de la granja + root).
     */
    protected function canView($user, InventoryItem $item): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->isRoot()) {
            return true;
        }

        return (int) $item->farm_id === (int) $user->farm_id;
    }

    /**
     * ¿Puede editar/eliminar el insumo? (admin de la granja o root)
     */
    protected function canManage($user, InventoryItem $item): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->isRoot()) {
            return true;
        }

        return $user->isAdmin() && (int) $item->farm_id === (int) $user->farm_id;
    }

    /**
     * Limpia las notificaciones de stock mínimo del insumo eliminado.
     */
    protected function purgeItemNotifications(int $itemId, int $farmId): void
    {
        $userIds = DB::table('users')->where('farm_id', $farmId)->pluck('id');

        foreach ($userIds as $userId) {
            DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->where('notifiable_id', $userId)
                ->where('data', 'like', '%"inventory_item_id":'.$itemId.',%')
                ->delete();
        }
    }
}
