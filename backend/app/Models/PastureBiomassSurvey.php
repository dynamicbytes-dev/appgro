<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PastureBiomassSurvey extends Model
{
    use Auditable, BelongsToFarm, HasFactory;

    protected $table = 'pasture_biomass_surveys';

    protected $fillable = [
        'farm_id',
        'potrero_id',
        'surveyed_at',
        'entry_height_cm',
        'exit_height_cm',
        'biomass_kg_dm_ha',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'potrero_id' => 'integer',
        'surveyed_at' => 'date:Y-m-d',
        'entry_height_cm' => 'decimal:2',
        'exit_height_cm' => 'decimal:2',
        'biomass_kg_dm_ha' => 'decimal:2',
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
