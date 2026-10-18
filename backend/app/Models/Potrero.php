<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Potrero extends Model
{
    use HasFactory, BelongsToFarm, Auditable;

    protected $table = 'potreros';

    protected $fillable = [
        'farm_id',
        'species_id',
        'name',
        'code',
        'category',
        'sector',
        'purpose',
        'max_capacity',
        'superficie_ha',
        'capacidad_ua',
        'operational_status',
        'tipo_pastura',
        'topografia',
        'tipo_cercado',
        'fuente_agua',
        'geometry',
        'centroid_lat',
        'centroid_lng',
        'geo_area_ha',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'max_capacity' => 'integer',
        'superficie_ha' => 'decimal:2',
        'capacidad_ua' => 'decimal:2',
        'fuente_agua' => 'array',
        'geometry' => 'array',
        'centroid_lat' => 'decimal:7',
        'centroid_lng' => 'decimal:7',
        'geo_area_ha' => 'decimal:4',
        'farm_id' => 'integer',
        'species_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Estados operativos manuales. El estado "ocupado" es derivado de los
     * lotes activos y nunca se persiste.
     */
    public const OPERATIONAL_STATUSES = ['disponible', 'descanso', 'mantenimiento'];

    public const TOPOGRAFIAS = ['plano', 'ondulado', 'quebrado'];

    /**
     * Estado mostrado del potrero: inactivo > ocupado (derivado) > manual.
     */
    public function displayStatus(?int $occupied = null): string
    {
        if (! $this->is_active) {
            return 'inactivo';
        }

        if ($occupied !== null && $occupied > 0) {
            return 'ocupado';
        }

        return $this->operational_status ?: 'disponible';
    }

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Potreros';
    }

    /**
     * Relationship with Farm.
     */
    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * Relationship with Species.
     */
    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    /**
     * Historial de tratamientos de manejo (fertilización, control, etc.).
     */
    public function treatments()
    {
        return $this->hasMany(PastureTreatment::class);
    }

    /**
     * Historial de aforos de forraje.
     */
    public function biomassSurveys()
    {
        return $this->hasMany(PastureBiomassSurvey::class);
    }
}
