<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Historial de servicios reproductivos (inseminación / monta)
 * de un animal individual.
 *
 * Aislamiento multigranja heredado del animal (`animal.lote.farm_id`).
 */
class AnimalService extends Model
{
    use HasFactory;

    protected $table = 'animal_services';

    const CREATED_AT = 'created_at';

    const UPDATED_AT = 'updated_at';

    public const TYPE_INSEMINATION = 'inseminación';

    public const TYPE_MOUNT = 'monta';

    /**
     * Registro de parto / destete: cierra el ciclo de gestación.
     */
    public const TYPE_FARROW = 'parto';

    public const STATUS_ACTIVE = 'activo';

    public const STATUS_GESTATION = 'gestación';

    public const STATUS_WEANED = 'destete';

    protected $fillable = [
        'lote_animal_id',
        'service_type',
        'service_date',
        'status',
        'pregnancy_date',
        'birth_date',
        'total_piglets',
        'live_piglets',
        'pending_piglets',
        'piglet_lot_id',
    ];

    protected $casts = [
        'lote_animal_id' => 'integer',
        'service_date' => 'date',
        'pregnancy_date' => 'date',
        'birth_date' => 'date',
        'total_piglets' => 'integer',
        'live_piglets' => 'integer',
        'pending_piglets' => 'integer',
        'piglet_lot_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Scope global de aislamiento multigranja heredado del animal.
     */
    protected static function booted(): void
    {
        static::addGlobalScope('farm', function ($builder) {
            $user = Auth::user();

            if ($user && ! $user->isRoot() && ! empty($user->farm_id)) {
                $builder->whereHas('animal', function ($query) use ($user) {
                    $query->whereHas('lote', function ($query) use ($user) {
                        $query->where('lots.farm_id', $user->farm_id);
                    });
                });
            }
        });
    }

    public function animal()
    {
        return $this->belongsTo(LoteAnimal::class, 'lote_animal_id');
    }
}
