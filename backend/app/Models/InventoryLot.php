<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Lote de insumo (partida / recepción de mercancía) del módulo Inventario.
 *
 * Es el catálogo propio de Inventario para identificar el lote con el que
 * ingresa un insumo. Es independiente del módulo Lotes (lotes de animales):
 * las **entradas** se asocian a un lote de insumo (`inventory_lot_id` en el
 * movimiento) mientras que las **salidas** siguen usando el lote de animales
 * como destino de consumo.
 *
 *  - `code`              → identificador legible, único por granja.
 *  - `inventory_item_id` → insumo al que pertenece (puede quedar libre y se
 *                          asigna al usarlo en una entrada).
 *  - `supplier_id`       → proveedor que despachó el lote (opcional).
 */
class InventoryLot extends Model
{
    use Auditable, BelongsToFarm;

    protected $table = 'inventory_lots';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    /** Días de antelación con los que se marca un lote "por vencer". */
    public const EXPIRING_SOON_DAYS = 15;

    /** Prefijo del código autogenerado. */
    public const CODE_PREFIX = 'LOTE-';

    protected $fillable = [
        'farm_id',
        'inventory_item_id',
        'code',
        'supplier_id',
        'manufacturing_date',
        'expiration_date',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'inventory_item_id' => 'integer',
        'supplier_id' => 'integer',
        'manufacturing_date' => 'date',
        'expiration_date' => 'date',
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
        return match ($action) {
            'CREAR' => "Se registró el lote de insumo '{$this->code}' en Inventario.",
            'ACTUALIZAR' => "Se actualizó el lote de insumo '{$this->code}' en Inventario.",
            'ELIMINAR' => "Se eliminó el lote de insumo '{$this->code}' en Inventario.",
            default => "Acción {$action} ejecutada sobre el lote de insumo '{$this->code}' en Inventario.",
        };
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * Insumo al que pertenece el lote (puede ser nulo si aún no se asignó).
     */
    public function item()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    /**
     * Proveedor que despachó el lote.
     */
    public function supplier()
    {
        return $this->belongsTo(InventorySupplier::class, 'supplier_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class, 'inventory_lot_id');
    }

    /**
     * ¿La fecha de vencimiento del lote ya pasó?
     */
    public function isExpired(): bool
    {
        return $this->expiration_date
            && $this->expiration_date->lt(now()->startOfDay());
    }

    /**
     * ¿Vence dentro de los próximos `$days` días (aún no vencido)?
     */
    public function isExpiringSoon(int $days = self::EXPIRING_SOON_DAYS): bool
    {
        if (! $this->expiration_date) {
            return false;
        }

        $today = now()->startOfDay();

        return $this->expiration_date->greaterThanOrEqualTo($today)
            && $this->expiration_date->lessThanOrEqualTo($today->copy()->addDays($days));
    }

    /**
     * Etiqueta corta para los selectores (código + vencimiento).
     */
    public function label(): string
    {
        $suffix = $this->expiration_date
            ? ' · vence '.$this->expiration_date->format('d/m/Y')
            : '';

        return $this->code.$suffix;
    }

    /**
     * Genera un código único por granja con formato LOTE-XXXXX, basado en
     * el mayor correlativo existente + 1.
     */
    public static function generateCode(int $farmId): string
    {
        $prefix = self::CODE_PREFIX;
        $max = 0;

        $codes = DB::table('inventory_lots')
            ->where('farm_id', $farmId)
            ->where('code', 'LIKE', $prefix.'%')
            ->pluck('code');

        foreach ($codes as $code) {
            if (preg_match('/^LOTE-(\d+)$/', (string) $code, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return $prefix.str_pad($max + 1, 5, '0', STR_PAD_LEFT);
    }
}
