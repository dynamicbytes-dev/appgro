<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\InventoryItem;
use App\Models\InventorySupplier;
use App\Models\InventoryWarehouse;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InventoryCatalogTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Crea una granja con el módulo de inventario habilitado, un
     * administrador autenticado y un subordinado con el módulo asignado.
     * Devuelve [$farm, $admin, $token, $subordinate].
     */
    private function createFarmWithAdminAndSubordinate(string $name, string $email): array
    {
        $this->artisan('app:init-root');

        $farm = Farm::create([
            'name' => $name,
            'sector' => 'porcino',
            'is_active' => true,
        ]);

        $module = Module::where('code', 'inventory')->first();

        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farm->id, 'module_id' => $module->id],
            ['is_enabled' => true]
        );

        $admin = User::create([
            'farm_id' => $farm->id,
            'name' => 'Admin Catálogo',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $subordinate = User::create([
            'farm_id' => $farm->id,
            'name' => 'Peón',
            'lastname' => 'Bodega',
            'email' => 'encargado_'.$email,
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        DB::table('subordinate_modules')->updateOrInsert(
            ['user_id' => $subordinate->id, 'module_id' => $module->id],
            ['is_enabled' => true]
        );

        $token = $this->loginToken($email);

        return [$farm, $admin, $token, $subordinate];
    }

    private function loginToken(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');
    }

    private function createRoot(string $email = 'root_catalog@test.com'): string
    {
        $this->artisan('app:init-root');

        User::create([
            'farm_id' => null,
            'name' => 'Root Catálogo',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'root',
            'is_active' => true,
        ]);

        return $this->loginToken($email);
    }

    public function test_catalog_tables_and_item_columns_exist(): void
    {
        $this->assertTrue(Schema::hasTable('inventory_suppliers'));
        $this->assertTrue(Schema::hasTable('inventory_warehouses'));

        foreach (['id', 'farm_id', 'name', 'tax_id', 'contact_name', 'phone', 'email', 'address', 'notes', 'is_active', 'created_by'] as $column) {
            $this->assertTrue(Schema::hasColumn('inventory_suppliers', $column), "Falta '{$column}' en inventory_suppliers.");
        }

        foreach (['id', 'farm_id', 'name', 'code', 'address', 'manager_name', 'notes', 'is_active', 'created_by'] as $column) {
            $this->assertTrue(Schema::hasColumn('inventory_warehouses', $column), "Falta '{$column}' en inventory_warehouses.");
        }

        $this->assertTrue(Schema::hasColumn('inventory_items', 'supplier_id'));
        $this->assertTrue(Schema::hasColumn('inventory_items', 'warehouse_id'));
        $this->assertTrue(Schema::hasColumn('inventory_items', 'unit'));
    }

    public function test_admin_can_create_and_list_suppliers(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Prov', 'admin_prov@test.com');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/suppliers', [
                'name' => 'Distribuidora del Norte',
                'tax_id' => '1790012345001',
                'contact_name' => 'Ana Pérez',
                'phone' => '0999999999',
                'email' => 'ventas@delnorte.com',
                'address' => 'Av. Principal 123',
            ])
            ->assertStatus(201)
            ->assertJson(['status' => 'success'])
            ->assertJsonPath('data.name', 'Distribuidora del Norte');

        $this->assertDatabaseHas('inventory_suppliers', [
            'farm_id' => $farm->id,
            'name' => 'Distribuidora del Norte',
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/suppliers')
            ->assertStatus(200);

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Distribuidora del Norte', $response->json('data.0.name'));
    }

    public function test_supplier_name_is_unique_per_farm_but_reusable_across_farms(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Dup', 'admin_dup@test.com');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/suppliers', ['name' => 'Acme'])
            ->assertStatus(201);

        // Mismo nombre en la misma granja → error de validación.
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/suppliers', ['name' => 'Acme'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        // Mismo nombre en otra granja → permitido.
        $otherFarm = Farm::create(['name' => 'Granja Otra', 'sector' => 'bovino', 'is_active' => true]);
        InventorySupplier::create(['farm_id' => $otherFarm->id, 'name' => 'Acme', 'is_active' => true]);

        $this->assertSame(1, InventorySupplier::withoutGlobalScopes()->where('farm_id', $farm->id)->where('name', 'Acme')->count());
        $this->assertSame(1, InventorySupplier::withoutGlobalScopes()->where('farm_id', $otherFarm->id)->where('name', 'Acme')->count());
    }

    public function test_subordinate_can_read_but_not_manage_suppliers(): void
    {
        [, , , $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Readonly Prov', 'admin_ro_prov@test.com');

        $token = $this->loginToken($subordinate->email);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/suppliers')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/suppliers', ['name' => 'No permitido'])
            ->assertStatus(403);
    }

    public function test_suppliers_are_isolated_by_farm(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Prop Prov', 'admin_prop_prov@test.com');

        $otherFarm = Farm::create(['name' => 'Granja Ajena Prov', 'sector' => 'bovino', 'is_active' => true]);
        InventorySupplier::create(['farm_id' => $otherFarm->id, 'name' => 'Proveedor ajeno', 'is_active' => true]);
        InventorySupplier::create(['farm_id' => $farm->id, 'name' => 'Proveedor propio', 'is_active' => true]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/suppliers')
            ->assertStatus(200);

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertContains('Proveedor propio', $names);
        $this->assertNotContains('Proveedor ajeno', $names);
    }

    public function test_admin_can_update_and_delete_supplier_and_items_are_unlinked(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Edit Prov', 'admin_edit_prov@test.com');

        $supplier = InventorySupplier::create([
            'farm_id' => $farm->id,
            'name' => 'Proveedor viejo',
            'is_active' => true,
        ]);

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Insumo enlazado',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 1,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 1,
            'supplier_id' => $supplier->id,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/inventory/suppliers/'.$supplier->id, [
                'name' => 'Proveedor nuevo',
                'phone' => '0888888888',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.name', 'Proveedor nuevo');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/v1/inventory/suppliers/'.$supplier->id)
            ->assertStatus(200);

        $this->assertDatabaseMissing('inventory_suppliers', ['id' => $supplier->id]);
        $this->assertNull($item->fresh()->supplier_id);
    }

    public function test_root_can_create_supplier_for_any_farm_and_must_specify_farm(): void
    {
        $this->createFarmWithAdminAndSubordinate('Granja Root Prov', 'admin_root_prov@test.com');
        $root = $this->createRoot();

        $farm = Farm::create(['name' => 'Granja Root Destino', 'sector' => 'porcino', 'is_active' => true]);

        // Sin farm_id → 422
        $this->withHeader('Authorization', 'Bearer '.$root)
            ->postJson('/api/v1/inventory/suppliers', ['name' => 'Sin granja'])
            ->assertStatus(422);

        // Con farm_id → 201
        $this->withHeader('Authorization', 'Bearer '.$root)
            ->postJson('/api/v1/inventory/suppliers', [
                'name' => 'Proveedor global',
                'farm_id' => $farm->id,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('inventory_suppliers', [
            'farm_id' => $farm->id,
            'name' => 'Proveedor global',
        ]);

        // Sin filtro ve de todas las granjas
        $response = $this->withHeader('Authorization', 'Bearer '.$root)
            ->getJson('/api/v1/inventory/suppliers')
            ->assertStatus(200);

        $this->assertGreaterThanOrEqual(1, count($response->json('data')));
    }

    public function test_admin_can_create_list_and_update_warehouses(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Bod', 'admin_bod@test.com');

        $created = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/warehouses', [
                'name' => 'Bodega Central',
                'code' => 'BOD-01',
                'address' => 'Sector norte',
                'manager_name' => 'Luis Gómez',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Bodega Central');

        $warehouseId = $created->json('data.id');

        $this->assertDatabaseHas('inventory_warehouses', [
            'farm_id' => $farm->id,
            'name' => 'Bodega Central',
            'code' => 'BOD-01',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/v1/inventory/warehouses/'.$warehouseId, [
                'name' => 'Bodega Central 2',
                'code' => 'BOD-01',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.name', 'Bodega Central 2');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/v1/inventory/warehouses/'.$warehouseId)
            ->assertStatus(200);

        $this->assertDatabaseMissing('inventory_warehouses', ['id' => $warehouseId]);
    }

    public function test_subordinate_can_read_but_not_manage_warehouses(): void
    {
        [, , , $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Readonly Bod', 'admin_ro_bod@test.com');

        $token = $this->loginToken($subordinate->email);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/warehouses')
            ->assertStatus(200);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/warehouses', ['name' => 'No permitido'])
            ->assertStatus(403);
    }

    public function test_item_can_reference_supplier_and_warehouse_of_same_farm(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Item Cat', 'admin_item_cat@test.com');

        $supplier = InventorySupplier::create(['farm_id' => $farm->id, 'name' => 'Proveedor Uno', 'is_active' => true]);
        $warehouse = InventoryWarehouse::create(['farm_id' => $farm->id, 'name' => 'Bodega Uno', 'is_active' => true]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', [
                'name' => 'Insumo con catálogos',
                'category' => InventoryItem::CATEGORY_ALIMENTOS,
                'unit' => 'kg',
                'min_stock' => 5,
                'unit_cost' => 2,
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('inventory_items', [
            'id' => $response->json('data.id'),
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
        ]);

        // El decorado expone los nombres como strings (compatibilidad UI).
        $this->assertSame('Proveedor Uno', $response->json('data.supplier_name'));
        $this->assertSame('Proveedor Uno', $response->json('data.supplier'));
        $this->assertSame('Bodega Uno', $response->json('data.warehouse_name'));
        $this->assertSame('Bodega Uno', $response->json('data.location'));
    }

    public function test_item_rejects_supplier_or_warehouse_from_another_farm(): void
    {
        [, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Item Cruce', 'admin_item_cruce@test.com');

        $otherFarm = Farm::create(['name' => 'Granja Ajena Item', 'sector' => 'bovino', 'is_active' => true]);
        $foreignSupplier = InventorySupplier::create(['farm_id' => $otherFarm->id, 'name' => 'Ajeno', 'is_active' => true]);
        $foreignWarehouse = InventoryWarehouse::create(['farm_id' => $otherFarm->id, 'name' => 'Ajeno', 'is_active' => true]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', [
                'name' => 'Insumo inválido',
                'category' => InventoryItem::CATEGORY_ALIMENTOS,
                'unit' => 'kg',
                'min_stock' => 5,
                'unit_cost' => 2,
                'supplier_id' => $foreignSupplier->id,
                'warehouse_id' => $foreignWarehouse->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['supplier_id', 'warehouse_id']);
    }

    public function test_legacy_free_text_supplier_and_location_still_work(): void
    {
        [, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Legacy', 'admin_legacy@test.com');

        // Payload heredado (texto libre) debe seguir funcionando.
        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', [
                'name' => 'Insumo legado',
                'category' => InventoryItem::CATEGORY_ALIMENTOS,
                'unit' => 'kg',
                'min_stock' => 1,
                'unit_cost' => 1,
                'supplier' => 'Proveedor texto',
                'location' => 'Bodega texto',
            ])
            ->assertStatus(201);

        $this->assertSame('Proveedor texto', $response->json('data.supplier_name'));
        $this->assertSame('Bodega texto', $response->json('data.warehouse_name'));
    }
}
