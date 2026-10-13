<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Barn extends Model
{
    use HasFactory, BelongsToFarm, Auditable;

    protected $table = 'barns';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

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
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    public function lots()
    {
        return $this->hasMany(Lot::class);
    }
}
