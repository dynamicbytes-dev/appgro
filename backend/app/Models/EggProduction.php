<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Model;

/**
 * Registro histórico de producción de huevos de un lote.
 *
 * Cada llamada a "Recoger Huevos" persiste una fila con la fecha y el
 * desglose de huevos buenos/rotos, habilitando la serie temporal de
 * mermas del módulo de Analítica (que `lots`, al ser acumulativo, no
 * puede ofrecer).
 *
 * Convención:
 *  - `good_eggs`   → huevos completos (buenos).
 *  - `broken_eggs` → huevos rotos (mermas), valor independiente.
 *  - `good_cost`   = good_eggs × egg_price.
 *  - `broken_cost` = broken_eggs × egg_price.
 */
class EggProduction extends Model
{
    use Auditable, BelongsToFarm;

    protected $table = 'egg_productions';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'farm_id',
        'lot_id',
        'production_date',
        'good_eggs',
        'broken_eggs',
        'egg_price',
        'good_cost',
        'broken_cost',
        'created_by',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'lot_id' => 'integer',
        'production_date' => 'date',
        'good_eggs' => 'integer',
        'broken_eggs' => 'integer',
        'egg_price' => 'decimal:2',
        'good_cost' => 'decimal:2',
        'broken_cost' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Lotes';
    }

    /**
     * Descripción legible para el historial de auditoría.
     */
    public function getAuditDescription(string $action): string
    {
        return match ($action) {
            'CREAR' => "Se registró producción de huevos ({$this->good_eggs} buenos / {$this->broken_eggs} rotos) en el lote #{$this->lot_id}.",
            'ACTUALIZAR' => "Se actualizó la producción de huevos del lote #{$this->lot_id}.",
            'ELIMINAR' => "Se eliminó la producción de huevos del lote #{$this->lot_id}.",
            default => "Acción {$action} ejecutada sobre la producción de huevos del lote #{$this->lot_id}.",
        };
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    public function lot()
    {
        return $this->belongsTo(Lot::class, 'lot_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Total recolectado (buenos + rotos).
     */
    public function totalEggs(): int
    {
        return (int) $this->good_eggs + (int) $this->broken_eggs;
    }

    /**
     * Costo total del registro (buenos + rotos).
     */
    public function totalCost(): float
    {
        return round((float) $this->good_cost + (float) $this->broken_cost, 2);
    }
}
