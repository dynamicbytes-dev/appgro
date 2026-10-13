<?php

namespace App\Traits;

use App\Models\Farm;
use App\Models\Scopes\FarmScope;
use Illuminate\Support\Facades\Auth;

trait BelongsToFarm
{
    /**
     * Boot the BelongsToFarm trait for a model.
     */
    protected static function bootBelongsToFarm(): void
    {
        static::addGlobalScope(new FarmScope());

        static::creating(function ($model) {
            if (Auth::check()) {
                $user = Auth::user();
                if ($user && $user->role !== 'root' && empty($model->farm_id)) {
                    $model->farm_id = $user->farm_id;
                }
            }
        });
    }

    /**
     * Relationship to the Farm model.
     */
    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }
}
