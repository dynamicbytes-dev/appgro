<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Registro individual de un animal dentro de un lote
 * (porcinos de reproducción).
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
        'breed',
        'father_breed',
        'mother_breed',
        'gender',
        'birth_date',
        'parity_count',
        'teats_count',
        'avg_piglets_per_birth',
        'sale_weight',
        'sale_price_per_kg',
        'sale_total_price',
        'status',
    ];

    protected $casts = [
        'lote_id' => 'integer',
        'birth_date' => 'date',
        'parity_count' => 'integer',
        'teats_count' => 'integer',
        'avg_piglets_per_birth' => 'decimal:2',
        'sale_weight' => 'decimal:2',
        'sale_price_per_kg' => 'decimal:2',
        'sale_total_price' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
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
}
