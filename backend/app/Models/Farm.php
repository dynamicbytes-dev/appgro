<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Farm extends Model
{
    use HasFactory, Auditable;

    protected $table = 'farms';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    public const VALID_SECTORS = [
        'avicola',
        'porcino',
        'bovino',
        'ovino_caprino',
        'acuicola',
        'mixto',
    ];

    protected $fillable = [
        'code',
        'name',
        'sector',
        'location',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function ($farm) {
            if (empty($farm->code)) {
                $farm->code = 'FRM-' . strtoupper(\Illuminate\Support\Str::random(8));
            }
        });

        static::created(function ($farm) {
            static::ensureDefaultModules($farm->id);
        });
    }

    /**
     * Ensure that all system modules have pivot records in farm_modules for the given farm.
     */
    public static function ensureDefaultModules($farmId, bool $defaultEnabled = false)
    {
        if (!$farmId) {
            return;
        }

        $allModules = Module::all();
        $existingModuleIds = \Illuminate\Support\Facades\DB::table('farm_modules')
            ->where('farm_id', $farmId)
            ->pluck('module_id')
            ->toArray();

        foreach ($allModules as $module) {
            if (!in_array($module->id, $existingModuleIds)) {
                \Illuminate\Support\Facades\DB::table('farm_modules')->insert([
                    'farm_id' => $farmId,
                    'module_id' => $module->id,
                    'is_enabled' => $defaultEnabled,
                ]);
            }
        }
    }

    public function modules()
    {
        return $this->belongsToMany(Module::class, 'farm_modules', 'farm_id', 'module_id')
                    ->withPivot('is_enabled');
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function species()
    {
        return $this->hasMany(Species::class);
    }

    public function barns()
    {
        return $this->hasMany(Barn::class);
    }

    public function lots()
    {
        return $this->hasMany(Lot::class);
    }
}
