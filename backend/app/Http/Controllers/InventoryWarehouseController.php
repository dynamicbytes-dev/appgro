<?php

namespace App\Http\Controllers;

use App\Models\InventoryWarehouse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de bodegas (ubicaciones físicas) del módulo Inventario.
 */
class InventoryWarehouseController extends InventoryCatalogController
{
    protected function modelClass(): string
    {
        return InventoryWarehouse::class;
    }

    protected function label(): string
    {
        return 'bodega';
    }

    protected function itemsForeignKey(): string
    {
        return 'warehouse_id';
    }

    protected function dataFields(): array
    {
        return ['name', 'code', 'address', 'manager_name', 'notes'];
    }

    protected function rules(Request $request, bool $isCreate, ?int $farmId, $ignoreId = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('inventory_warehouses', 'name')
                    ->where(fn ($query) => $query->where('farm_id', $farmId))
                    ->ignore($ignoreId),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'manager_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
