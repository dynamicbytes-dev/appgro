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
     * Estados de animales que ocupan espacio en el
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
        'initial_quantity',
        'harvested_quantity',
        'initial_weight',
        'weight',
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
        'initial_quantity' => 'integer',
        'harvested_quantity' => 'integer',
        'initial_weight' => 'decimal:2',
        'entry_date' => 'date:Y-m-d',
        'harvest_date' => 'date:Y-m-d',
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
     * Atributos agregados automáticamente para garantizar datos completos
     * tanto de producción según propósito como del resumen de cosecha.
     */
    protected $appends = [
        'purpose_production',
        'harvest_summary',
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
     */
    public static function occupiedCapacity(int $galponId): int
    {
        return (int) static::query()
            ->where('galpon_id', $galponId)
            ->where('status', self::STATUS_ACTIVE)
            ->sum('quantity');
    }

    /**
     * Determina si el propósito corresponde a producción de huevos / postura.
     */
    public function isEggPurpose(?string $purpose = null): bool
    {
        $val = $purpose ?? $this->purpose;
        $key = Species::normalizeKey($val);

        return $key === 'huevos' || $key === 'postura';
    }

    /**
     * Determina si el propósito corresponde a reproducción o cría.
     */
    public function isReproductionPurpose(?string $purpose = null): bool
    {
        $val = $purpose ?? $this->purpose;
        $key = Species::normalizeKey($val);

        return $key === 'reproduccion' || $key === 'cria';
    }

    /**
     * Determina si el propósito corresponde a carne o engorde.
     */
    public function isMeatPurpose(?string $purpose = null): bool
    {
        $val = $purpose ?? $this->purpose;
        $key = Species::normalizeKey($val);

        return $key === 'carne' || $key === 'engorde' || $key === 'ceba';
    }

    /**
     * Cantidad actual de animales que ocupan espacio en
     * el lote: activos + gestantes + destetados.
     */
    public function currentOccupancy(): int
    {
        $query = $this->animals();

        if ((clone $query)->count() === 0) {
            return (int) $this->quantity;
        }

        return (int) $query->whereIn('status', self::ANIMALS_IN_PRODUCTION_STATUSES)->count();
    }

    // ==========================================
    // ACCESSORS (PRODUCCIÓN DEL PROPÓSITO Y COSECHA)
    // ==========================================

    public function setWeightAttribute($value): void
    {
        $this->attributes['initial_weight'] = $value;
    }

    public function getWeightAttribute(): ?float
    {
        return isset($this->attributes['initial_weight']) && $this->attributes['initial_weight'] !== null
            ? (float) $this->attributes['initial_weight']
            : null;
    }

    public function getPurposeProductionAttribute(): array
    {
        if (array_key_exists('purpose_production', $this->attributes)) {
            return (array) $this->attributes['purpose_production'];
        }

        return $this->computePurposeProduction();
    }

    public function getHarvestSummaryAttribute(): array
    {
        if (array_key_exists('harvest_summary', $this->attributes)) {
            return (array) $this->attributes['harvest_summary'];
        }

        return $this->computeHarvestSummary();
    }

    /**
     * Calcula la producción detallada según el propósito del lote.
     */
    public function computePurposeProduction(?Collection $animals = null, ?Collection $allServices = null): array
    {
        // 1. POSTURA / AVÍCOLA DE HUEVOS
        if ($this->isEggPurpose()) {
            $goodEggs = (int) ($this->total_eggs ?? 0);
            $brokenEggs = (int) ($this->broken_eggs ?? 0);
            $totalEggs = $goodEggs + $brokenEggs;
            $eggPrice = (float) ($this->egg_price ?? 0);

            // Costo de producción de postura: estrictamente calculado sobre los huevos buenos
            $productionCost = round($this->total_egg_cost !== null
                ? (float) $this->total_egg_cost
                : ($goodEggs * $eggPrice), 2);

            $mermaCost = round($this->total_broken_cost !== null
                ? (float) $this->total_broken_cost
                : ($brokenEggs * $eggPrice), 2);

            $mermaPercent = $totalEggs > 0 ? round(($brokenEggs / $totalEggs) * 100, 2) : 0.0;

            return [
                'purpose' => 'postura',
                'purpose_label' => 'Postura / Aves de Postura',
                'total_eggs' => $totalEggs,
                'good_eggs' => $goodEggs,
                'broken_eggs' => $brokenEggs,
                'merma_percentage' => $mermaPercent,
                'egg_price' => $eggPrice,
                'production_cost' => $productionCost,
                'total_egg_cost' => $productionCost,
                'merma_cost' => $mermaCost,
                'unit' => 'huevos',
                'summary_text' => sprintf('%d huevos (%d buenos / %d rotos)', $totalEggs, $goodEggs, $brokenEggs),
            ];
        }

        // 2. REPRODUCCIÓN / CRÍA
        if ($this->isReproductionPurpose() || Species::normalizeKey($this->purpose) === 'cria') {
            $animals = $animals ?? ($this->relationLoaded('animals') ? $this->animals : $this->animals()->with('services')->get());
            $animalIds = $animals->pluck('id')->all();

            $services = $allServices
                ? $allServices->whereIn('lote_animal_id', $animalIds)
                : ($animals->isNotEmpty() ? $animals->flatMap(fn ($a) => $a->services ?? []) : collect());

            $farrowServices = $services->where('service_type', AnimalService::TYPE_FARROW);
            $partosCount = max((int) $animals->sum('parity_count'), $farrowServices->count());

            if ($farrowServices->count() > 0) {
                $bornAlive = (int) $farrowServices->sum('live_piglets');
                $bornDead = (int) $farrowServices->sum(fn ($s) => max(0, (int) ($s->total_piglets ?? 0) - (int) ($s->live_piglets ?? 0)));
            } else {
                $bornAlive = (int) $animals->sum('born_alive');
                $bornDead = (int) $animals->sum('born_dead');
            }

            $weanedCount = (int) $animals->sum('weaned_count');
            if ($weanedCount === 0 && $services->where('status', AnimalService::STATUS_WEANED)->count() > 0) {
                $weanedCount = (int) $services->where('status', AnimalService::STATUS_WEANED)->sum('live_piglets');
            }

            $pendingPiglets = (int) $services->sum('pending_piglets');

            return [
                'purpose' => 'reproducción',
                'purpose_label' => 'Reproducción / Cría',
                'farrowings_count' => $partosCount,
                'total_farrowings' => $partosCount,
                'born_alive' => $bornAlive,
                'total_born_alive' => $bornAlive,
                'born_dead' => $bornDead,
                'total_born_dead' => $bornDead,
                'weaned_count' => $weanedCount,
                'total_weaned' => $weanedCount,
                'pending_piglets' => $pendingPiglets,
                'breeding_females' => $animals->where('gender', LoteAnimal::GENDER_FEMALE)->count(),
                'breeding_males' => $animals->where('gender', LoteAnimal::GENDER_MALE)->count(),
                'unit' => 'crías',
                'summary_text' => sprintf('%d partos, %d crías vivas, %d destetados', $partosCount, $bornAlive, $weanedCount),
            ];
        }

        // 3. CARNE / ENGORDE (Default)
        $initialWeight = isset($this->attributes['initial_weight']) && $this->attributes['initial_weight'] !== null
            ? (float) $this->attributes['initial_weight']
            : (isset($this->attributes['weight']) && $this->attributes['weight'] !== null
                ? (float) $this->attributes['weight']
                : (float) ($this->entry_weight ?? 0.0));

        $currentAvgWeight = $this->avg_weight !== null
            ? (float) $this->avg_weight
            : ($initialWeight > 0 ? $initialWeight : 0.0);

        $weightGain = max(0.0, round($currentAvgWeight - $initialWeight, 2));
        $currentQty = (int) ($this->current_occupancy ?? $this->quantity);
        $totalCurrentWeight = round($this->total_weight !== null ? (float) $this->total_weight : ($currentQty * $currentAvgWeight), 2);
        $accumulatedWeightGain = round($weightGain * max(1, $currentQty), 2);
        $yieldPerformance = $initialWeight > 0 ? round(($weightGain / $initialWeight) * 100, 1) : 0.0;

        return [
            'purpose' => 'engorde',
            'purpose_label' => 'Carne / Engorde',
            'initial_weight' => $initialWeight,
            'current_avg_weight' => $currentAvgWeight,
            'avg_weight' => $currentAvgWeight,
            'weight_gain' => $weightGain,
            'total_weight_gain' => $accumulatedWeightGain,
            'total_current_weight' => $totalCurrentWeight,
            'total_weight' => $totalCurrentWeight,
            'yield_performance' => $yieldPerformance,
            'unit' => 'kg',
            'summary_text' => sprintf('Peso prom: %.2f kg | Ganancia: %.2f kg (+%.1f%%)', $currentAvgWeight, $weightGain, $yieldPerformance),
        ];
    }

    /**
     * Calcula los datos consolidados de lo cosechado en el lote.
     */
    public function computeHarvestSummary(?Collection $animals = null): array
    {
        $animals = $animals ?? ($this->relationLoaded('animals') ? $this->animals : $this->animals()->get());
        $harvestedAnimals = $animals->whereIn('status', ['cosechado', 'vendido', 'descartado', 'muerto']);

        // 1. Cantidad y pesos cosechados
        if ($harvestedAnimals->isNotEmpty()) {
            $harvestedQuantity = $harvestedAnimals->count();
            $harvestedWeight = (float) $harvestedAnimals->sum('sale_weight');
            $directHarvestCost = (float) $harvestedAnimals->sum('sale_total_price');
            $lastHarvestDate = $harvestedAnimals->max(fn ($a) => $a->updated_at ? $a->updated_at->format('Y-m-d') : null);
        } else {
            $harvestedQuantity = (int) ($this->harvested_quantity ?? 0);
            if ($harvestedQuantity === 0 && ($this->status === self::STATUS_INACTIVE || $this->harvest_date !== null || (float) ($this->total_price ?? 0) > 0)) {
                $harvestedQuantity = (int) ($this->initial_quantity ?: ((int) $this->quantity > 0 ? (int) $this->quantity : 1));
                if ((float) ($this->avg_weight ?? 0) > 0 && (float) ($this->total_weight ?? 0) > 0) {
                    $harvestedQuantity = (int) round((float) $this->total_weight / (float) $this->avg_weight);
                }
            }
            $harvestedWeight = (float) ($this->total_weight ?? 0);
            $directHarvestCost = (float) ($this->total_price ?? 0);
            $lastHarvestDate = $this->harvest_date ? optional($this->harvest_date)->format('Y-m-d') : null;
        }

        // Si es postura, el costo de producción de huevos suma al valor de cosecha
        if ($this->isEggPurpose()) {
            $directHarvestCost += (float) ($this->total_egg_cost ?? 0);
        }

        $directHarvestCost = round($directHarvestCost, 2);

        // Costo operativo de inversión del lote
        $operationalCost = (float) ($this->investment_cost ?? 0);

        // Costo Total Acumulado de Cosecha: cosecha directo + inversión operativa
        $totalHarvestCost = round($directHarvestCost + $operationalCost, 2);

        // Peso promedio por animal cosechado
        $avgHarvestWeight = $harvestedQuantity > 0 && $harvestedWeight > 0
            ? round($harvestedWeight / $harvestedQuantity, 2)
            : (float) ($this->avg_weight ?? 0.0);

        // Estado de la cosecha
        if ($this->status === self::STATUS_INACTIVE || ($harvestedQuantity > 0 && (int) $this->quantity === 0)) {
            $harvestStatus = 'Cosechado / Cerrado';
        } elseif ($harvestedQuantity > 0 && (int) $this->quantity > 0) {
            $harvestStatus = 'Parcial';
        } else {
            $harvestStatus = 'En curso';
        }

        return [
            'harvested_quantity' => $harvestedQuantity,
            'harvested_weight' => round($harvestedWeight, 2),
            'avg_harvest_weight' => round($avgHarvestWeight, 2),
            'harvest_cost' => $directHarvestCost,
            'total_harvest_cost' => $totalHarvestCost,
            'operational_cost' => round($operationalCost, 2),
            'harvest_status' => $harvestStatus,
            'harvest_date' => $lastHarvestDate ?: ($this->harvest_date ? optional($this->harvest_date)->format('Y-m-d') : null),
            'price_per_kg' => (float) ($this->price_per_kg ?? 0.0),
        ];
    }

    /**
     * Carga masiva de producción según propósito, resumen de cosecha,
     * ocupación actual y costo de cosecha en colecciones de lotes (sin N+1).
     */
    public static function loadProductionAndHarvest(Collection $lots): void
    {
        if ($lots->isEmpty()) {
            return;
        }

        $ids = $lots->pluck('id')->all();

        // 1. Cargar animales de los lotes en una sola consulta
        $allAnimals = LoteAnimal::whereIn('lote_id', $ids)->get();
        $animalsByLot = $allAnimals->groupBy('lote_id');

        // 2. Cargar servicios reproductivos de los animales en una sola consulta
        $animalIds = $allAnimals->pluck('id')->all();
        $allServices = ! empty($animalIds)
            ? AnimalService::whereIn('lote_animal_id', $animalIds)->get()
            : collect();
        $servicesByAnimal = $allServices->groupBy('lote_animal_id');

        // 3. Procesar y setear atributos en cada lote
        $lots->each(function ($lot) use ($animalsByLot, $servicesByAnimal, $allServices) {
            $animals = $animalsByLot->get($lot->id, collect());

            $animals->each(function ($animal) use ($servicesByAnimal, $lot) {
                $animal->setRelation('services', $servicesByAnimal->get($animal->id, collect()));
                $animal->setRelation('lote', $lot);
            });

            // Ocupación actual
            $hasAnimalRecords = $animals->isNotEmpty();
            $inProductionCount = $animals->whereIn('status', self::ANIMALS_IN_PRODUCTION_STATUSES)->count();
            $currentOccupancy = $hasAnimalRecords ? $inProductionCount : (int) $lot->quantity;
            $lot->setAttribute('current_occupancy', $currentOccupancy);

            // Costo de cosecha directo (retrocompatibilidad)
            $harvestedAnimals = $animals->whereIn('status', ['cosechado', 'vendido', 'descartado', 'muerto']);
            $individualHarvestCost = (float) $harvestedAnimals->whereNotNull('sale_total_price')->sum('sale_total_price');
            $lotLevelHarvestCost = (float) ($lot->total_price ?? 0);
            $animalCost = $individualHarvestCost > 0 ? $individualHarvestCost : $lotLevelHarvestCost;
            $eggCost = (float) ($lot->total_egg_cost ?? 0);
            $harvestCost = round($animalCost + $eggCost, 2);
            $lot->setAttribute('harvest_cost', $harvestCost);

            // Datos de producción según el propósito
            $purposeProduction = $lot->computePurposeProduction($animals, $allServices);
            $lot->setAttribute('purpose_production', $purposeProduction);

            // Datos de cosecha
            $harvestSummary = $lot->computeHarvestSummary($animals);
            $lot->setAttribute('harvest_summary', $harvestSummary);
            $lot->setAttribute('total_harvest_cost', $harvestSummary['total_harvest_cost'] ?? $harvestCost);
        });
    }

    /**
     * Retrocompatibilidad para carga masiva de current_occupancy.
     */
    public static function loadCurrentOccupancy(Collection $lots): void
    {
        static::loadProductionAndHarvest($lots);
    }

    /**
     * Retrocompatibilidad para carga masiva de harvest_cost.
     */
    public static function loadHarvestCost(Collection $lots): void
    {
        static::loadProductionAndHarvest($lots);
    }

    /**
     * Genera un código único e irrepetible con formato LOT-XXXXX.
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
     * Regla de negocio de cierre automático del lote.
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
