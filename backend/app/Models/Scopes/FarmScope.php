<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class FarmScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     */
    public function apply(Builder $builder, Model $model): void
    {
        $user = Auth::guard('api')->user() ?? Auth::user() ?? (function_exists('request') && request() ? request()->user() : null);

        if ($user && $user->role !== 'root' && !empty($user->farm_id)) {
            $builder->where($model->getTable() . '.farm_id', $user->farm_id);
        }
    }
}
