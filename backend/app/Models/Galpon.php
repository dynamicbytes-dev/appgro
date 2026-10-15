<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Galpon extends Model
{
    use HasFactory, BelongsToFarm, Auditable;

    protected $table = 'galpones';

    protected $fillable = [
        'farm_id',
        'species_id',
        'name',
        'category',
        'sector',
        'purpose',
        'max_capacity',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'max_capacity' => 'integer',
        'farm_id' => 'integer',
        'species_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Galpones';
    }

    /**
     * Relationship with Farm.
     */
    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * Relationship with Species.
     */
    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    /**
     * Relationship with Lots.
     */
    public function lots()
    {
        return $this->hasMany(Lot::class, 'galpon_id');
    }
}
