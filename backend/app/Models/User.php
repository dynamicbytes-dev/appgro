<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, Auditable;

    protected $table = 'users';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'farm_id',
        'role',
        'name',
        'lastname',
        'email',
        'phone',
        'password_hash',
        'is_active',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
    ];

    /**
     * Override default password column name for authentication.
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing custom claims (id, email, role, farm_id) added to JWT payload.
     */
    public function getJWTCustomClaims(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role,
            'farm_id' => $this->farm_id,
        ];
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    public function modules()
    {
        return $this->belongsToMany(Module::class, 'farm_modules', 'farm_id', 'module_id', 'farm_id', 'id')
                    ->withPivot('is_enabled');
    }

    public function subordinateModules()
    {
        return $this->belongsToMany(Module::class, 'subordinate_modules', 'user_id', 'module_id')
                    ->withPivot('is_enabled');
    }

    public function isRoot(): bool
    {
        return $this->role === 'root';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isSubordinate(): bool
    {
        return $this->role === 'subordinate';
    }
}
