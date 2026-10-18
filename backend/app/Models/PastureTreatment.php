<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PastureTreatment extends Model
{
    use Auditable, BelongsToFarm, HasFactory;

    protected $table = 'pasture_treatments';

    /**
     * Tipos de tratamiento de manejo agronómico del potrero.
     */
    public const TYPES = [
        'fertilizacion',
        'control_malezas',
        'resiembra',
        'riego',
        'encalado',
        'otro',
    ];

    protected $fillable = [
        'farm_id',
        'potrero_id',
        'type',
        'product',
        'dose',
        'dose_unit',
        'applied_at',
        'cost',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'potrero_id' => 'integer',
        'dose' => 'decimal:2',
        'cost' => 'decimal:2',
        'applied_at' => 'date:Y-m-d',
        'user_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Potreros';
    }

    public function potrero()
    {
        return $this->belongsTo(Potrero::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
