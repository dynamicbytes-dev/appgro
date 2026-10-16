<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Lot;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InventoryModuleTest extends TestCase
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
            'name' => 'Admin Inventario',
            'email' => $email,
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $subordinate = User::create([
            'farm_id' => $farm->id,
            'name' => 'Juan',
            'lastname' => 'Encargado',
            'email' => 'encargado_'.$email,
            'password_hash' => Hash::make('password123'),
            'role' => 'subordinate',
            'is_active' => true,
        ]);

        DB::table('subordinate_modules')->updateOrInsert(
            ['user_id' => $subordinate->id, 'module_id' => $module->id],
            ['is_enabled' => true]
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');

        return [$farm, $admin, $token, $subordinate];
    }

    private function loginToken(string $email): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('data.access_token');
    }

    /**
     * Payload válido de insumo, sobreescribible.
     */
    private function itemPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Maíz molido',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'unit' => 'kg',
            'min_stock' => 10,
            'max_stock' => 500,
            'batch_number' => 'L-2026-01',
            'manufacturing_date' => now()->subMonth()->toDateString(),
            'expiration_date' => now()->addYear()->toDateString(),
            'location' => 'Bodega A',
            'unit_cost' => 2.5,
            'supplier' => 'Distribuidora del Norte',
        ], $overrides);
    }

    private function countLowStockNotifications(User $user): int
    {
        return (int) DB::table('notifications')
            ->where('notifiable_id', $user->id)
            ->where('data', 'like', '%inventory_low_stock%')
            ->count();
    }

    public function test_inventory_tables_have_all_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('inventory_items'), 'Table inventory_items must exist.');
        foreach ([
            'id', 'farm_id', 'code', 'name', 'category', 'current_stock', 'min_stock',
            'max_stock', 'batch_number', 'manufacturing_date', 'expiration_date',
            'location', 'unit', 'unit_cost', 'total_cost', 'supplier', 'last_purchase_date',
            'low_stock_alerted_at', 'created_by',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('inventory_items', $column),
                "Column '{$column}' is missing from 'inventory_items'."
            );
        }

        $this->assertTrue(Schema::hasTable('inventory_movements'), 'Table inventory_movements must exist.');
        foreach ([
            'id', 'farm_id', 'inventory_item_id', 'type', 'quantity',
            'resulting_stock', 'destination_lot_id', 'notes', 'movement_date', 'user_id',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('inventory_movements', $column),
                "Column '{$column}' is missing from 'inventory_movements'."
            );
        }
    }

    public function test_inventory_module_is_officially_registered(): void
    {
        $this->artisan('app:init-root');

        $module = Module::where('code', 'inventory')->first();

        $this->assertNotNull($module, "Module with code 'inventory' must be registered.");
        $this->assertEquals('Inventario', $module->name);
    }

    public function test_admin_cannot_access_inventory_if_module_is_disabled_for_farm(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Sin Inventario', 'admin_nomod_inv@test.com');

        $module = Module::where('code', 'inventory')->first();
        DB::table('farm_modules')
            ->where('farm_id', $farm->id)
            ->where('module_id', $module->id)
            ->update(['is_enabled' => false]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory')
            ->assertStatus(403)
            ->assertJson(['status' => 'error']);
    }

    public function test_admin_can_create_item_with_autogenerated_code_and_total_cost(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Alta Insumo', 'admin_crear_inv@test.com');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload([
                'unit_cost' => 3,
                'current_stock' => 20,
            ]))
            ->assertStatus(201)
            ->assertJson(['status' => 'success']);

        $this->assertSame('INS-00001', $response->json('data.code'));
        $this->assertSame('60.00', (string) $response->json('data.total_cost'));

        $this->assertDatabaseHas('inventory_items', [
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Maíz molido',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
        ]);

        // Auditoría
        $this->assertTrue(
            \App\Models\ActivityLog::where('module', 'Inventario')->where('action', 'CREAR')->exists(),
            'La creación del insumo debe quedar auditada.'
        );
    }

    public function test_item_requires_a_valid_unit_and_exposes_it(): void
    {
        [, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Unidad', 'admin_unidad_inv@test.com');

        // Sin unidad → 422
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload(['unit' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['unit']);

        // Unidad fuera del catálogo → 422
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload(['unit' => 'tonelada']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['unit']);

        // Unidad válida → 201 y se expone en el decorado
        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload(['unit' => 'cc']))
            ->assertStatus(201);

        $this->assertSame('cc', $response->json('data.unit'));
        $this->assertSame('cc', $response->json('data.unit_short'));
        $this->assertSame('Centímetro cúbico', $response->json('data.unit_label'));

        $this->assertDatabaseHas('inventory_items', [
            'id' => $response->json('data.id'),
            'unit' => 'cc',
        ]);
    }

    public function test_item_defaults_to_kg_when_unit_omitted_directly(): void
    {
        [$farm] = $this->createFarmWithAdminAndSubordinate('Granja Unidad Default', 'admin_unidad_def@test.com');

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00099',
            'name' => 'Alimento base',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 0,
            'min_stock' => 1,
            'unit_cost' => 1,
            'total_cost' => 0,
        ]);

        $this->assertSame('kg', $item->fresh()->unit);
    }

    public function test_second_item_gets_incremental_code(): void
    {
        [, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Correlativo', 'admin_corr_inv@test.com');

        $first = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload(['name' => 'Insumo A']));
        $second = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload(['name' => 'Insumo B']));

        $this->assertSame('INS-00001', $first->json('data.code'));
        $this->assertSame('INS-00002', $second->json('data.code'));
    }

    public function test_initial_stock_creates_entry_movement(): void
    {
        [, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Stock Inicial', 'admin_init_inv@test.com');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload(['current_stock' => 30]))
            ->assertStatus(201);

        $itemId = $response->json('data.id');

        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $itemId,
            'type' => InventoryMovement::TYPE_ENTRY,
            'quantity' => '30.00',
            'user_id' => $admin->id,
        ]);
    }

    public function test_entry_and_exit_movements_update_stock(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Mov Stock', 'admin_mov_inv@test.com');

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Vacuna',
            'category' => InventoryItem::CATEGORY_SANIDAD,
            'unit' => 'cc',
            'current_stock' => 5,
            'min_stock' => 2,
            'unit_cost' => 10,
            'total_cost' => 50,
        ]);

        // Entrada de 10 → 15 y actualiza última compra
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_ENTRY,
                'quantity' => 10,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.resulting_stock', '15.00')
            ->assertJsonPath('data.unit', 'cc')
            ->assertJsonPath('data.unit_short', 'cc');

        $item->refresh();
        $this->assertEquals(15.0, (float) $item->current_stock);
        $this->assertNotNull($item->last_purchase_date);

        // Salida de 5 → 10
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 5,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.resulting_stock', '10.00');

        $this->assertEquals(10.0, (float) $item->fresh()->current_stock);
    }

    public function test_exit_movement_fails_when_insufficient_stock(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Sin Stock', 'admin_falta_inv@test.com');

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Alimento',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 5,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 5,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 20,
            ])
            ->assertStatus(422)
            ->assertJson(['status' => 'error']);

        $this->assertEquals(5.0, (float) $item->fresh()->current_stock);
    }

    public function test_adjust_movement_accepts_signed_quantity(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Ajuste', 'admin_ajuste_inv@test.com');

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Repuesto',
            'category' => InventoryItem::CATEGORY_INFRAESTRUCTURA,
            'current_stock' => 10,
            'min_stock' => 0,
            'unit_cost' => 5,
            'total_cost' => 50,
        ]);

        // Ajuste negativo -3 → 7
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_ADJUST,
                'quantity' => -3,
                'notes' => 'Conteo físico',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.resulting_stock', '7.00');

        // Ajuste positivo +2 → 9
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_ADJUST,
                'quantity' => 2,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.resulting_stock', '9.00');

        $this->assertEquals(9.0, (float) $item->fresh()->current_stock);
    }

    public function test_adjust_cannot_leave_negative_stock(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Ajuste Neg', 'admin_ajusten_inv@test.com');

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Insumo',
            'category' => InventoryItem::CATEGORY_AGRICOLAS,
            'current_stock' => 4,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 4,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_ADJUST,
                'quantity' => -10,
            ])
            ->assertStatus(422);
    }

    public function test_low_stock_notifies_admin_only_once_until_recovery(): void
    {
        [$farm, $admin, $token] = $this->createFarmWithAdminAndSubordinate('Granja Alerta', 'admin_alerta_inv@test.com');

        // Insumo con 15 y mínimo 10 (sin alerta al crear)
        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Concentrado',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 15,
            'min_stock' => 10,
            'unit_cost' => 2,
            'total_cost' => 30,
        ]);

        $this->assertSame(0, $this->countLowStockNotifications($admin));

        // Salida de 6 → 9 (bajo mínimo) → notifica
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 6,
            ])
            ->assertStatus(201);

        $this->assertSame(1, $this->countLowStockNotifications($admin));

        // Otra salida de 2 → 7 (sigue bajo) → NO duplica la notificación
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 2,
            ])
            ->assertStatus(201);

        $this->assertSame(1, $this->countLowStockNotifications($admin));

        // Entrada de 20 → 27 (recuperado) → limpia la marca
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_ENTRY,
                'quantity' => 20,
            ])
            ->assertStatus(201);

        $this->assertNull($item->fresh()->low_stock_alerted_at);

        // Nueva salida de 20 → 7 → vuelve a notificar (total 2)
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 20,
            ])
            ->assertStatus(201);

        $this->assertSame(2, $this->countLowStockNotifications($admin));
    }

    public function test_subordinate_can_register_movements_but_not_create_items(): void
    {
        [$farm, , , $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Encargado', 'admin_enc_inv@test.com');

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Insumo',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 10,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 10,
        ]);

        $token = $this->loginToken($subordinate->email);

        // No puede crear insumos
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory', $this->itemPayload())
            ->assertStatus(403);

        // Sí puede registrar movimientos
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 3,
            ])
            ->assertStatus(201);

        // El responsable es el propio subordinado
        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $item->id,
            'user_id' => $subordinate->id,
            'type' => InventoryMovement::TYPE_EXIT,
        ]);
    }

    public function test_subordinate_cannot_access_global_listing_or_stats(): void
    {
        [, , , $subordinate] = $this->createFarmWithAdminAndSubordinate('Granja Blindaje Inv', 'admin_blind_inv@test.com');

        $token = $this->loginToken($subordinate->email);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory')
            ->assertStatus(403);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/stats')
            ->assertStatus(403);

        // Pero sí puede leer el inventario de su granja por /my
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/my')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);
    }

    public function test_items_are_isolated_by_farm(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Propia Inv', 'admin_prop_inv@test.com');

        // Granja ajena con su insumo
        $otherFarm = Farm::create(['name' => 'Granja Ajena Inv', 'sector' => 'bovino', 'is_active' => true]);
        InventoryItem::create([
            'farm_id' => $otherFarm->id,
            'code' => 'INS-00001',
            'name' => 'Insumo ajeno',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 99,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 99,
        ]);

        InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00002',
            'name' => 'Insumo propio',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 1,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 1,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory')
            ->assertStatus(200);

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertContains('Insumo propio', $names);
        $this->assertNotContains('Insumo ajeno', $names);
    }

    public function test_alerts_endpoint_returns_flagged_items(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Alertas', 'admin_alertas_inv@test.com');

        InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Bajo mínimo',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 2,
            'min_stock' => 10,
            'unit_cost' => 1,
            'total_cost' => 2,
        ]);

        InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00002',
            'name' => 'Vencido',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 50,
            'min_stock' => 5,
            'unit_cost' => 1,
            'total_cost' => 50,
            'expiration_date' => now()->subDay()->toDateString(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/inventory/alerts')
            ->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $this->assertCount(1, $response->json('data.low_stock'));
        $this->assertCount(1, $response->json('data.expired'));
        $this->assertSame('Bajo mínimo', $response->json('data.low_stock.0.name'));
        $this->assertSame('Vencido', $response->json('data.expired.0.name'));
    }

    public function test_movement_can_target_a_lot_of_the_same_farm(): void
    {
        [$farm, , $token] = $this->createFarmWithAdminAndSubordinate('Granja Destino', 'admin_dest_inv@test.com');

        $lot = Lot::create([
            'farm_id' => $farm->id,
            'code' => 'LOT-00001',
            'quantity' => 10,
            'status' => 'activo',
        ]);

        $item = InventoryItem::create([
            'farm_id' => $farm->id,
            'code' => 'INS-00001',
            'name' => 'Alimento',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'current_stock' => 20,
            'min_stock' => 0,
            'unit_cost' => 1,
            'total_cost' => 20,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/inventory/movements', [
                'inventory_item_id' => $item->id,
                'type' => InventoryMovement::TYPE_EXIT,
                'quantity' => 5,
                'destination_lot_id' => $lot->id,
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.destination_lot_id', $lot->id);
    }
}
