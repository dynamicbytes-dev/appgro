<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Registro individual de un animal dentro de un lote
 * (porcinos y conejos de reproducción).
 *
 * El aislamiento multigranja se aplica mediante un scope global que
 * filtra por la granja del lote padre (`lote.farm_id`).
 */
class LoteAnimal extends Model
{
    use HasFactory;

    protected $table = 'lote_animals';

    const CREATED_AT = 'created_at';

    const UPDATED_AT = 'updated_at';

    public const GENDER_FEMALE = 'hembra';

    public const GENDER_MALE = 'macho';

    public const STATUS_ACTIVE = 'activo';

    public const STATUS_GESTATION = 'gestación';

    public const STATUS_WEANED = 'destete';

    public const STATUS_HARVESTED = 'cosechado';

    public const STATUS_DEAD = 'muerto';

    protected $fillable = [
        'lote_id',
        'identifier',
        'name',
        'color',
        'breed',
        'father_breed',
        'mother_breed',
        'gender',
        'birth_date',
        'entry_date',
        'weight',
        'parity_count',
        'teats_count',
        'avg_piglets_per_birth',
        'sale_weight',
        'sale_price_per_kg',
        'sale_total_price',
        'accumulated_cost',
        'health_controls',
        'notes',
        'status',
    ];

    protected $casts = [
        'lote_id' => 'integer',
        'birth_date' => 'date:Y-m-d',
        'entry_date' => 'date:Y-m-d',
        'weight' => 'decimal:2',
        'parity_count' => 'integer',
        'teats_count' => 'integer',
        'avg_piglets_per_birth' => 'decimal:2',
        'sale_weight' => 'decimal:2',
        'sale_price_per_kg' => 'decimal:2',
        'sale_total_price' => 'decimal:2',
        'accumulated_cost' => 'decimal:2',
        'health_controls' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Atributos agregados automáticamente para garantizar datos completos
     * en el modal "Animales del Lote" y en endpoints individuales de cerdos.
     */
    protected $appends = [
        'code',
        'ear_tag',
        'sex',
        'weight',
        'entry_date',
        'farrowings_count',
        'born_alive',
        'born_dead',
        'weaned_count',
        'accumulated_cost',
        'health_controls',
        'observations',
        'reproductive_summary',
        'financial_summary',
        'health_summary',
    ];

    /**
     * Scope global de aislamiento multigranja: los animales solo son
     * visibles desde la granja de su lote (Root ve todos).
     */
    protected static function booted(): void
    {
        static::addGlobalScope('farm', function ($builder) {
            $user = Auth::user();

            if ($user && ! $user->isRoot() && ! empty($user->farm_id)) {
                $builder->whereHas('lote', function ($query) use ($user) {
                    $query->where('lots.farm_id', $user->farm_id);
                });
            }
        });
    }

    public function lote()
    {
        return $this->belongsTo(Lot::class, 'lote_id');
    }

    public function services()
    {
        return $this->hasMany(AnimalService::class, 'lote_animal_id');
    }

    /**
     * Genera un identificador único e irrepetible de 5 dígitos (00001, 00002, ...).
     */
    public static function generateIdentifier(): string
    {
        $max = (int) DB::table('lote_animals')->max('identifier');

        return str_pad($max + 1, 5, '0', STR_PAD_LEFT);
    }

    // ==========================================
    // ACCESSORS (CARACTERÍSTICAS FÍSICAS Y CÓDIGO)
    // ==========================================

    public function getCodeAttribute(): string
    {
        return (string) ($this->attributes['identifier'] ?? '');
    }

    public function getEarTagAttribute(): string
    {
        return (string) ($this->attributes['identifier'] ?? '');
    }

    public function getSexAttribute(): string
    {
        return (string) ($this->attributes['gender'] ?? '');
    }

    public function getWeightAttribute(): ?float
    {
        if (isset($this->attributes['weight']) && $this->attributes['weight'] !== null) {
            return (float) $this->attributes['weight'];
        }

        if (isset($this->attributes['sale_weight']) && $this->attributes['sale_weight'] !== null) {
            return (float) $this->attributes['sale_weight'];
        }

        return null;
    }

    public function getEntryDateAttribute(): ?string
    {
        if (! empty($this->attributes['entry_date'])) {
            return is_string($this->attributes['entry_date'])
                ? substr($this->attributes['entry_date'], 0, 10)
                : optional($this->attributes['entry_date'])->format('Y-m-d');
        }

        return $this->created_at ? $this->created_at->format('Y-m-d') : null;
    }

    // ==========================================
    // ACCESSORS (DATOS REPRODUCTIVOS)
    // ==========================================

    public function getFarrowingsCountAttribute(): int
    {
        if (($this->attributes['gender'] ?? '') !== self::GENDER_FEMALE) {
            return 0;
        }

        $partosServices = $this->relationLoaded('services')
            ? $this->services->where('service_type', AnimalService::TYPE_FARROW)->count()
            : $this->services()->where('service_type', AnimalService::TYPE_FARROW)->count();

        return max((int) ($this->attributes['parity_count'] ?? 0), $partosServices);
    }

    public function getBornAliveAttribute(): int
    {
        if (($this->attributes['gender'] ?? '') !== self::GENDER_FEMALE) {
            return 0;
        }

        $services = $this->relationLoaded('services') ? $this->services : $this->services()->get();
        $farrows = $services->where('service_type', AnimalService::TYPE_FARROW);

        if ($farrows->count() > 0) {
            return (int) $farrows->sum('live_piglets');
        }

        $parity = (int) ($this->attributes['parity_count'] ?? 0);
        $avg = (float) ($this->attributes['avg_piglets_per_birth'] ?? 0);

        return (int) round($parity * $avg);
    }

    public function getBornDeadAttribute(): int
    {
        if (($this->attributes['gender'] ?? '') !== self::GENDER_FEMALE) {
            return 0;
        }

        $services = $this->relationLoaded('services') ? $this->services : $this->services()->get();
        $farrows = $services->where('service_type', AnimalService::TYPE_FARROW);

        if ($farrows->count() > 0) {
            return (int) $farrows->sum(function ($s) {
                $total = (int) ($s->total_piglets ?? 0);
                $live = (int) ($s->live_piglets ?? 0);
                return max(0, $total - $live);
            });
        }

        return 0;
    }

    public function getWeanedCountAttribute(): int
    {
        if (($this->attributes['gender'] ?? '') !== self::GENDER_FEMALE) {
            return 0;
        }

        $services = $this->relationLoaded('services') ? $this->services : $this->services()->get();
        $weaned = $services->where('status', AnimalService::STATUS_WEANED);

        if ($weaned->count() > 0) {
            return (int) $weaned->sum('live_piglets');
        }

        return 0;
    }

    public function getReproductiveSummaryAttribute(): array
    {
        $isFemale = ($this->attributes['gender'] ?? '') === self::GENDER_FEMALE;

        return [
            'is_reproductive' => $isFemale,
            'farrowings_count' => $this->farrowings_count,
            'born_alive' => $this->born_alive,
            'born_dead' => $this->born_dead,
            'weaned_count' => $this->weaned_count,
            'avg_piglets_per_birth' => (float) ($this->attributes['avg_piglets_per_birth'] ?? 0),
        ];
    }

    // ==========================================
    // ACCESSORS (FINANCIERO Y SANITARIO)
    // ==========================================

    public function getAccumulatedCostAttribute(): float
    {
        if (isset($this->attributes['accumulated_cost']) && $this->attributes['accumulated_cost'] !== null) {
            return (float) $this->attributes['accumulated_cost'];
        }

        $lote = $this->relationLoaded('lote') ? $this->lote : $this->lote()->first();
        if ($lote) {
            $qty = (int) ($lote->quantity ?? 0);
            $cost = (float) ($lote->investment_cost ?? 0);
            if ($qty > 0 && $cost > 0) {
                return round($cost / $qty, 2);
            }
        }

        return 0.0;
    }

    public function getHealthControlsAttribute(): array
    {
        $raw = $this->attributes['health_controls'] ?? null;
        if (is_array($raw)) {
            return $raw;
        }

        if (is_string($raw) && ! empty($raw)) {
            $decoded = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
    }

    public function getObservationsAttribute(): string
    {
        return (string) ($this->attributes['notes'] ?? '');
    }

    public function getFinancialSummaryAttribute(): array
    {
        return [
            'accumulated_cost' => $this->accumulated_cost,
            'sale_weight' => isset($this->attributes['sale_weight']) && $this->attributes['sale_weight'] !== null
                ? (float) $this->attributes['sale_weight'] : null,
            'sale_price_per_kg' => isset($this->attributes['sale_price_per_kg']) && $this->attributes['sale_price_per_kg'] !== null
                ? (float) $this->attributes['sale_price_per_kg'] : null,
            'sale_total_price' => isset($this->attributes['sale_total_price']) && $this->attributes['sale_total_price'] !== null
                ? (float) $this->attributes['sale_total_price'] : null,
        ];
    }

    public function getHealthSummaryAttribute(): array
    {
        $controls = $this->health_controls;

        return [
            'status' => $this->status,
            'controls_count' => count($controls),
            'recent_controls' => array_slice($controls, 0, 5),
        ];
    }

    // ==========================================
    // MUTATORS (COMPATIBILIDAD DE ENTRADA)
    // ==========================================

    public function setSexAttribute($value): void
    {
        $this->attributes['gender'] = $value;
    }

    public function setEarTagAttribute($value): void
    {
        $this->attributes['identifier'] = $value;
    }

    public function setObservationsAttribute($value): void
    {
        $this->attributes['notes'] = $value;
    }
}
