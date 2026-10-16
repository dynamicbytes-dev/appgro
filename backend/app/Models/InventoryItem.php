<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use App\Notifications\LowStockNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Insumo del inventario de la granja.
 *
 * El stock (`current_stock`) NO se edita directamente desde el
 * formulario después de crear el insumo: se mueve con registros de
 * `inventory_movements` (entrada / salida / ajuste).
 *
 *  - `min_stock` → umbral que dispara la alerta de compra.
 *  - `max_stock` → umbral que advierte sobre-stock / merma.
 *  - `total_cost` → calculado: `unit_cost × current_stock`.
 */
class InventoryItem extends Model
{
    use Auditable, BelongsToFarm;

    protected $table = 'inventory_items';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    /** Categorías oficiales de insumos. */
    public const CATEGORY_ALIMENTOS = 'alimentos_nutricion';
    public const CATEGORY_SANIDAD = 'sanidad_bioseguridad';
    public const CATEGORY_INFRAESTRUCTURA = 'infraestructura_repuestos';
    public const CATEGORY_AGRICOLAS = 'insumos_agricolas';
    public const CATEGORY_EMPAQUE = 'insumos_empaque_operativos';

    /** Etiquetas legibles de cada categoría. */
    public const CATEGORY_LABELS = [
        self::CATEGORY_ALIMENTOS => 'Alimentos y nutrición animal',
        self::CATEGORY_SANIDAD => 'Sanidad y bioseguridad',
        self::CATEGORY_INFRAESTRUCTURA => 'Infraestructura, equipamiento y repuestos',
        self::CATEGORY_AGRICOLAS => 'Insumos agrícolas',
        self::CATEGORY_EMPAQUE => 'Insumos de empaque y operativos',
    ];

    /** Días de antelación con los que se marca "por vencer". */
    public const EXPIRING_SOON_DAYS = 15;

    /** Unidades de medida oficiales (código => etiqueta). */
    public const UNITS = [
        'kg' => 'Kilogramo',
        'g' => 'Gramo',
        'cc' => 'Centímetro cúbico',
        'L' => 'Litro',
        'ml' => 'Mililitro',
        'unidad' => 'Unidad',
        'dosis' => 'Dosis',
        'saco' => 'Saco',
        'funda' => 'Funda',
        'caja' => 'Caja',
        'rollo' => 'Rollo',
        'par' => 'Par',
    ];

    /** Abreviatura de cada unidad para mostrar junto a las cantidades. */
    public const UNIT_SHORT = [
        'kg' => 'kg',
        'g' => 'g',
        'cc' => 'cc',
        'L' => 'L',
        'ml' => 'ml',
        'unidad' => 'und',
        'dosis' => 'dosis',
        'saco' => 'saco',
        'funda' => 'funda',
        'caja' => 'caja',
        'rollo' => 'rollo',
        'par' => 'par',
    ];

    /** Valor por defecto si no se especifica unidad. */
    protected $attributes = [
        'unit' => 'kg',
    ];

    protected $fillable = [
        'farm_id',
        'code',
        'name',
        'category',
        'unit',
        'current_stock',
        'min_stock',
        'max_stock',
        'batch_number',
        'manufacturing_date',
        'expiration_date',
        'location',
        'warehouse_id',
        'unit_cost',
        'total_cost',
        'supplier',
        'supplier_id',
        'last_purchase_date',
        'low_stock_alerted_at',
        'created_by',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'warehouse_id' => 'integer',
        'supplier_id' => 'integer',
        'current_stock' => 'decimal:2',
        'min_stock' => 'decimal:2',
        'max_stock' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'manufacturing_date' => 'date',
        'expiration_date' => 'date',
        'last_purchase_date' => 'date',
        'low_stock_alerted_at' => 'datetime',
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
            'CREAR' => "Se ha creado el insumo '{$this->name}' ({$this->code}) en Inventario.",
            'ACTUALIZAR' => "Se ha actualizado el insumo '{$this->name}' ({$this->code}) en Inventario.",
            'ELIMINAR' => "Se ha eliminado el insumo '{$this->name}' ({$this->code}) en Inventario.",
            default => "Acción {$action} ejecutada sobre el insumo '{$this->name}' en Inventario.",
        };
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Proveedor principal del insumo (catálogo de proveedores).
     */
    public function supplier()
    {
        return $this->belongsTo(InventorySupplier::class, 'supplier_id');
    }

    /**
     * Bodega / ubicación física donde se almacena el insumo.
     */
    public function warehouse()
    {
        return $this->belongsTo(InventoryWarehouse::class, 'warehouse_id');
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class)->orderByDesc('created_at');
    }

    /**
     * Código legible de la categoría.
     */
    public function categoryLabel(): string
    {
        return self::CATEGORY_LABELS[$this->category] ?? $this->category;
    }

    /**
     * Etiqueta legible de la unidad de medida (p. ej. «Kilogramo»).
     */
    public function unitLabel(): string
    {
        return self::UNITS[$this->unit] ?? (string) $this->unit;
    }

    /**
     * Abreviatura de la unidad (p. ej. «kg») para la UI.
     */
    public function unitShort(): string
    {
        return self::UNIT_SHORT[$this->unit] ?? (string) $this->unit;
    }

    /**
     * ¿El stock está en o por debajo del mínimo configurado?
     * (el mínimo debe ser mayor que 0 para considerarse configurado).
     */
    public function isLowStock(): bool
    {
        return (float) $this->min_stock > 0
            && (float) $this->current_stock <= (float) $this->min_stock;
    }

    /**
     * ¿El stock supera el máximo configurado?
     */
    public function isOverStock(): bool
    {
        return $this->max_stock !== null
            && (float) $this->max_stock > 0
            && (float) $this->current_stock > (float) $this->max_stock;
    }

    /**
     * ¿La fecha de vencimiento ya pasó?
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
     * Etiquetas de alerta calculadas (para badges del frontend).
     *
     * @return array<int, string>
     */
    public function alertFlags(): array
    {
        $flags = [];

        if ($this->isLowStock()) {
            $flags[] = 'bajo_minimo';
        }

        if ($this->isOverStock()) {
            $flags[] = 'sobre_stock';
        }

        if ($this->isExpired()) {
            $flags[] = 'vencido';
        } elseif ($this->isExpiringSoon()) {
            $flags[] = 'por_vencer';
        }

        return $flags;
    }

    /**
     * Recalcula `total_cost` = costo unitario × stock actual.
     */
    public function syncTotalCost(): void
    {
        $this->total_cost = round((float) $this->unit_cost * (float) $this->current_stock, 2);
    }

    /**
     * Evalúa la alerta de stock mínimo tras un cambio de stock:
     *  - Si cruzó el mínimo y no se había avisado → notifica a los
     *    administradores activos de la granja y marca la alerta.
     *  - Si volvió por encima del mínimo → limpia la marca para poder
     *    avisar de nuevo en el futuro.
     */
    public function evaluateLowStockAlert(): void
    {
        if ($this->isLowStock()) {
            if ($this->low_stock_alerted_at !== null) {
                return;
            }

            $this->low_stock_alerted_at = now();
            $this->save();

            $admins = User::query()
                ->where('farm_id', $this->farm_id)
                ->where('role', 'admin')
                ->where('is_active', true)
                ->get();

            foreach ($admins as $admin) {
                $admin->notify(new LowStockNotification($this));
            }

            return;
        }

        if ($this->low_stock_alerted_at !== null) {
            $this->low_stock_alerted_at = null;
            $this->save();
        }
    }

    /**
     * Insumos con stock en o por debajo del mínimo.
     */
    public function scopeLowStock($query)
    {
        return $query->where('min_stock', '>', 0)
            ->whereColumn('current_stock', '<=', 'min_stock');
    }

    /**
     * Insumos con stock por encima del máximo.
     */
    public function scopeOverStock($query)
    {
        return $query->whereNotNull('max_stock')
            ->where('max_stock', '>', 0)
            ->whereColumn('current_stock', '>', 'max_stock');
    }

    /**
     * Insumos vencidos o por vencer dentro de `$days` días.
     */
    public function scopeExpiring($query, int $days = self::EXPIRING_SOON_DAYS)
    {
        return $query->whereNotNull('expiration_date')
            ->whereDate('expiration_date', '<=', now()->addDays($days)->toDateString());
    }

    /**
     * Genera un código único e irrepetible por granja con formato
     * INS-XXXXX, basado en el mayor correlativo existente + 1.
     */
    public static function generateCode(int $farmId): string
    {
        $prefix = 'INS-';
        $max = 0;

        $codes = DB::table('inventory_items')
            ->where('farm_id', $farmId)
            ->where('code', 'LIKE', $prefix.'%')
            ->pluck('code');

        foreach ($codes as $code) {
            if (preg_match('/^INS-(\d+)$/', (string) $code, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return $prefix.str_pad($max + 1, 5, '0', STR_PAD_LEFT);
    }
}
