<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\InventorySupplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Catálogo de lotes de insumos del módulo Inventario.
 *
 * A diferencia de los proveedores/bodegas, los lotes se crean durante la
 * operación (al registrar una entrada), por lo que cualquier usuario de la
 * granja puede listarlos y crearlos. La edición y el borrado quedan
 * reservados al administrador de la granja y al root.
 */
class InventoryLotController extends Controller
{
    /**
     * Listado de lotes de insumos de la granja.
     */
    public function index(Request $request)
    {
        $user = $this->currentUser();

        if (! $user) {
            return $this->error('Usuario no autenticado.', Response::HTTP_UNAUTHORIZED);
        }

        $query = InventoryLot::query()->with([
            'item:id,code,name,unit',
            'supplier:id,name',
            'creator:id,name,lastname',
        ]);

        if ($user->isRoot()) {
            if ($request->filled('farm_id') && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $query->where('farm_id', (int) $request->farm_id);
            }
        } else {
            if (! $user->farm_id) {
                return $this->error('Usuario sin granja asignada.', Response::HTTP_FORBIDDEN);
            }

            $query->where('farm_id', (int) $user->farm_id);
        }

        // Lotes de un insumo concreto, incluyendo los aún no asignados.
        if ($request->filled('inventory_item_id')) {
            $itemId = (int) $request->inventory_item_id;

            $query->where(function ($q) use ($itemId) {
                $q->where('inventory_item_id', $itemId)
                    ->orWhereNull('inventory_item_id');
            });
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where('code', 'like', $term);
        }

        $data = $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->map(fn (InventoryLot $lot) => $this->decorate($lot))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Lotes de insumos obtenidos con éxito.',
            'data' => $data,
        ], Response::HTTP_OK);
    }

    /**
     * Registrar un lote de insumo.
     */
    public function store(Request $request)
    {
        $user = $this->currentUser();

        if (! $user) {
            return $this->error('Usuario no autenticado.', Response::HTTP_UNAUTHORIZED);
        }

        $farmId = $this->resolveFarmId($request, $user);

        if (! $farmId) {
            return $this->error(
                'Debe especificar la granja (farm_id) para registrar el lote.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $validator = Validator::make($request->all(), [
            'code' => [
                'nullable', 'string', 'max:60',
                Rule::unique('inventory_lots', 'code')
                    ->where(fn ($query) => $query->where('farm_id', $farmId)),
            ],
            'inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:inventory_suppliers,id'],
            'manufacturing_date' => ['nullable', 'date'],
            'expiration_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'code.unique' => 'Ya existe un lote con ese código en la granja.',
            'inventory_item_id.exists' => 'El insumo seleccionado no existe.',
            'supplier_id.exists' => 'El proveedor seleccionado no existe.',
            'manufacturing_date.date' => 'La fecha de fabricación no es válida.',
            'expiration_date.date' => 'La fecha de vencimiento no es válida.',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $itemId = $request->filled('inventory_item_id') ? (int) $request->inventory_item_id : null;

        if ($itemId) {
            $item = InventoryItem::withoutGlobalScopes()->find($itemId);

            if (! $item || (int) $item->farm_id !== $farmId) {
                return $this->validationError([
                    'inventory_item_id' => ['El insumo pertenece a otra granja.'],
                ]);
            }
        }

        $supplierId = $request->filled('supplier_id') ? (int) $request->supplier_id : null;

        if ($supplierId) {
            $supplier = InventorySupplier::withoutGlobalScopes()->find($supplierId);

            if (! $supplier || (int) $supplier->farm_id !== $farmId) {
                return $this->validationError([
                    'supplier_id' => ['El proveedor pertenece a otra granja.'],
                ]);
            }
        }

        $code = trim((string) $request->input('code'));

        if ($code === '') {
            $code = InventoryLot::generateCode($farmId);
        }

        $lot = InventoryLot::create([
            'farm_id' => $farmId,
            'inventory_item_id' => $itemId,
            'code' => $code,
            'supplier_id' => $supplierId,
            'manufacturing_date' => $request->filled('manufacturing_date') ? $request->input('manufacturing_date') : null,
            'expiration_date' => $request->filled('expiration_date') ? $request->input('expiration_date') : null,
            'notes' => $request->filled('notes') ? trim($request->notes) : null,
            'created_by' => $user->id,
        ]);

        $lot->load(['item:id,code,name,unit', 'supplier:id,name', 'creator:id,name,lastname']);

        return response()->json([
            'status' => 'success',
            'message' => 'Lote de insumo registrado correctamente.',
            'data' => $this->decorate($lot),
        ], Response::HTTP_CREATED);
    }

    /**
     * Actualizar un lote de insumo (solo admin de la granja o root).
     */
    public function update(Request $request, $id)
    {
        $user = $this->currentUser();
        $lot = InventoryLot::find($id);

        if (! $lot) {
            return $this->error('Lote de insumo no encontrado o sin acceso.', Response::HTTP_NOT_FOUND);
        }

        if (! $this->canManage($user, $lot)) {
            return $this->error(
                'Acceso denegado: solo el administrador de la granja puede editar lotes de insumos.',
                Response::HTTP_FORBIDDEN
            );
        }

        $farmId = (int) $lot->farm_id;

        $validator = Validator::make($request->all(), [
            'code' => [
                'nullable', 'string', 'max:60',
                Rule::unique('inventory_lots', 'code')
                    ->where(fn ($query) => $query->where('farm_id', $farmId))
                    ->ignore($lot->id),
            ],
            'inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:inventory_suppliers,id'],
            'manufacturing_date' => ['nullable', 'date'],
            'expiration_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'code.unique' => 'Ya existe un lote con ese código en la granja.',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        if ($request->has('code') && trim((string) $request->input('code')) !== '') {
            $lot->code = trim((string) $request->input('code'));
        }

        if ($request->has('inventory_item_id')) {
            $itemId = $request->filled('inventory_item_id') ? (int) $request->inventory_item_id : null;

            if ($itemId) {
                $item = InventoryItem::withoutGlobalScopes()->find($itemId);

                if (! $item || (int) $item->farm_id !== $farmId) {
                    return $this->validationError([
                        'inventory_item_id' => ['El insumo pertenece a otra granja.'],
                    ]);
                }
            }

            $lot->inventory_item_id = $itemId;
        }

        if ($request->has('supplier_id')) {
            $supplierId = $request->filled('supplier_id') ? (int) $request->supplier_id : null;

            if ($supplierId) {
                $supplier = InventorySupplier::withoutGlobalScopes()->find($supplierId);

                if (! $supplier || (int) $supplier->farm_id !== $farmId) {
                    return $this->validationError([
                        'supplier_id' => ['El proveedor pertenece a otra granja.'],
                    ]);
                }
            }

            $lot->supplier_id = $supplierId;
        }

        if ($request->has('manufacturing_date')) {
            $lot->manufacturing_date = $request->filled('manufacturing_date') ? $request->input('manufacturing_date') : null;
        }

        if ($request->has('expiration_date')) {
            $lot->expiration_date = $request->filled('expiration_date') ? $request->input('expiration_date') : null;
        }

        if ($request->has('notes')) {
            $lot->notes = $request->filled('notes') ? trim($request->notes) : null;
        }

        $lot->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Lote de insumo actualizado correctamente.',
            'data' => $this->decorate($lot->fresh()->load(['item:id,code,name,unit', 'supplier:id,name'])),
        ], Response::HTTP_OK);
    }

    /**
     * Eliminar un lote de insumo (solo admin de la granja o root).
     */
    public function destroy($id)
    {
        $user = $this->currentUser();
        $lot = InventoryLot::find($id);

        if (! $lot) {
            return $this->error('Lote de insumo no encontrado o sin acceso.', Response::HTTP_NOT_FOUND);
        }

        if (! $this->canManage($user, $lot)) {
            return $this->error(
                'Acceso denegado: solo el administrador de la granja puede eliminar lotes de insumos.',
                Response::HTTP_FORBIDDEN
            );
        }

        DB::transaction(function () use ($lot) {
            // Desenlaza los movimientos que referenciaban el lote.
            DB::table('inventory_movements')
                ->where('inventory_lot_id', $lot->id)
                ->update(['inventory_lot_id' => null]);

            $lot->delete();
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Lote de insumo eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /* ----------------------------------------------------------------- */
    /* Helpers                                                            */
    /* ----------------------------------------------------------------- */

    protected function currentUser()
    {
        return Auth::guard('api')->user() ?? Auth::user();
    }

    protected function resolveFarmId(Request $request, $user): ?int
    {
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');

            return $farmId ? (int) $farmId : null;
        }

        return $user->farm_id ? (int) $user->farm_id : null;
    }

    protected function canManage($user, InventoryLot $lot): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->isRoot()) {
            return true;
        }

        return $user->isAdmin() && (int) $lot->farm_id === (int) $user->farm_id;
    }

    /**
     * Enriquece el lote con campos de presentación.
     */
    protected function decorate(InventoryLot $lot): array
    {
        return array_merge($lot->toArray(), [
            'label' => $lot->label(),
            'item_code' => $lot->item?->code,
            'item_name' => $lot->item?->name,
            'item_unit' => $lot->item?->unit,
            'supplier_name' => $lot->supplier?->name,
            'is_expired' => $lot->isExpired(),
            'is_expiring_soon' => $lot->isExpiringSoon(),
        ]);
    }

    protected function error(string $message, int $status)
    {
        return response()->json(['status' => 'error', 'message' => $message], $status);
    }

    protected function validationError($errors)
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Error de validación de datos.',
            'errors' => $errors,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
