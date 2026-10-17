<?php

namespace Tests\Feature;

use App\Models\Farm;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\InventoryMovement;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RootInventoryMultiFarmAuditTest extends TestCase
{
    use RefreshDatabase;

    private function setupFarmsAndUsers(): array
    {
        $this->artisan('app:init-root');

        $root = User::where('role', 'root')->first();
        $rootLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'rosangeles92@gmail.com',
            'password' => 'Miranda*30',
        ]);
        $rootToken = $rootLogin->json('data.access_token');

        // Farm 1
        $farm1 = Farm::create([
            'name' => 'Granja Los Andes',
            'sector' => 'porcino',
            'is_active' => true,
        ]);
        // Farm 2
        $farm2 = Farm::create([
            'name' => 'Granja El Roble',
            'sector' => 'avicola',
            'is_active' => true,
        ]);

        $module = Module::where('code', 'inventory')->first();
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farm1->id, 'module_id' => $module->id],
            ['is_enabled' => true]
        );
        DB::table('farm_modules')->updateOrInsert(
            ['farm_id' => $farm2->id, 'module_id' => $module->id],
            ['is_enabled' => true]
        );

        // Admin 1
        $admin1 = User::create([
            'farm_id' => $farm1->id,
            'name' => 'Admin Andes',
            'email' => 'admin.andes@zootika.test',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        $token1 = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin.andes@zootika.test',
            'password' => 'password123',
        ])->json('data.access_token');

        // Admin 2
        $admin2 = User::create([
            'farm_id' => $farm2->id,
            'name' => 'Admin Roble',
            'email' => 'admin.roble@zootika.test',
            'password_hash' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        $token2 = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin.roble@zootika.test',
            'password' => 'password123',
        ])->json('data.access_token');

        return [$root, $rootToken, $farm1, $admin1, $token1, $farm2, $admin2, $token2];
    }

    public function test_root_can_audit_all_inventories_and_filter_by_farm()
    {
        [$root, $rootToken, $farm1, $admin1, $token1, $farm2, $admin2, $token2] = $this->setupFarmsAndUsers();

        // Crear insumo en Granja 1
        $item1 = InventoryItem::create([
            'farm_id' => $farm1->id,
            'code' => 'INS-ANDES-001',
            'name' => 'Balanceado Cerdas Gestantes',
            'category' => InventoryItem::CATEGORY_ALIMENTOS,
            'unit' => 'kg',
            'current_stock' => 50,
            'min_stock' => 100, // En alerta bajo stock
            'unit_cost' => 1.50,
            'total_cost' => 75.00,
            'created_by' => $admin1->id,
        ]);

        // Crear lote de insumo en Granja 1
        $lotInsumo1 = InventoryLot::create([
            'farm_id' => $farm1->id,
            'inventory_item_id' => $item1->id,
            'code' => 'LOTE-ANDES-A1',
            'expiration_date' => now()->addDays(5)->toDateString(), // Por vencer
            'created_by' => $admin1->id,
        ]);

        // Crear movimiento en Granja 1
        $mov1 = InventoryMovement::create([
            'farm_id' => $farm1->id,
            'inventory_item_id' => $item1->id,
            'type' => InventoryMovement::TYPE_ENTRY,
            'quantity' => 50,
            'resulting_stock' => 50,
            'inventory_lot_id' => $lotInsumo1->id,
            'movement_date' => now(),
            'user_id' => $admin1->id,
        ]);

        // Crear insumo en Granja 2
        $item2 = InventoryItem::create([
            'farm_id' => $farm2->id,
            'code' => 'INS-ROBLE-001',
            'name' => 'Vacuna Triple Aviar',
            'category' => InventoryItem::CATEGORY_SANIDAD,
            'unit' => 'dosis',
            'current_stock' => 200,
            'min_stock' => 50,
            'unit_cost' => 3.00,
            'total_cost' => 600.00,
            'created_by' => $admin2->id,
        ]);

        // Crear lote de insumo en Granja 2
        $lotInsumo2 = InventoryLot::create([
            'farm_id' => $farm2->id,
            'inventory_item_id' => $item2->id,
            'code' => 'LOTE-ROBLE-V1',
            'expiration_date' => now()->addMonths(6)->toDateString(),
            'created_by' => $admin2->id,
        ]);

        // Crear movimiento en Granja 2
        $mov2 = InventoryMovement::create([
            'farm_id' => $farm2->id,
            'inventory_item_id' => $item2->id,
            'type' => InventoryMovement::TYPE_ENTRY,
            'quantity' => 200,
            'resulting_stock' => 200,
            'inventory_lot_id' => $lotInsumo2->id,
            'movement_date' => now(),
            'user_id' => $admin2->id,
        ]);

        // ----------------------------------------------------
        // 1. Verificación de Aislamiento Estricto para Admin
        // ----------------------------------------------------
        // Admin 1 solo ve insumo de Granja 1, incluso si envía ?farm_id={farm2}
        $respAdmin1 = $this->withHeader('Authorization', 'Bearer '.$token1)
            ->getJson('/api/v1/inventory?farm_id='.$farm2->id);
        $respAdmin1->assertStatus(200);
        $this->assertCount(1, $respAdmin1->json('data'));
        $this->assertEquals($item1->id, $respAdmin1->json('data.0.id'));

        // ----------------------------------------------------
        // 2. Consulta Global de Root (farm_id=all o sin farm_id)
        // ----------------------------------------------------
        $respRootAll = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory?farm_id=all');
        $respRootAll->assertStatus(200);
        $this->assertCount(2, $respRootAll->json('data'));

        $items = collect($respRootAll->json('data'))->keyBy('id');
        $this->assertTrue($items->has($item1->id));
        $this->assertTrue($items->has($item2->id));
        $this->assertEquals('Granja Los Andes', $items[$item1->id]['farm_name']);
        $this->assertEquals($farm1->id, $items[$item1->id]['farm']['id']);
        $this->assertEquals('Granja El Roble', $items[$item2->id]['farm_name']);
        $this->assertEquals($farm2->id, $items[$item2->id]['farm']['id']);

        // ----------------------------------------------------
        // 3. Consulta de Root filtrando por Granja 1
        // ----------------------------------------------------
        $respRootFarm1 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory?farm_id='.$farm1->id);
        $respRootFarm1->assertStatus(200);
        $this->assertCount(1, $respRootFarm1->json('data'));
        $this->assertEquals($item1->id, $respRootFarm1->json('data.0.id'));
        $this->assertEquals('Granja Los Andes', $respRootFarm1->json('data.0.farm_name'));

        // ----------------------------------------------------
        // 4. Consulta de Root filtrando por Granja 2
        // ----------------------------------------------------
        $respRootFarm2 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory?farm_id='.$farm2->id);
        $respRootFarm2->assertStatus(200);
        $this->assertCount(1, $respRootFarm2->json('data'));
        $this->assertEquals($item2->id, $respRootFarm2->json('data.0.id'));
        $this->assertEquals('Granja El Roble', $respRootFarm2->json('data.0.farm_name'));

        // ----------------------------------------------------
        // 5. Movimientos: Root audita todas las granjas o filtra
        // ----------------------------------------------------
        $respMovAll = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/movements');
        $respMovAll->assertStatus(200);
        $this->assertCount(2, $respMovAll->json('data'));
        $movs = collect($respMovAll->json('data'))->keyBy('id');
        $this->assertEquals('Granja Los Andes', $movs[$mov1->id]['farm_name']);
        $this->assertEquals('Granja El Roble', $movs[$mov2->id]['farm_name']);

        $respMovFarm1 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/movements?farm_id='.$farm1->id);
        $respMovFarm1->assertStatus(200);
        $this->assertCount(1, $respMovFarm1->json('data'));
        $this->assertEquals($mov1->id, $respMovFarm1->json('data.0.id'));

        // ----------------------------------------------------
        // 6. Lotes de Insumos: Root audita todas las granjas o filtra
        // ----------------------------------------------------
        $respLotsAll = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/lots?farm_id=all');
        $respLotsAll->assertStatus(200);
        $this->assertCount(2, $respLotsAll->json('data'));
        $lots = collect($respLotsAll->json('data'))->keyBy('id');
        $this->assertEquals('Granja Los Andes', $lots[$lotInsumo1->id]['farm_name']);
        $this->assertEquals('Granja El Roble', $lots[$lotInsumo2->id]['farm_name']);

        $respLotsFarm2 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/lots?farm_id='.$farm2->id);
        $respLotsFarm2->assertStatus(200);
        $this->assertCount(1, $respLotsFarm2->json('data'));
        $this->assertEquals($lotInsumo2->id, $respLotsFarm2->json('data.0.id'));

        // ----------------------------------------------------
        // 7. Alertas de Inventario: Root audita alertas globales o por granja
        // ----------------------------------------------------
        $respAlertsAll = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/alerts?farm_id=all');
        $respAlertsAll->assertStatus(200);
        // Granja 1 tiene item1 en low_stock
        $lowStockAll = $respAlertsAll->json('data.low_stock');
        $this->assertCount(1, $lowStockAll);
        $this->assertEquals($item1->id, $lowStockAll[0]['id']);
        $this->assertEquals('Granja Los Andes', $lowStockAll[0]['farm_name']);

        // Granja 2 no tiene alertas de bajo stock
        $respAlertsFarm2 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/alerts?farm_id='.$farm2->id);
        $respAlertsFarm2->assertStatus(200);
        $this->assertCount(0, $respAlertsFarm2->json('data.low_stock'));

        // ----------------------------------------------------
        // 8. Estadísticas KPI de Inventario
        // ----------------------------------------------------
        // Consolidado global: 2 insumos, valor total = 75 + 600 = 675.00
        $respStatsAll = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/stats?farm_id=all');
        $respStatsAll->assertStatus(200);
        $this->assertEquals(2, $respStatsAll->json('data.total_items'));
        $this->assertEquals(675.00, $respStatsAll->json('data.total_value'));
        $this->assertEquals(1, $respStatsAll->json('data.low_stock'));

        // Granja 1: 1 insumo, valor total = 75.00
        $respStatsFarm1 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/stats?farm_id='.$farm1->id);
        $respStatsFarm1->assertStatus(200);
        $this->assertEquals(1, $respStatsFarm1->json('data.total_items'));
        $this->assertEquals(75.00, $respStatsFarm1->json('data.total_value'));

        // ----------------------------------------------------
        // 9. Reporte Ejecutivo de KPIs para PDF (/api/reports/inventario/executive-kpis)
        // ----------------------------------------------------
        $respReportAll = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/reports/inventario/executive-kpis');
        $respReportAll->assertStatus(200);
        $this->assertEquals('Consolidado Multigranja (Global)', $respReportAll->json('audit.farm_name'));
        $this->assertCount(2, $respReportAll->json('items'));

        $respReportFarm1 = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/reports/inventario/executive-kpis?farm_id='.$farm1->id);
        $respReportFarm1->assertStatus(200);
        $this->assertEquals('Granja Los Andes', $respReportFarm1->json('audit.farm_name'));
        $this->assertCount(1, $respReportFarm1->json('items'));
        $this->assertEquals($item1->id, $respReportFarm1->json('items.0.id'));

        // ----------------------------------------------------
        // 10. Consulta Individual Show (/api/v1/inventory/{id})
        // ----------------------------------------------------
        // Admin 1 no puede ver el insumo de Granja 2 (404)
        $respShowAdmin = $this->withHeader('Authorization', 'Bearer '.$token1)
            ->getJson('/api/v1/inventory/'.$item2->id);
        $respShowAdmin->assertStatus(404);

        // Root puede consultar insumos de cualquier granja con su relación farm cargada
        $respShowRoot = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/'.$item2->id);
        $respShowRoot->assertStatus(200);
        $this->assertEquals('Granja El Roble', $respShowRoot->json('data.farm_name'));
        $this->assertEquals($farm2->id, $respShowRoot->json('data.farm.id'));

        // ----------------------------------------------------
        // 11. Bandeja /inventory/my
        // ----------------------------------------------------
        $respMyRoot = $this->withHeader('Authorization', 'Bearer '.$rootToken)
            ->getJson('/api/v1/inventory/my?farm_id=all');
        $respMyRoot->assertStatus(200);
        $this->assertCount(2, $respMyRoot->json('data'));
    }
}
