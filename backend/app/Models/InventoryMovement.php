<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Model;

/**
 * Movimiento de inventario: entrada, salida o ajuste de un insumo.
 *
 * Cada movimiento muta el `current_stock` del insumo referenciado y
 * deja una foto del stock resultante (`resulting_stock`) para
 * auditoría. El responsable queda registrado automáticamente desde el
 * usuario autenticado (`user_id`).
 *
 * Convención de `quantity`:
 *  - `entrada` → cantidad positiva (se suma al stock).
 *  - `salida`  → cantidad positiva (se resta del stock).
 *  - `ajuste`  → cantidad CON SIGNO (+/-), se suma tal cual.
 */
class InventoryMovement extends Model
{
    use Auditable, BelongsToFarm;

    protected $table = 'inventory_movements';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public const TYPE_ENTRY = 'entrada';
    public const TYPE_EXIT = 'salida';
    public const TYPE_ADJUST = 'ajuste';

    /** Etiquetas legibles de cada tipo de movimiento. */
    public const TYPE_LABELS = [
        self::TYPE_ENTRY => 'Entrada',
        self::TYPE_EXIT => 'Salida',
        self::TYPE_ADJUST => 'Ajuste',
    ];

    protected $fillable = [
        'farm_id',
        'inventory_item_id',
        'type',
        'quantity',
        'resulting_stock',
        'destination_lot_id',
        'notes',
        'movement_date',
        'user_id',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'inventory_item_id' => 'integer',
        'quantity' => 'decimal:2',
        'resulting_stock' => 'decimal:2',
        'destination_lot_id' => 'integer',
        'user_id' => 'integer',
        'movement_date' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Inventario';
    }

    /**
     * Descripción legible para el historial de auditoría.
     */
    public function getAuditDescription(string $action): string
    {
        $typeLabel = self::TYPE_LABELS[$this->type] ?? $this->type;

        return match ($action) {
            'CREAR' => "Se registró un movimiento de {$typeLabel} en Inventario.",
            'ACTUALIZAR' => "Se actualizó un movimiento de {$typeLabel} en Inventario.",
            'ELIMINAR' => "Se eliminó un movimiento de {$typeLabel} en Inventario.",
            default => "Acción {$action} ejecutada sobre un movimiento de Inventario.",
        };
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    public function item()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function lot()
    {
        return $this->belongsTo(Lot::class, 'destination_lot_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Etiqueta legible del tipo de movimiento.
     */
    public function typeLabel(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }

    /**
     * Efecto real sobre el stock (firmado): + en entrada, - en salida
     * y el propio signo en ajuste.
     */
    public function stockEffect(): float
    {
        return match ($this->type) {
            self::TYPE_ENTRY => abs((float) $this->quantity),
            self::TYPE_EXIT => -abs((float) $this->quantity),
            default => (float) $this->quantity,
        };
    }

    /**
     * Stock que quedaría tras aplicar el movimiento (sin persistir).
     */
    public static function projectedStock(InventoryItem $item, string $type, float $quantity): float
    {
        $effect = match ($type) {
            self::TYPE_ENTRY => abs($quantity),
            self::TYPE_EXIT => -abs($quantity),
            default => $quantity,
        };

        return round((float) $item->current_stock + $effect, 2);
    }

    /**
     * Aplica un movimiento: muta el stock del insumo, recalcula el
     * costo total, registra el movimiento y evalúa la alerta de stock
     * mínimo. Debe invocarse dentro de una transacción y tras validar
     * que el stock resultante no sea negativo.
     *
     * @param  array{type: string, quantity: float|int|string, destination_lot_id?: int|null, notes?: string|null}  $data
     */
    public static function applyMovement(InventoryItem $item, array $data, int $userId): self
    {
        $type = $data['type'];
        $quantity = (float) $data['quantity'];

        $resultingStock = self::projectedStock($item, $type, $quantity);

        $item->current_stock = $resultingStock;

        // La entrada marca la última fecha de compra del insumo.
        if ($type === self::TYPE_ENTRY) {
            $item->last_purchase_date = now()->toDateString();
        }

        $item->syncTotalCost();
        $item->save();

        $movement = self::create([
            'farm_id' => $item->farm_id,
            'inventory_item_id' => $item->id,
            'type' => $type,
            'quantity' => $quantity,
            'resulting_stock' => $resultingStock,
            'destination_lot_id' => $data['destination_lot_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'movement_date' => now(),
            'user_id' => $userId,
        ]);

        // Dispara o limpia la alerta de stock mínimo según corresponda.
        $item->evaluateLowStockAlert();

        return $movement;
    }
}
