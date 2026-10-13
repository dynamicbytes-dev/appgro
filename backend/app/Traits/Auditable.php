<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

trait Auditable
{
    /**
     * Boot the Auditable trait for a model.
     */
    protected static function bootAuditable(): void
    {
        static::created(function ($model) {
            static::recordModelAudit($model, 'CREAR');
        });

        static::updated(function ($model) {
            $action = 'ACTUALIZAR';
            if ($model->isDirty('is_active') && $model->is_active === false) {
                $action = 'INHABILITAR';
            } elseif ($model->isDirty('is_active') && $model->is_active === true) {
                $action = 'HABILITAR';
            }

            static::recordModelAudit($model, $action);
        });

        static::deleted(function ($model) {
            static::recordModelAudit($model, 'ELIMINAR');
        });
    }

    /**
     * Record an audit log entry in activity_logs.
     */
    protected static function recordModelAudit($model, string $action): void
    {
        try {
            $user = Auth::guard('api')->user() ?? Auth::user();
            $userId = $user ? $user->id : null;

            // Resolve farm_id: check model property first, then user's farm
            $farmId = null;
            if (isset($model->farm_id)) {
                $farmId = $model->farm_id;
            } elseif ($model instanceof \App\Models\Farm) {
                $farmId = $model->id;
            } elseif ($user && $user->role !== 'root') {
                $farmId = $user->farm_id;
            }

            $moduleName = method_exists($model, 'getAuditModule')
                ? $model->getAuditModule()
                : static::resolveAuditModule($model);

            $description = method_exists($model, 'getAuditDescription')
                ? $model->getAuditDescription($action)
                : static::buildAuditDescription($model, $action, $moduleName);

            ActivityLog::create([
                'user_id' => $userId,
                'farm_id' => $farmId,
                'module' => $moduleName,
                'action' => $action,
                'description' => $description,
            ]);
        } catch (\Throwable $e) {
            Log::warning('No se pudo registrar log de auditoría: ' . $e->getMessage(), [
                'model' => get_class($model),
                'action' => $action,
            ]);
        }
    }

    /**
     * Resolve standard module name by model class.
     */
    protected static function resolveAuditModule($model): string
    {
        $class = class_basename($model);

        return match ($class) {
            'Species' => 'Especies',
            'Barn' => 'Galpones',
            'Galpon' => 'Galpones',
            'Lot' => 'Lotes',
            'User' => (isset($model->role) && $model->role === 'subordinate') ? 'Encargados' : 'Usuarios',
            'Farm' => 'Granjas',
            default => $class,
        };
    }

    /**
     * Build standard human-readable audit description.
     */
    protected static function buildAuditDescription($model, string $action, string $moduleName): string
    {
        $identifier = $model->name ?? ($model->email ?? ($model->code ?? ('#' . $model->getKey())));

        return match ($action) {
            'CREAR' => "Se ha creado el registro '{$identifier}' en {$moduleName}.",
            'ACTUALIZAR' => "Se ha actualizado el registro '{$identifier}' en {$moduleName}.",
            'INHABILITAR' => "Se ha inhabilitado el registro '{$identifier}' en {$moduleName}.",
            'HABILITAR' => "Se ha habilitado el registro '{$identifier}' en {$moduleName}.",
            'ELIMINAR' => "Se ha eliminado el registro '{$identifier}' en {$moduleName}.",
            default => "Acción {$action} ejecutada sobre '{$identifier}' en {$moduleName}.",
        };
    }
}
