<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Model;

/**
 * Actividad operativa (tarea) creada por un administrador y asignada
 * a un subordinado de la misma granja.
 *
 * Estados:
 *  - 'pendiente'   → creada y asignada, el subordinado aún no inicia.
 *  - 'en_proceso'  → el subordinado dio inicio a la tarea.
 *  - 'terminada'   → el subordinado la culminó (completed_at).
 *
 * El subordinado solo puede elegir entre 'en_proceso' y 'terminada';
 * 'pendiente' es exclusivo del momento de creación.
 */
class Activity extends Model
{
    use Auditable, BelongsToFarm;

    protected $table = 'activities';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public const STATUS_PENDING = 'pendiente';
    public const STATUS_IN_PROGRESS = 'en_proceso';
    public const STATUS_COMPLETED = 'terminada';

    /**
     * Etiquetas en español de cada estado.
     */
    public const STATUS_LABELS = [
        self::STATUS_PENDING => 'Pendiente',
        self::STATUS_IN_PROGRESS => 'En proceso',
        self::STATUS_COMPLETED => 'Terminada',
    ];

    /**
     * Únicos estados que el subordinado puede seleccionar.
     */
    public const SUBORDINATE_STATUS_OPTIONS = [
        self::STATUS_IN_PROGRESS,
        self::STATUS_COMPLETED,
    ];

    protected $fillable = [
        'farm_id',
        'created_by',
        'assigned_to',
        'title',
        'description',
        'due_date',
        'status',
        'completed_at',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'created_by' => 'integer',
        'assigned_to' => 'integer',
        'due_date' => 'date',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Actividades';
    }

    /**
     * Descripción legible para el historial de auditoría.
     */
    public function getAuditDescription(string $action): string
    {
        return match ($action) {
            'CREAR' => "Se ha creado la actividad '{$this->title}' en Actividades.",
            'ACTUALIZAR' => "Se ha actualizado la actividad '{$this->title}' en Actividades.",
            'ELIMINAR' => "Se ha eliminado la actividad '{$this->title}' en Actividades.",
            default => "Acción {$action} ejecutada sobre la actividad '{$this->title}' en Actividades.",
        };
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Actividades vencidas: fecha límite ya pasada y aún no terminadas.
     */
    public function scopeOverdue($query)
    {
        return $query->where('due_date', '<', now()->toDateString())
            ->where('status', '!=', self::STATUS_COMPLETED);
    }

    /**
     * Etiqueta legible del estado actual.
     */
    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    /**
     * ¿La actividad está vencida (sin terminar y con fecha límite pasada)?
     */
    public function isOverdue(): bool
    {
        return $this->status !== self::STATUS_COMPLETED
            && $this->due_date
            && $this->due_date->lt(now()->startOfDay());
    }
}
