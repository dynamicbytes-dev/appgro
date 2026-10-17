<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\InventoryMovement;
use App\Models\Lot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Control de movimientos del módulo Inventario.
 *
 * Registra entradas, salidas y ajustes que mutan el stock del insumo.
 * Tanto el administrador como el subordinado (encargado) de la granja
 * pueden registrar movimientos; el responsable se toma
 * automáticamente del usuario autenticado.
 */
class InventoryMovementController extends Controller
{
    /**
     * Historial de movimientos de la granja, con filtros.
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

        $query = InventoryMovement::query()->with([
            'farm:id,name',
            'item:id,code,name,unit',
            'lot:id,code',
            'inventoryLot:id,code,expiration_date',
            'user:id,name,lastname',
        ]);

        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?? $request->input('farmId');
            if ($farmId !== null && $farmId !== '' && strtolower(trim((string) $farmId)) !== 'all') {
                $query->where('farm_id', (int) $farmId);
            }
        } else {
            if (! $user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }
            $query->where('farm_id', (int) $user->farm_id)->whereNotNull('farm_id');
        }

        if ($request->filled('type')) {
            if (! array_key_exists($request->type, InventoryMovement::TYPE_LABELS)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El tipo de movimiento no es válido.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $query->where('type', $request->type);
        }

        if ($request->filled('inventory_item_id')) {
            $query->where('inventory_item_id', (int) $request->inventory_item_id);
        }

        if ($request->filled('destination_lot_id')) {
            $query->where('destination_lot_id', (int) $request->destination_lot_id);
        }

        if ($request->filled('inventory_lot_id')) {
            $query->where('inventory_lot_id', (int) $request->inventory_lot_id);
        }

        if ($request->filled('from')) {
            $query->whereDate('movement_date', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->whereDate('movement_date', '<=', $request->to);
        }

        $movements = $query->orderByDesc('movement_date')
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->map(fn (InventoryMovement $m) => $this->decorateMovement($m))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Movimientos de inventario obtenidos con éxito.',
            'data' => $movements,
        ], Response::HTTP_OK);
    }

    /**
     * Registrar un movimiento (entrada, salida o ajuste).
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

        if (! $user->isRoot() && ! $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = Validator::make($request->all(), [
            'inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'],
            'type' => ['required', Rule::in(array_keys(InventoryMovement::TYPE_LABELS))],
            'quantity' => ['required', 'numeric'],
            'destination_lot_id' => ['nullable', 'integer', 'exists:lots,id'],
            'inventory_lot_id' => ['nullable', 'integer', 'exists:inventory_lots,id'],
            'notes' => ['nullable', 'string'],
        ], [
            'inventory_item_id.required' => 'Debe seleccionar el insumo a mover.',
            'inventory_item_id.exists' => 'El insumo seleccionado no existe.',
            'type.required' => 'El tipo de movimiento es obligatorio.',
            'type.in' => 'El tipo debe ser entrada, salida o ajuste.',
            'quantity.required' => 'La cantidad es obligatoria.',
            'quantity.numeric' => 'La cantidad debe ser numérica.',
            'destination_lot_id.exists' => 'El lote de destino no existe.',
            'inventory_lot_id.exists' => 'El lote de insumo seleccionado no existe.',
        ]);

        // El insumo debe pertenecer a la granja del usuario.
        $item = InventoryItem::find((int) $request->input('inventory_item_id'));

        if (! $item) {
            return response()->json([
                'status' => 'error',
                'message' => 'Insumo no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $validator->after(function ($v) use ($request, $item) {
            $type = $request->input('type');
            $quantity = (float) $request->input('quantity');

            if ($v->errors()->has('type') || $v->errors()->has('quantity')) {
                return;
            }

            if (in_array($type, [InventoryMovement::TYPE_ENTRY, InventoryMovement::TYPE_EXIT], true) && $quantity <= 0) {
                $v->errors()->add('quantity', 'La cantidad debe ser mayor que cero.');
            }

            if ($type === InventoryMovement::TYPE_ADJUST && $quantity == 0.0) {
                $v->errors()->add('quantity', 'El ajuste debe indicar una cantidad distinta de cero (puede ser negativa).');
            }

            if ($v->errors()->isNotEmpty()) {
                return;
            }

            $projected = InventoryMovement::projectedStock($item, (string) $type, $quantity);

            if ($projected < 0) {
                $v->errors()->add(
                    'quantity',
                    "Stock insuficiente: el movimiento dejaría el inventario en {$projected}. Stock actual: {$item->current_stock}."
                );
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // El lote de destino (animales) debe pertenecer a la misma granja.
        $lotId = $request->filled('destination_lot_id') ? (int) $request->destination_lot_id : null;

        if ($lotId) {
            $lot = Lot::find($lotId);

            if (! $lot || (int) $lot->farm_id !== (int) $item->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Error de validación de datos.',
                    'errors' => [
                        'destination_lot_id' => ['El lote de destino pertenece a otra granja.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        // El lote de insumo solo aplica a las entradas y debe pertenecer a la
        // misma granja (y al mismo insumo, o quedar libre para asignarse).
        $inventoryLot = null;
        $inventoryLotId = null;

        if ($request->input('type') === InventoryMovement::TYPE_ENTRY && $request->filled('inventory_lot_id')) {
            $inventoryLot = InventoryLot::withoutGlobalScopes()->find((int) $request->inventory_lot_id);

            if (! $inventoryLot || (int) $inventoryLot->farm_id !== (int) $item->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Error de validación de datos.',
                    'errors' => [
                        'inventory_lot_id' => ['El lote de insumo pertenece a otra granja.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if ($inventoryLot->inventory_item_id !== null
                && (int) $inventoryLot->inventory_item_id !== (int) $item->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Error de validación de datos.',
                    'errors' => [
                        'inventory_lot_id' => ['El lote de insumo corresponde a otro insumo.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            // Un lote libre se asigna al insumo al usarse (dentro de la
            // transacción del movimiento, más abajo).
            $inventoryLotId = (int) $inventoryLot->id;
        }

        $movement = DB::transaction(function () use ($request, $item, $user, $lotId, $inventoryLot, $inventoryLotId) {
            if ($inventoryLot && $inventoryLot->inventory_item_id === null) {
                $inventoryLot->inventory_item_id = $item->id;
                $inventoryLot->save();
            }

            return InventoryMovement::applyMovement($item, [
                'type' => $request->type,
                'quantity' => (float) $request->quantity,
                'destination_lot_id' => $lotId,
                'inventory_lot_id' => $inventoryLotId,
                'inventory_lot' => $inventoryLot,
                'notes' => $request->filled('notes') ? trim($request->notes) : null,
            ], (int) $user->id);
        });

        $movement->load(['item:id,code,name,unit', 'lot:id,code', 'inventoryLot:id,code,expiration_date', 'user:id,name,lastname']);

        return response()->json([
            'status' => 'success',
            'message' => 'Movimiento registrado correctamente.',
            'data' => $this->decorateMovement($movement),
            'item' => (new InventoryController())->decorateItem($item->fresh()),
        ], Response::HTTP_CREATED);
    }

    /**
     * Enriquece el movimiento con campos de presentación.
     */
    protected function decorateMovement(InventoryMovement $movement): array
    {
        $farmRelation = $movement->relationLoaded('farm') ? $movement->getRelation('farm') : null;

        return array_merge($movement->toArray(), [
            'type_label' => $movement->typeLabel(),
            'stock_effect' => $movement->stockEffect(),
            'item_name' => $movement->item?->name,
            'item_code' => $movement->item?->code,
            'unit' => $movement->item?->unit,
            'unit_short' => $movement->item?->unitShort(),
            'lot_code' => $movement->lot?->code,
            'inventory_lot_id' => $movement->inventory_lot_id,
            'inventory_lot_code' => $movement->inventoryLot?->code,
            'inventory_lot_label' => $movement->inventoryLot?->label(),
            'farm_name' => $farmRelation?->name,
            'farm' => $farmRelation ? ['id' => $farmRelation->id, 'name' => $farmRelation->name] : null,
            'responsible_name' => $movement->user
                ? trim(($movement->user->name ?? '').' '.($movement->user->lastname ?? ''))
                : null,
        ]);
    }
}
