<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FarmModule extends Model
{
    use HasFactory;

    protected $table = 'farm_modules';

    public $timestamps = false;

    protected $fillable = [
        'farm_id',
        'module_id',
        'is_enabled',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'module_id' => 'integer',
        'is_enabled' => 'boolean',
    ];

    public function farm()
    {
        return $this->belongsTo(Farm::class, 'farm_id');
    }

    public function module()
    {
        return $this->belongsTo(Module::class, 'module_id');
    }
}
