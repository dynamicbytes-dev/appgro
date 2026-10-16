<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Lot extends Model
{
    use Auditable, BelongsToFarm, HasFactory;

    protected $table = 'lots';

    const CREATED_AT = 'created_at';

    const UPDATED_AT = 'updated_at';

    public const STATUS_ACTIVE = 'activo';

    public const STATUS_INACTIVE = 'inactivo';

    /**
     * Estados de animales que Ocupan espacio en el
     * galpón (en producción). Solo las salidas
     * definitivas (cosechado / vendido / descartado /
     * muerto) dejan de ocupar.
     */
    public const ANIMALS_IN_PRODUCTION_STATUSES = [
        LoteAnimal::STATUS_ACTIVE,
        LoteAnimal::STATUS_GESTATION,
        LoteAnimal::STATUS_WEANED,
    ];

    protected $fillable = [
        'farm_id',
        'galpon_id',
        'barn_id',
        'code',
        'species_id',
        'sector',
        'purpose',
        'quantity',
        'status',
        'entry_date',
        'harvest_date',
        'avg_weight',
        'total_weight',
        'price_per_kg',
        'total_price',
        'total_eggs',
        'broken_eggs',
        'egg_price',
        'total_egg_cost',
        'total_broken_cost',
        'investment_cost',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'galpon_id' => 'integer',
        'barn_id' => 'integer',
        'species_id' => 'integer',
        'quantity' => 'integer',
        'entry_date' => 'date',
        'harvest_date' => 'date',
        'avg_weight' => 'decimal:2',
        'total_weight' => 'decimal:2',
        'price_per_kg' => 'decimal:2',
        'total_price' => 'decimal:2',
        'total_eggs' => 'integer',
        'broken_eggs' => 'integer',
        'egg_price' => 'decimal:2',
        'total_egg_cost' => 'decimal:2',
        'total_broken_cost' => 'decimal:2',
        'investment_cost' => 'decimal:2',
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

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    public function galpon()
    {
        return $this->belongsTo(Galpon::class, 'galpon_id');
    }

    public function barn()
    {
        return $this->belongsTo(Barn::class);
    }

    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    public function animals()
    {
        return $this->hasMany(LoteAnimal::class, 'lote_id');
    }

    /**
     * Historial de producción de huevos del lote (serie temporal).
     */
    public function eggProductions()
    {
        return $this->hasMany(EggProduction::class, 'lot_id')->orderBy('production_date');
    }

    /**
     * Costo total de inversión + producción de huevos del lote.
     *
     * No incluye insumos consumidos: `inventory_movements` no se
     * relaciona con lotes de animales, por lo que ese costo solo se
     * puede agregar a nivel de granja.
     */
    public function totalProductionCost(): float
    {
        return round(
            (float) ($this->investment_cost ?? 0)
                + (float) ($this->total_egg_cost ?? 0)
                + (float) ($this->total_broken_cost ?? 0),
            2
        );
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Cupo ocupado por los lotes activos de un galpón.
     * Solo los lotes activos consumen capacidad: al cosechar
     * (status inactivo) el cupo se libera automáticamente.
     */
    public static function occupiedCapacity(int $galponId): int
    {
        return (int) static::query()
            ->where('galpon_id', $galponId)
            ->where('status', self::STATUS_ACTIVE)
            ->sum('quantity');
    }

    /**
     * Cantidad actual de animales que ocupan espacio en
     * el lote: activos + gestantes + destetados.
     *
     * Un animal en gestación SIGUE ocupando su lugar en
     * el galpón, por lo que cuenta como ocupante; únicamente
     * las salidas definitivas (cosechado / vendido /
     * descartado / muerto) dejan de ocupar.
     *
     * A diferencia del contador `quantity` —que reserva
     * cupo en el galpón—, este accesor se calcula sobre
     * los registros reales de `lote_animals`.
     */
    public function currentOccupancy(): int
    {
        $query = $this->animals();

        // Lotes sin seguimiento individual (ej. engorde):
        // la ocupación la define la cantidad declarada.
        if ((clone $query)->count() === 0) {
            return (int) $this->quantity;
        }

        return (int) $query->whereIn('status', self::ANIMALS_IN_PRODUCTION_STATUSES)->count();
    }

    /**
     * Carga masiva de `current_occupancy` en una colección
     * de lotes con consultas agrupadas (sin N+1).
     */
    public static function loadCurrentOccupancy(Collection $lots): void
    {
        if ($lots->isEmpty()) {
            return;
        }

        $ids = $lots->pluck('id')->all();

        $totals = LoteAnimal::whereIn('lote_id', $ids)
            ->groupBy('lote_id')
            ->pluck(DB::raw('COUNT(*) as total'), 'lote_id');

        $inProduction = LoteAnimal::whereIn('lote_id', $ids)
            ->whereIn('status', self::ANIMALS_IN_PRODUCTION_STATUSES)
            ->groupBy('lote_id')
            ->pluck(DB::raw('COUNT(*) as total'), 'lote_id');

        $lots->each(function ($lot) use ($totals, $inProduction) {
            $hasAnimalRecords = (int) ($totals[$lot->id] ?? 0) > 0;

            $lot->setAttribute(
                'current_occupancy',
                $hasAnimalRecords
                    ? (int) ($inProduction[$lot->id] ?? 0)
                    : (int) $lot->quantity
            );
        });
    }

    /**
     * Carga masiva del costo total de cosecha por lote.
     *
     * Prioriza la suma de `sale_total_price` de CADA animal
     * individual que salió de producción (cosechado / vendido /
     * descartado / muerto) con costo registrado. Si el lote no tiene
     * animales cosechados individualmente, usa el `total_price` a
     * nivel de lote (cosecha general del endpoint harvest).
     *
     * Así se evita el DOBLE CONTEO cuando ambos valores están
     * presentes (ej. venta individual + total a nivel de lote), y el
     * valor coincide con el "Resumen de Cosecha" del modal detallado.
     * Los lotes sin cosechas → 0.
     *
     * Para lotes AVÍCOLAS DE POSTURA se suma además el acumulado
     * del costo de producción de huevos (`total_egg_cost`), de modo
     * que el "Costo Total de Cosecha" refleje también lo registrado
     * vía "Recoger Huevos". En lotes de carne/reproducción ese
     * valor es 0 y no altera el cálculo.
     */
    public static function loadHarvestCost(Collection $lots): void
    {
        if ($lots->isEmpty()) {
            return;
        }

        $costs = LoteAnimal::whereIn('lote_id', $lots->pluck('id')->all())
            ->whereIn('status', ['cosechado', 'vendido', 'descartado', 'muerto'])
            ->whereNotNull('sale_total_price')
            ->groupBy('lote_id')
            ->pluck(DB::raw('SUM(sale_total_price) as total'), 'lote_id');

        $lots->each(function ($lot) use ($costs) {
            $individual = (float) ($costs[$lot->id] ?? 0);
            $lotLevel = (float) ($lot->total_price ?? 0);

            // Costo animal / venta (carne, reproducción).
            $animalCost = $individual > 0 ? $individual : $lotLevel;

            // Lotes avícolas de postura: además del costo animal,
            // se suma el acumulado de la producción de huevos
            // registrado vía "Recoger Huevos" (total_egg_cost).
            // En lotes de carne/reproducción este valor es 0, por
            // lo que no altera el cálculo existente.
            $eggCost = (float) ($lot->total_egg_cost ?? 0);

            $lot->setAttribute('harvest_cost', round($animalCost + $eggCost, 2));
        });
    }

    /**
     * Genera un código único e irrepetible con formato LOT-XXXXX.
     * Se basa en el mayor correlativo existente + 1.
     */
    public static function generateCode(): string
    {
        $prefix = 'LOT-';
        $max = 0;

        foreach (DB::table('lots')->where('code', 'LIKE', $prefix.'%')->pluck('code') as $code) {
            if (preg_match('/^LOT-(\d+)$/', (string) $code, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return $prefix.str_pad($max + 1, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Regla de negocio de cierre automático del lote: evalúa la
     * cantidad de animales vigentes (activos + en gestación +
     * destetados) y:
     *  - Inactiva el lote cuando la cantidad llega a 0 (salida del
     *    último animal por cosecha / venta / traslado / muerte).
     *  - Lo reactiva cuando vuelve a haber animales en producción.
     */
    public function syncStatusFromAnimals(): void
    {
        $inProduction = (int) $this->animals()
            ->whereIn('status', self::ANIMALS_IN_PRODUCTION_STATUSES)
            ->count();

        $newStatus = $inProduction === 0 ? self::STATUS_INACTIVE : self::STATUS_ACTIVE;

        if ($this->status !== $newStatus) {
            $this->status = $newStatus;
            $this->save();
        }
    }
}
