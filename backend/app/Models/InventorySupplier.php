<?php

namespace App\Models;

use App\Traits\Auditable;
use App\Traits\BelongsToFarm;
use Illuminate\Database\Eloquent\Model;

/**
 * Proveedor del módulo Inventario.
 *
 * Catálogo por granja que alimenta el campo `supplier_id` de los
 * insumos. Los administradores/root gestionan el CRUD; el encargado
 * (subordinado) solo puede consultarlo.
 */
class InventorySupplier extends Model
{
    use Auditable, BelongsToFarm;

    protected $table = 'inventory_suppliers';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'farm_id',
        'name',
        'tax_id',
        'contact_name',
        'phone',
        'email',
        'address',
        'notes',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'farm_id' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Audit log module name.
     */
    public function getAuditModule(): string
    {
        return 'Inventario';
    }

    /**
     * Descripción legible para el historial de auditoría.
     */
    public function getAuditDescription(string $action): string
    {
        return match ($action) {
            'CREAR' => "Se ha creado el proveedor '{$this->name}' en Inventario.",
            'ACTUALIZAR' => "Se ha actualizado el proveedor '{$this->name}' en Inventario.",
            'ELIMINAR' => "Se ha eliminado el proveedor '{$this->name}' en Inventario.",
            default => "Acción {$action} ejecutada sobre el proveedor '{$this->name}' en Inventario.",
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

    /**
     * Insumos que tienen este proveedor como principal.
     */
    public function items()
    {
        return $this->hasMany(InventoryItem::class, 'supplier_id');
    }
}
