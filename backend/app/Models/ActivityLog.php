<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLog extends Model
{
    use HasFactory;

    protected $table = 'activity_logs';

    protected $fillable = [
        'user_id',
        'farm_id',
        'module',
        'action',
        'description',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * User who executed the action.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Farm associated with the action (null if global Root action).
     */
    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * Helper to log an action manually anywhere in the application.
     */
    public static function logAction(
        string $module,
        string $action,
        string $description,
        ?int $farmId = null,
        ?int $userId = null
    ): self {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $resolvedUserId = $userId ?? ($user ? $user->id : null);
        $resolvedFarmId = $farmId ?? ($user && $user->role !== 'root' ? $user->farm_id : null);

        return static::create([
            'user_id' => $resolvedUserId,
            'farm_id' => $resolvedFarmId,
            'module' => $module,
            'action' => strtoupper($action),
            'description' => $description,
        ]);
    }
}
