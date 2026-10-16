<?php

namespace App\Http\Controllers;

use App\Models\InventorySupplier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de proveedores del módulo Inventario.
 */
class InventorySupplierController extends InventoryCatalogController
{
    protected function modelClass(): string
    {
        return InventorySupplier::class;
    }

    protected function label(): string
    {
        return 'proveedor';
    }

    protected function itemsForeignKey(): string
    {
        return 'supplier_id';
    }

    protected function dataFields(): array
    {
        return ['name', 'tax_id', 'contact_name', 'phone', 'email', 'address', 'notes'];
    }

    protected function rules(Request $request, bool $isCreate, ?int $farmId, $ignoreId = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('inventory_suppliers', 'name')
                    ->where(fn ($query) => $query->where('farm_id', $farmId))
                    ->ignore($ignoreId),
            ],
            'tax_id' => ['nullable', 'string', 'max:50'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
