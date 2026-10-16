<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\Api\ExecutivePdfReportController;
use App\Http\Controllers\AppConfigController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BarnController;
use App\Http\Controllers\GalponController;
use App\Http\Controllers\HistoryController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InventoryLotController;
use App\Http\Controllers\InventoryMovementController;
use App\Http\Controllers\InventorySupplierController;
use App\Http\Controllers\InventoryWarehouseController;
use App\Http\Controllers\LotController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Root\RootAdminController;
use App\Http\Controllers\Root\RootDashboardController;
use App\Http\Controllers\Root\RootFarmController;
use App\Http\Controllers\SpeciesController;
use App\Http\Controllers\SubordinateController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - AppGropecuaria Multi-Farm Backend
|--------------------------------------------------------------------------
*/

$registerRoutes = function () {
    // Public application metadata and configuration routes
    Route::get('config', [AppConfigController::class, 'index']);
    Route::get('metadata', [AppConfigController::class, 'index']);
    Route::get('settings', [AppConfigController::class, 'index']);
    Route::get('app-info', [AppConfigController::class, 'index']);

    // Public authentication routes
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login']);

        // Protected authentication routes
        Route::middleware('jwt.auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::post('refresh', [AuthController::class, 'refresh']);
            Route::get('me', [AuthController::class, 'me']);
            Route::get('modules', [AuthController::class, 'userModules']);
            Route::put('profile', [AuthController::class, 'updateProfile']);
        });
    });

    // Root Exclusive Management Routes (Protected by JWT + root.access middleware)
    Route::middleware(['jwt.auth', 'root.access'])->prefix('root')->group(function () {
        // Dashboard Stats
        Route::get('stats', [RootDashboardController::class, 'stats']);
        Route::get('dashboard', [RootDashboardController::class, 'stats']);

        // Farm Management
        Route::get('farms/select', [RootFarmController::class, 'select']);
        Route::get('farms', [RootFarmController::class, 'index']);
        Route::post('farms', [RootFarmController::class, 'store']);
        Route::get('farms/{id}', [RootFarmController::class, 'show']);
        Route::put('farms/{id}', [RootFarmController::class, 'update']);

        // Farm Modules Management
        Route::get('farms/{id}/modules', [RootFarmController::class, 'getFarmModules']);
        Route::put('farms/{id}/modules', [RootFarmController::class, 'updateFarmModules']);
        Route::put('farms/{id}/modules/{moduleId}', [RootFarmController::class, 'updateSingleFarmModule']);

        // Admin Users Management (Farm Owners)
        Route::get('admins', [RootAdminController::class, 'index']);
        Route::post('admins', [RootAdminController::class, 'store']);
        Route::get('admins/{id}', [RootAdminController::class, 'show']);
        Route::put('admins/{id}', [RootAdminController::class, 'update']);
        Route::patch('admins/{id}', [RootAdminController::class, 'update']);
        Route::patch('admins/{id}/status', [RootAdminController::class, 'toggleStatus']);
        Route::patch('admins/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
        Route::put('admins/{id}/status', [RootAdminController::class, 'toggleStatus']);
        Route::put('admins/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
        Route::post('admins/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
        Route::patch('admin-users/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
        Route::put('admin-users/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
        Route::patch('admin-users/{id}/status', [RootAdminController::class, 'toggleStatus']);
        Route::put('admin-users/{id}/status', [RootAdminController::class, 'toggleStatus']);

        // System Activity Logs & Audit History
        Route::get('history/stats', [HistoryController::class, 'stats']);
        Route::get('history/summary', [HistoryController::class, 'stats']);
        Route::get('history', [HistoryController::class, 'index']);
        Route::get('history/{id}', [HistoryController::class, 'show']);
        Route::get('activity-logs/stats', [HistoryController::class, 'stats']);
        Route::get('activity-logs/summary', [HistoryController::class, 'stats']);
        Route::get('activity-logs', [HistoryController::class, 'index']);
        Route::get('activity-logs/{id}', [HistoryController::class, 'show']);

        // Galpones & Barns Root Management
        Route::get('galpones/stats', [GalponController::class, 'stats']);
        Route::get('galpones/summary', [GalponController::class, 'stats']);
        Route::get('galpones', [GalponController::class, 'index']);
        Route::post('galpones', [GalponController::class, 'store']);
        Route::get('galpones/{id}', [GalponController::class, 'show']);
        Route::put('galpones/{id}', [GalponController::class, 'update']);
        Route::patch('galpones/{id}/status', [GalponController::class, 'toggleStatus']);
        Route::delete('galpones/{id}', [GalponController::class, 'destroy']);

        Route::get('barns/stats', [BarnController::class, 'stats']);
        Route::get('barns/summary', [BarnController::class, 'stats']);
        Route::get('barns', [BarnController::class, 'index']);
        Route::post('barns', [BarnController::class, 'store']);
        Route::get('barns/{id}', [BarnController::class, 'show']);
        Route::put('barns/{id}', [BarnController::class, 'update']);
        Route::patch('barns/{id}/status', [BarnController::class, 'toggleStatus']);
        Route::delete('barns/{id}', [BarnController::class, 'destroy']);
    });

    // Operational routes protected by JWT + Module Access Middleware
    Route::middleware('jwt.auth')->group(function () {

        // Reportes Ejecutivos para Exportación PDF
        Route::get('reports/{module}/executive-kpis', [ExecutivePdfReportController::class, 'getModuleKpiReport']);

        // Farm Selector for Forms & Selects
        Route::get('farms/select', [RootFarmController::class, 'select']);
        Route::get('farms', [RootFarmController::class, 'index']);

        // Admin Dashboard & Available Farm Modules
        Route::get('admin/dashboard', [AdminDashboardController::class, 'index']);
        Route::get('admin/available-modules', [SubordinateController::class, 'availableModules']);
        Route::get('admin/subordinates', [SubordinateController::class, 'index']);

        // Farm Modules Direct Access
        Route::get('farms/{id}/modules', [RootFarmController::class, 'getFarmModules']);
        Route::put('farms/{id}/modules', [RootFarmController::class, 'updateFarmModules']);
        Route::put('farms/{id}/modules/{moduleId}', [RootFarmController::class, 'updateSingleFarmModule']);

        // Admin Management Direct Access (Root access required)
        Route::middleware('root.access')->group(function () {
            Route::get('admins', [RootAdminController::class, 'index']);
            Route::post('admins', [RootAdminController::class, 'store']);
            Route::get('admins/{id}', [RootAdminController::class, 'show']);
            Route::put('admins/{id}', [RootAdminController::class, 'update']);
            Route::patch('admins/{id}', [RootAdminController::class, 'update']);
            Route::patch('admins/{id}/status', [RootAdminController::class, 'toggleStatus']);
            Route::patch('admins/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
            Route::put('admins/{id}/status', [RootAdminController::class, 'toggleStatus']);
            Route::put('admins/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
            Route::post('admins/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
            Route::patch('admin-users/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
            Route::put('admin-users/{id}/toggle-status', [RootAdminController::class, 'toggleStatus']);
            Route::patch('admin-users/{id}/status', [RootAdminController::class, 'toggleStatus']);
            Route::put('admin-users/{id}/status', [RootAdminController::class, 'toggleStatus']);
        });

        // Subordinates / Encargados Management (Admin access)
        Route::prefix('subordinates')->group(function () {
            Route::get('/', [SubordinateController::class, 'index']);
            Route::get('available-modules', [SubordinateController::class, 'availableModules']);
            Route::post('/', [SubordinateController::class, 'store']);
            Route::get('{id}', [SubordinateController::class, 'show']);
            Route::put('{id}', [SubordinateController::class, 'update']);
        });

        // Especies Module ('species')
        Route::middleware('module.access:species')->prefix('species')->group(function () {
            Route::get('taxonomy', [SpeciesController::class, 'taxonomy']);
            Route::get('stats', [SpeciesController::class, 'stats']);
            Route::get('summary', [SpeciesController::class, 'stats']);
            Route::get('/', [SpeciesController::class, 'index']);
            Route::post('/', [SpeciesController::class, 'store']);
            Route::get('{id}', [SpeciesController::class, 'show']);
            Route::put('{id}', [SpeciesController::class, 'update']);
            Route::patch('{id}/status', [SpeciesController::class, 'toggleStatus']);
            Route::patch('{id}/toggle-status', [SpeciesController::class, 'toggleStatus']);
            Route::delete('{id}', [SpeciesController::class, 'destroy']);
        });
        Route::middleware('module.access:species')->get('admin/species/stats', [SpeciesController::class, 'stats']);
        Route::middleware('module.access:species')->get('admin/species/summary', [SpeciesController::class, 'stats']);
        Route::middleware('module.access:species')->get('admin/species', [SpeciesController::class, 'index']);

        // Galpones Module ('galpones')
        Route::middleware('module.access:galpones')->prefix('galpones')->group(function () {
            Route::get('stats', [GalponController::class, 'stats']);
            Route::get('summary', [GalponController::class, 'stats']);
            Route::get('/', [GalponController::class, 'index']);
            Route::post('/', [GalponController::class, 'store']);
            Route::get('{id}', [GalponController::class, 'show']);
            Route::put('{id}', [GalponController::class, 'update']);
            Route::patch('{id}', [GalponController::class, 'update']);
            Route::patch('{id}/status', [GalponController::class, 'toggleStatus']);
            Route::patch('{id}/toggle-status', [GalponController::class, 'toggleStatus']);
            Route::delete('{id}', [GalponController::class, 'destroy']);
        });
        Route::middleware('module.access:galpones')->get('admin/galpones/stats', [GalponController::class, 'stats']);
        Route::middleware('module.access:galpones')->get('admin/galpones/summary', [GalponController::class, 'stats']);
        Route::middleware('module.access:galpones')->get('admin/galpones', [GalponController::class, 'index']);

        // Galpones Module ('barns')
        Route::middleware('module.access:barns')->prefix('barns')->group(function () {
            Route::get('stats', [BarnController::class, 'stats']);
            Route::get('summary', [BarnController::class, 'stats']);
            Route::get('/', [BarnController::class, 'index']);
            Route::post('/', [BarnController::class, 'store']);
            Route::get('{id}', [BarnController::class, 'show']);
            Route::put('{id}', [BarnController::class, 'update']);
            Route::patch('{id}', [BarnController::class, 'update']);
            Route::patch('{id}/status', [BarnController::class, 'toggleStatus']);
            Route::patch('{id}/toggle-status', [BarnController::class, 'toggleStatus']);
            Route::delete('{id}', [BarnController::class, 'destroy']);
        });
        Route::middleware('module.access:barns')->get('admin/barns/stats', [BarnController::class, 'stats']);
        Route::middleware('module.access:barns')->get('admin/barns/summary', [BarnController::class, 'stats']);
        Route::middleware('module.access:barns')->get('admin/barns', [BarnController::class, 'index']);

        // Lotes Module ('lots' / alias 'lotes')
        Route::middleware('module.access:lots')->prefix('lots')->group(function () {
            Route::get('stats', [LotController::class, 'stats']);
            Route::get('summary', [LotController::class, 'stats']);
            Route::get('/', [LotController::class, 'index']);
            Route::post('/', [LotController::class, 'store']);
            Route::get('{id}', [LotController::class, 'show']);
            Route::put('{id}', [LotController::class, 'update']);
            Route::patch('{id}', [LotController::class, 'update']);
            Route::patch('{id}/status', [LotController::class, 'toggleStatus']);
            Route::post('{id}/harvest', [LotController::class, 'harvest']);
            Route::post('{id}/eggs', [LotController::class, 'registerEggs']);
            Route::delete('{id}', [LotController::class, 'destroy']);

            Route::get('{id}/weaned-pending', [LotController::class, 'weanedPending']);

            // Animales individuales (porcinos de reproducción)
            Route::get('{id}/animals', [LotController::class, 'animals']);
            Route::post('{id}/animals', [LotController::class, 'storeAnimal']);
            Route::get('animals/{animalId}', [LotController::class, 'showAnimal']);
            Route::put('animals/{animalId}', [LotController::class, 'updateAnimal']);
            Route::patch('animals/{animalId}', [LotController::class, 'updateAnimal']);
            Route::delete('animals/{animalId}', [LotController::class, 'destroyAnimal']);

            // Historial de servicios (inseminación / monta)
            Route::get('animals/{animalId}/services', [LotController::class, 'services']);
            Route::post('animals/{animalId}/services', [LotController::class, 'storeService']);
            Route::delete('services/{serviceId}', [LotController::class, 'destroyService']);
        });
        Route::middleware('module.access:lots')->get('admin/lots/stats', [LotController::class, 'stats']);
        Route::middleware('module.access:lots')->get('admin/lots/summary', [LotController::class, 'stats']);
        Route::middleware('module.access:lots')->get('admin/lots', [LotController::class, 'index']);

        // Alias 'lotes' para compatibilidad con el frontend
        Route::middleware('module.access:lotes')->prefix('lotes')->group(function () {
            Route::get('stats', [LotController::class, 'stats']);
            Route::get('summary', [LotController::class, 'stats']);
            Route::get('/', [LotController::class, 'index']);
            Route::post('/', [LotController::class, 'store']);
            Route::get('{id}', [LotController::class, 'show']);
            Route::put('{id}', [LotController::class, 'update']);
            Route::patch('{id}', [LotController::class, 'update']);
            Route::patch('{id}/status', [LotController::class, 'toggleStatus']);
            Route::post('{id}/harvest', [LotController::class, 'harvest']);
            Route::post('{id}/eggs', [LotController::class, 'registerEggs']);
            Route::delete('{id}', [LotController::class, 'destroy']);
            Route::get('{id}/animals', [LotController::class, 'animals']);
            Route::post('{id}/animals', [LotController::class, 'storeAnimal']);
            Route::get('animals/{animalId}', [LotController::class, 'showAnimal']);
            Route::put('animals/{animalId}', [LotController::class, 'updateAnimal']);
            Route::patch('animals/{animalId}', [LotController::class, 'updateAnimal']);
            Route::delete('animals/{animalId}', [LotController::class, 'destroyAnimal']);
            Route::get('animals/{animalId}/services', [LotController::class, 'services']);
            Route::post('animals/{animalId}/services', [LotController::class, 'storeService']);
            Route::delete('services/{serviceId}', [LotController::class, 'destroyService']);
        });

        // Actividades Module ('activities' / alias 'actividades')
        Route::middleware('module.access:activities')->prefix('activities')->group(function () {
            Route::get('stats', [ActivityController::class, 'stats']);
            Route::get('summary', [ActivityController::class, 'stats']);
            Route::get('my', [ActivityController::class, 'myActivities']);
            Route::get('/', [ActivityController::class, 'index']);
            Route::post('/', [ActivityController::class, 'store']);
            Route::get('{id}', [ActivityController::class, 'show']);
            Route::put('{id}', [ActivityController::class, 'update']);
            Route::patch('{id}', [ActivityController::class, 'update']);
            Route::patch('{id}/status', [ActivityController::class, 'updateStatus']);
            Route::delete('{id}', [ActivityController::class, 'destroy']);
        });
        Route::middleware('module.access:activities')->get('admin/activities/stats', [ActivityController::class, 'stats']);
        Route::middleware('module.access:activities')->get('admin/activities/summary', [ActivityController::class, 'stats']);
        Route::middleware('module.access:activities')->get('admin/activities', [ActivityController::class, 'index']);

        // Alias 'actividades' para compatibilidad con el frontend
        Route::middleware('module.access:actividades')->prefix('actividades')->group(function () {
            Route::get('stats', [ActivityController::class, 'stats']);
            Route::get('summary', [ActivityController::class, 'stats']);
            Route::get('my', [ActivityController::class, 'myActivities']);
            Route::get('/', [ActivityController::class, 'index']);
            Route::post('/', [ActivityController::class, 'store']);
            Route::get('{id}', [ActivityController::class, 'show']);
            Route::put('{id}', [ActivityController::class, 'update']);
            Route::patch('{id}', [ActivityController::class, 'update']);
            Route::patch('{id}/status', [ActivityController::class, 'updateStatus']);
            Route::delete('{id}', [ActivityController::class, 'destroy']);
        });

        // Inventario Module ('inventory' / alias 'inventario')
        Route::middleware('module.access:inventory')->prefix('inventory')->group(function () {
            Route::get('stats', [InventoryController::class, 'stats']);
            Route::get('alerts', [InventoryController::class, 'alerts']);
            Route::get('my', [InventoryController::class, 'my']);

            // Movimientos (antes de {id} para que no los capture la ruta dinámica)
            Route::get('movements', [InventoryMovementController::class, 'index']);
            Route::post('movements', [InventoryMovementController::class, 'store']);

            // Catálogos auxiliares: proveedores y bodegas
            Route::get('suppliers', [InventorySupplierController::class, 'index']);
            Route::post('suppliers', [InventorySupplierController::class, 'store']);
            Route::put('suppliers/{id}', [InventorySupplierController::class, 'update']);
            Route::patch('suppliers/{id}', [InventorySupplierController::class, 'update']);
            Route::delete('suppliers/{id}', [InventorySupplierController::class, 'destroy']);

            Route::get('warehouses', [InventoryWarehouseController::class, 'index']);
            Route::post('warehouses', [InventoryWarehouseController::class, 'store']);
            Route::put('warehouses/{id}', [InventoryWarehouseController::class, 'update']);
            Route::patch('warehouses/{id}', [InventoryWarehouseController::class, 'update']);
            Route::delete('warehouses/{id}', [InventoryWarehouseController::class, 'destroy']);

            // Lotes de insumos (catálogo propio de Inventario)
            Route::get('lots', [InventoryLotController::class, 'index']);
            Route::post('lots', [InventoryLotController::class, 'store']);
            Route::put('lots/{id}', [InventoryLotController::class, 'update']);
            Route::patch('lots/{id}', [InventoryLotController::class, 'update']);
            Route::delete('lots/{id}', [InventoryLotController::class, 'destroy']);

            Route::get('/', [InventoryController::class, 'index']);
            Route::post('/', [InventoryController::class, 'store']);
            Route::get('{id}', [InventoryController::class, 'show']);
            Route::put('{id}', [InventoryController::class, 'update']);
            Route::patch('{id}', [InventoryController::class, 'update']);
            Route::delete('{id}', [InventoryController::class, 'destroy']);
        });
        Route::middleware('module.access:inventory')->get('admin/inventory/stats', [InventoryController::class, 'stats']);
        Route::middleware('module.access:inventory')->get('admin/inventory/alerts', [InventoryController::class, 'alerts']);
        Route::middleware('module.access:inventory')->get('admin/inventory', [InventoryController::class, 'index']);

        // Alias 'inventario' para compatibilidad con el frontend
        Route::middleware('module.access:inventario')->prefix('inventario')->group(function () {
            Route::get('stats', [InventoryController::class, 'stats']);
            Route::get('alerts', [InventoryController::class, 'alerts']);
            Route::get('my', [InventoryController::class, 'my']);
            Route::get('movements', [InventoryMovementController::class, 'index']);
            Route::post('movements', [InventoryMovementController::class, 'store']);

            // Catálogos auxiliares: proveedores y bodegas
            Route::get('suppliers', [InventorySupplierController::class, 'index']);
            Route::post('suppliers', [InventorySupplierController::class, 'store']);
            Route::put('suppliers/{id}', [InventorySupplierController::class, 'update']);
            Route::patch('suppliers/{id}', [InventorySupplierController::class, 'update']);
            Route::delete('suppliers/{id}', [InventorySupplierController::class, 'destroy']);

            Route::get('warehouses', [InventoryWarehouseController::class, 'index']);
            Route::post('warehouses', [InventoryWarehouseController::class, 'store']);
            Route::put('warehouses/{id}', [InventoryWarehouseController::class, 'update']);
            Route::patch('warehouses/{id}', [InventoryWarehouseController::class, 'update']);
            Route::delete('warehouses/{id}', [InventoryWarehouseController::class, 'destroy']);

            // Lotes de insumos (catálogo propio de Inventario)
            Route::get('lots', [InventoryLotController::class, 'index']);
            Route::post('lots', [InventoryLotController::class, 'store']);
            Route::put('lots/{id}', [InventoryLotController::class, 'update']);
            Route::patch('lots/{id}', [InventoryLotController::class, 'update']);
            Route::delete('lots/{id}', [InventoryLotController::class, 'destroy']);

            Route::get('/', [InventoryController::class, 'index']);
            Route::post('/', [InventoryController::class, 'store']);
            Route::get('{id}', [InventoryController::class, 'show']);
            Route::put('{id}', [InventoryController::class, 'update']);
            Route::patch('{id}', [InventoryController::class, 'update']);
            Route::delete('{id}', [InventoryController::class, 'destroy']);
        });

        // Bandeja de notificaciones del usuario (solo JWT, sin module.access:
        // la campana del navbar debe funcionar aunque el módulo esté deshabilitado)
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::post('read-all', [NotificationController::class, 'markAllAsRead']);
            Route::post('{id}/read', [NotificationController::class, 'markAsRead']);
        });

        // Historial y Auditoría Module ('history')
        Route::middleware('module.access:history')->prefix('history')->group(function () {
            Route::get('stats', [HistoryController::class, 'stats']);
            Route::get('summary', [HistoryController::class, 'stats']);
            Route::get('/', [HistoryController::class, 'index']);
            Route::get('{id}', [HistoryController::class, 'show']);
        });
        Route::middleware('module.access:history')->get('admin/history/stats', [HistoryController::class, 'stats']);
        Route::middleware('module.access:history')->get('admin/history/summary', [HistoryController::class, 'stats']);
        Route::middleware('module.access:history')->get('admin/history', [HistoryController::class, 'index']);

        // Activity Logs alias ('activity-logs')
        Route::middleware('module.access:history')->prefix('activity-logs')->group(function () {
            Route::get('stats', [ActivityLogController::class, 'stats']);
            Route::get('summary', [ActivityLogController::class, 'stats']);
            Route::get('/', [ActivityLogController::class, 'index']);
            Route::get('{id}', [ActivityLogController::class, 'show']);
        });
        Route::middleware('module.access:history')->get('admin/activity-logs/stats', [ActivityLogController::class, 'stats']);
        Route::middleware('module.access:history')->get('admin/activity-logs/summary', [ActivityLogController::class, 'stats']);
        Route::middleware('module.access:history')->get('admin/activity-logs', [ActivityLogController::class, 'index']);

        // Analítica y Reportes Module ('analytics' / alias 'analitica')
        Route::middleware('module.access:analytics')->prefix('analytics')->group(function () {
            Route::get('summary', [AnalyticsController::class, 'summary']);
            Route::get('financial', [AnalyticsController::class, 'financial']);
            Route::get('operations', [AnalyticsController::class, 'operations']);
            Route::get('staff', [AnalyticsController::class, 'staff']);
        });
        Route::middleware('module.access:analytics')->get('admin/analytics/summary', [AnalyticsController::class, 'summary']);
        Route::middleware('module.access:analytics')->get('admin/analytics/financial', [AnalyticsController::class, 'financial']);
        Route::middleware('module.access:analytics')->get('admin/analytics/operations', [AnalyticsController::class, 'operations']);
        Route::middleware('module.access:analytics')->get('admin/analytics/staff', [AnalyticsController::class, 'staff']);

        // Alias 'analitica' para compatibilidad con el frontend
        Route::middleware('module.access:analytics')->prefix('analitica')->group(function () {
            Route::get('summary', [AnalyticsController::class, 'summary']);
            Route::get('financial', [AnalyticsController::class, 'financial']);
            Route::get('operations', [AnalyticsController::class, 'operations']);
            Route::get('staff', [AnalyticsController::class, 'staff']);
        });

    });
};

// Register routes both with /v1 prefix and without prefix
Route::prefix('v1')->group($registerRoutes);
Route::group([], $registerRoutes);
