<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lot extends Model
{
    use HasFactory, BelongsToFarm, Auditable;

    protected $table = 'lots';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'farm_id',
        'barn_id',
        'name',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function barn()
    {
        return $this->belongsTo(Barn::class);
    }
}
