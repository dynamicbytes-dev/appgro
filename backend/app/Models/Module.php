<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    use HasFactory;

    protected $table = 'modules';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'code',
        'name',
        'description',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function farms()
    {
        return $this->belongsToMany(Farm::class, 'farm_modules', 'module_id', 'farm_id')
                    ->withPivot('is_enabled');
    }

    public function subordinates()
    {
        return $this->belongsToMany(User::class, 'subordinate_modules', 'module_id', 'user_id')
                    ->withPivot('is_enabled');
    }
}
