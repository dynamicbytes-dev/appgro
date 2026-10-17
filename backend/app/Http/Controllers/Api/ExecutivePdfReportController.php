<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Farm;
use App\Models\Galpon;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\Lot;
use App\Models\Species;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ExecutivePdfReportController extends Controller
{
    /**
     * Obtener el consolidado de datos y KPIs ejecutivos para exportación de PDF.
     *
     * Módulos soportados:
     * - especies (species)
     * - galpones (barns)
     * - lotes (lots)
     * - inventario (inventory)
     * - actividades (activities)
     * - analitica (analytics)
     *
     * @param  Request  $request
     * @param  string  $module
     * @return JsonResponse
     */
    public function getModuleKpiReport(Request $request, string $module): JsonResponse
    {
        $user = Auth::guard('api')->user() ?? $request->user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->isRoot() && ! $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $canonicalModule = $this->normalizeModuleName($module);

        if (! $canonicalModule) {
            return response()->json([
                'status' => 'error',
                'message' => "Módulo no válido para reporte de KPIs ejecutivos: '{$module}'. Módulos soportados: especies, galpones, lotes, inventario, actividades, analitica.",
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Resolución de la granja activa
        $targetFarmId = null;
        $farmName = 'Consolidado Multigranja (Global)';

        if ($user->isRoot()) {
            if ($request->filled('farm_id') && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $targetFarmId = (int) $request->farm_id;
                $farm = Farm::find($targetFarmId);
                $farmName = $farm ? $farm->name : "Granja #{$targetFarmId}";
            }
        } else {
            $targetFarmId = (int) $user->farm_id;
            $farm = $user->farm ?? Farm::find($targetFarmId);
            $farmName = $farm ? $farm->name : "Granja #{$targetFarmId}";
        }

        // Construcción de la auditoría oficial
        $roleLabel = match ($user->role) {
            'root' => 'Superadministrador',
            'admin' => 'Administrador',
            'subordinate' => 'Encargado de Granja',
            default => ucfirst((string) $user->role),
        };

        $fullName = trim(($user->name ?? '').' '.($user->lastname ?? ''));
        if (empty($fullName)) {
            $fullName = $user->name ?? 'Usuario Zootika';
        }

        $audit = [
            'system' => 'Zootika - Sistema de Gestión Agropecuaria Integral',
            'farm_name' => $farmName,
            'farm_id' => $targetFarmId,
            'generated_by' => "{$fullName} ({$roleLabel})",
            'generated_at' => now()->format('d/m/Y H:i:s'),
        ];

        // Cálculo de KPIs y Diagnóstico según el módulo
        $extraData = [];
        $result = match ($canonicalModule) {
            'especies' => $this->buildSpeciesKpis($targetFarmId),
            'galpones' => $this->buildGalponesKpis($targetFarmId),
            'lotes' => $this->buildLotesKpis($targetFarmId),
            'inventario' => $this->buildInventarioKpis($targetFarmId),
            'actividades' => $this->buildActividadesKpis($targetFarmId, $user),
            'analitica' => $this->buildAnaliticaKpis($targetFarmId),
        };

        $kpis = $result[0];
        $diagnosis = $result[1];
        if (isset($result[2]) && is_array($result[2])) {
            $extraData = $result[2];
        }

        $responseData = array_merge([
            'module' => $canonicalModule,
            'audit' => $audit,
            'kpis' => $kpis,
            'diagnosis' => $diagnosis,
        ], $extraData);

        return response()->json(array_merge([
            'status' => 'success',
            'message' => 'Reporte ejecutivo de KPIs obtenido exitosamente.',
            'module' => $canonicalModule,
            'audit' => $audit,
            'kpis' => $kpis,
            'diagnosis' => $diagnosis,
            'data' => $responseData,
        ], $extraData), Response::HTTP_OK);
    }

    /**
     * Normaliza los alias aceptados a los 6 módulos canónicos.
     */
    protected function normalizeModuleName(string $module): ?string
    {
        return match (strtolower(trim($module))) {
            'especies', 'species' => 'especies',
            'galpones', 'barns' => 'galpones',
            'lotes', 'lots' => 'lotes',
            'inventario', 'inventory' => 'inventario',
            'actividades', 'activities' => 'actividades',
            'analitica', 'analytics' => 'analitica',
            default => null,
        };
    }

    /**
     * Aplica el filtro de granja opcional a una consulta Eloquent.
     */
    protected function applyFarmScope($query, ?int $farmId, string $column = 'farm_id')
    {
        if ($farmId !== null) {
            $query->where($column, $farmId);
        }

        return $query;
    }

    /**
     * MÓDULO: ESPECIES
     */
    protected function buildSpeciesKpis(?int $farmId): array
    {
        $baseQuery = Species::query();
        $this->applyFarmScope($baseQuery, $farmId);

        $total = (int) (clone $baseQuery)->count();
        $active = (int) (clone $baseQuery)->where('is_active', true)->count();
        $activePercent = $total > 0 ? round(($active / $total) * 100, 1) : 0.0;

        $porcinaCount = (int) (clone $baseQuery)
            ->where(function ($q) {
                $q->where('category', 'porcina')
                  ->orWhere('category', 'porcino');
            })->count();

        $avicolaCount = (int) (clone $baseQuery)
            ->where(function ($q) {
                $q->where('category', 'avícola')
                  ->orWhere('category', 'avicola')
                  ->orWhere('category', 'avícolo')
                  ->orWhere('category', 'avicolo');
            })->count();

        // Determinar propósito predominante basado en los galpones/lotes de la granja
        $galponPurposes = Galpon::query();
        $this->applyFarmScope($galponPurposes, $farmId);
        $topPurposeRow = $galponPurposes->whereNotNull('purpose')
            ->selectRaw('purpose, count(*) as qty')
            ->groupBy('purpose')
            ->orderByDesc('qty')
            ->first();

        $predominantPurpose = 'Carne';
        if ($topPurposeRow && ! empty($topPurposeRow->purpose)) {
            $purp = mb_strtolower(trim($topPurposeRow->purpose));
            if (str_contains($purp, 'huevo') || str_contains($purp, 'postura')) {
                $predominantPurpose = 'Postura (Huevos)';
            } elseif (str_contains($purp, 'repro')) {
                $predominantPurpose = 'Reproducción';
            } elseif (str_contains($purp, 'leche')) {
                $predominantPurpose = 'Leche';
            } else {
                $predominantPurpose = ucfirst($purp);
            }
        } elseif ($avicolaCount > 0 && $porcinaCount === 0) {
            $predominantPurpose = 'Postura / Carne';
        }

        $kpis = [
            [
                'label' => 'Total Especies',
                'value' => (string) $total,
                'subtitle' => 'Catálogo pecuario registrado',
                'status' => 'info',
            ],
            [
                'label' => 'Especies Activas',
                'value' => "{$active} ({$activePercent}%)",
                'subtitle' => 'En producción activa',
                'status' => 'success',
            ],
            [
                'label' => 'Distribución Porcino vs. Avícola',
                'value' => "{$porcinaCount} Porcino / {$avicolaCount} Avícola",
                'subtitle' => 'Sectores productivos principales',
                'status' => 'neutral',
            ],
            [
                'label' => 'Propósito Predominante',
                'value' => $predominantPurpose,
                'subtitle' => 'Orientación productiva de granja',
                'status' => 'success',
            ],
        ];

        $diagnosis = "El catálogo pecuario dispone de {$total} especies registradas, con {$active} en estado activo ({$activePercent}% de disponibilidad). La estructura operativa mantiene {$porcinaCount} variedades porcinas y {$avicolaCount} avícolas, con una orientación productiva principal enfocada en {$predominantPurpose}.";

        return [$kpis, $diagnosis];
    }

    /**
     * MÓDULO: GALPONES
     */
    protected function buildGalponesKpis(?int $farmId): array
    {
        $galponQuery = Galpon::query()->where('is_active', true);
        $this->applyFarmScope($galponQuery, $farmId);

        $galpones = $galponQuery->get(['id', 'farm_id', 'name', 'max_capacity']);
        $activeGalpones = $galpones->count();
        $capacity = (int) $galpones->sum('max_capacity');

        // Ocupación calculada estrictamente a partir de lotes activos asignados
        $lotQuery = Lot::query()->where('status', Lot::STATUS_ACTIVE);
        $this->applyFarmScope($lotQuery, $farmId);

        $activeLots = $lotQuery->get(['id', 'galpon_id', 'quantity']);
        Lot::loadCurrentOccupancy($activeLots);

        $occupied = 0;
        foreach ($activeLots as $lot) {
            if ($lot->galpon_id) {
                $occupied += (int) ($lot->current_occupancy ?? $lot->quantity);
            }
        }

        $occupancyPercent = $capacity > 0 ? round(($occupied / $capacity) * 100, 1) : 0.0;

        $occupancyStatus = 'success';
        $occupancySubtitle = 'Dentro de rangos óptimos de bioseguridad';
        if ($occupancyPercent > 90) {
            $occupancyStatus = 'danger';
            $occupancySubtitle = 'Alerta de sobrecarga (> 90%)';
        } elseif ($occupancyPercent > 75) {
            $occupancyStatus = 'warning';
            $occupancySubtitle = 'Ocupación alta de infraestructura';
        }

        $kpis = [
            [
                'label' => 'Galpones Activos',
                'value' => "{$activeGalpones} galpones",
                'subtitle' => 'Instalaciones operativas',
                'status' => 'info',
            ],
            [
                'label' => 'Capacidad Instalada',
                'value' => number_format($capacity).' plazas',
                'subtitle' => 'Cupo total autorizado',
                'status' => 'neutral',
            ],
            [
                'label' => 'Ocupación Actual',
                'value' => number_format($occupied).' animales',
                'subtitle' => 'Solo lotes activos alojados',
                'status' => 'info',
            ],
            [
                'label' => '% Ocupación Global',
                'value' => "{$occupancyPercent}%",
                'subtitle' => $occupancySubtitle,
                'status' => $occupancyStatus,
            ],
        ];

        if ($occupancyPercent > 90) {
            $diagnosis = "Alerta crítica de saturación: la infraestructura opera al {$occupancyPercent}% de su capacidad máxima autorizada ({$occupied} animales alojados sobre {$capacity} plazas en {$activeGalpones} galpones). Se requiere planificar salidas o cosechas para evitar hacinamiento y riesgos sanitarios.";
        } elseif ($occupancyPercent > 75) {
            $diagnosis = "Ocupación en nivel alto: la granja registra un {$occupancyPercent}% de utilización ({$occupied} de {$capacity} plazas instaladas). Se recomienda intensificar los protocolos de ventilación y control ambiental.";
        } else {
            $diagnosis = "Operación balanceada: la capacidad instalada registra un {$occupancyPercent}% de ocupación ({$occupied} plazas ocupadas sobre {$capacity} en {$activeGalpones} galpones activos), asegurando confort ambiental y bioseguridad.";
        }

        return [$kpis, $diagnosis];
    }

    /**
     * MÓDULO: LOTES
     */
    protected function buildLotesKpis(?int $farmId): array
    {
        $lotQuery = Lot::query()->with([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ]);
        $this->applyFarmScope($lotQuery, $farmId);

        $allLots = $lotQuery->orderByDesc('created_at')->get();
        Lot::loadProductionAndHarvest($allLots);

        $activeLotsCount = $allLots->where('status', Lot::STATUS_ACTIVE)->count();
        $closedLotsCount = $allLots->where('status', '!=', Lot::STATUS_ACTIVE)->count();

        // Población viva: lotes activos con ocupación dinámica
        $activeLots = $allLots->where('status', Lot::STATUS_ACTIVE);
        $livePopulation = (int) $activeLots->sum(fn ($l) => (int) ($l->current_occupancy ?? $l->quantity));

        // Producción de huevos
        $goodEggs = (int) $allLots->sum('total_eggs');
        $brokenEggs = (int) $allLots->sum('broken_eggs');
        $totalEggs = $goodEggs + $brokenEggs;
        $mermaPercent = $totalEggs > 0 ? round(($brokenEggs / $totalEggs) * 100, 1) : 0.0;

        // Costo Total de Cosecha: incluye ventas de animales y costo de postura calculado únicamente sobre huevos buenos
        $totalHarvestCost = round((float) $allLots->sum('harvest_cost'), 2);

        $eggStatus = $mermaPercent > 5 ? 'warning' : 'success';

        $kpis = [
            [
                'label' => 'Lotes Activos vs. Cerrados',
                'value' => "{$activeLotsCount} Activos / {$closedLotsCount} Cerrados",
                'subtitle' => 'Ciclos productivos registrados',
                'status' => 'info',
            ],
            [
                'label' => 'Población Viva Total',
                'value' => number_format($livePopulation).' animales',
                'subtitle' => 'Población en lotes activos',
                'status' => 'success',
            ],
            [
                'label' => 'Producción Total de Huevos',
                'value' => number_format($totalEggs).' uds',
                'subtitle' => number_format($goodEggs).' buenos | '.number_format($brokenEggs)." rotos ({$mermaPercent}% merma)",
                'status' => $eggStatus,
            ],
            [
                'label' => 'Costo Total de Cosecha',
                'value' => '$ '.number_format($totalHarvestCost, 2),
                'subtitle' => 'Incluye postura neta sobre huevos buenos',
                'status' => 'success',
            ],
        ];

        $mermaNote = $mermaPercent > 5
            ? "Se identifica una merma de huevos del {$mermaPercent}% ({$brokenEggs} unidades rotas), lo que amerita revisión de nidos y manipulación."
            : "La merma de huevos se mantiene en un nivel óptimo del {$mermaPercent}% ({$brokenEggs} unidades rotas).";

        $diagnosis = "El plantel productivo mantiene {$activeLotsCount} lotes activos con una población viva de ".number_format($livePopulation)." animales y {$closedLotsCount} ciclos cerrados. Acumula ".number_format($totalEggs)." huevos producidos (".number_format($goodEggs)." comerciales). {$mermaNote} La valorización acumulada de cosecha se sitúa en $ ".number_format($totalHarvestCost, 2).'.';

        // 1. Resumen consolidado de producción por propósito
        $eggLots = $allLots->filter(fn ($l) => $l->isEggPurpose());
        $reproLots = $allLots->filter(fn ($l) => $l->isReproductionPurpose() || Species::normalizeKey($l->purpose) === 'cria');
        $meatLots = $allLots->filter(fn ($l) => ! $l->isEggPurpose() && ! $l->isReproductionPurpose());

        $reproFarrowings = (int) $reproLots->sum(fn ($l) => $l->purpose_production['farrowings_count'] ?? 0);
        $reproBornAlive = (int) $reproLots->sum(fn ($l) => $l->purpose_production['born_alive'] ?? 0);
        $reproBornDead = (int) $reproLots->sum(fn ($l) => $l->purpose_production['born_dead'] ?? 0);
        $reproWeaned = (int) $reproLots->sum(fn ($l) => $l->purpose_production['weaned_count'] ?? 0);

        $meatWeightGain = (float) $meatLots->sum(fn ($l) => $l->purpose_production['total_weight_gain'] ?? 0);
        $meatTotalWeight = (float) $meatLots->sum(fn ($l) => $l->purpose_production['total_current_weight'] ?? 0);

        $purposeProductionSummary = [
            'postura' => [
                'total_eggs' => $totalEggs,
                'good_eggs' => $goodEggs,
                'broken_eggs' => $brokenEggs,
                'merma_percentage' => $mermaPercent,
                'production_cost' => round((float) $eggLots->sum('total_egg_cost'), 2),
            ],
            'reproduccion' => [
                'farrowings_count' => $reproFarrowings,
                'born_alive' => $reproBornAlive,
                'born_dead' => $reproBornDead,
                'weaned_count' => $reproWeaned,
            ],
            'engorde' => [
                'total_weight_gain' => round($meatWeightGain, 2),
                'total_current_weight' => round($meatTotalWeight, 2),
            ],
        ];

        // 2. Resumen consolidado de cosecha
        $totalHarvestedQuantity = (int) $allLots->sum(fn ($l) => $l->harvest_summary['harvested_quantity'] ?? 0);
        $totalHarvestedWeight = (float) $allLots->sum(fn ($l) => $l->harvest_summary['harvested_weight'] ?? 0);
        $totalDirectHarvestCost = (float) $allLots->sum(fn ($l) => $l->harvest_summary['harvest_cost'] ?? 0);
        $totalAccumulatedHarvestCost = (float) $allLots->sum(fn ($l) => $l->harvest_summary['total_harvest_cost'] ?? 0);

        $harvestSummary = [
            'harvested_quantity' => $totalHarvestedQuantity,
            'harvested_weight' => round($totalHarvestedWeight, 2),
            'avg_harvest_weight' => $totalHarvestedQuantity > 0 ? round($totalHarvestedWeight / $totalHarvestedQuantity, 2) : 0.0,
            'harvest_cost' => round($totalDirectHarvestCost, 2),
            'total_harvest_cost' => round($totalAccumulatedHarvestCost, 2),
            'closed_lots_count' => $closedLotsCount,
            'active_lots_count' => $activeLotsCount,
        ];

        // 3. Mapeo detallado de cada lote para la tabla del reporte PDF
        $lotsPayload = $allLots->map(function ($l) {
            return [
                'id' => $l->id,
                'code' => $l->code,
                'species' => $l->species?->name ?? 'N/A',
                'galpon' => $l->galpon?->name ?? 'N/A',
                'purpose' => $l->purpose,
                'status' => $l->status,
                'quantity' => (int) $l->quantity,
                'current_occupancy' => (int) ($l->current_occupancy ?? $l->quantity),
                'purpose_production' => $l->purpose_production,
                'harvest_summary' => $l->harvest_summary,
            ];
        })->values()->all();

        return [$kpis, $diagnosis, [
            'lots' => $lotsPayload,
            'purpose_production' => $purposeProductionSummary,
            'harvest_summary' => $harvestSummary,
        ]];
    }

    /**
     * MÓDULO: INVENTARIO
     */
    protected function buildInventarioKpis(?int $farmId): array
    {
        $itemQuery = InventoryItem::query();
        $this->applyFarmScope($itemQuery, $farmId);

        $totalItems = (int) (clone $itemQuery)->count();
        $totalStockValue = round((float) (clone $itemQuery)->sum('total_cost'), 2);

        // Insumos en stock crítico (current_stock <= min_stock y min_stock > 0)
        $criticalItems = (clone $itemQuery)
            ->where('min_stock', '>', 0)
            ->whereColumn('current_stock', '<=', 'min_stock')
            ->count();

        // Lotes de insumos registrados en almacén
        $lotQuery = InventoryLot::query();
        $this->applyFarmScope($lotQuery, $farmId);
        $totalLots = (int) $lotQuery->count();

        $criticalStatus = $criticalItems > 0 ? 'danger' : 'success';
        $criticalSubtitle = $criticalItems > 0
            ? 'Bajo el umbral mínimo de seguridad'
            : 'Todos los insumos sobre el mínimo';

        $kpis = [
            [
                'label' => 'Insumos Catalogados',
                'value' => "{$totalItems} insumos",
                'subtitle' => 'Catálogo activo de almacén',
                'status' => 'info',
            ],
            [
                'label' => 'Valoración Total del Stock',
                'value' => '$ '.number_format($totalStockValue, 2),
                'subtitle' => 'Capital en existencias físicas',
                'status' => 'success',
            ],
            [
                'label' => 'Insumos en Stock Crítico',
                'value' => "{$criticalItems} insumos",
                'subtitle' => $criticalSubtitle,
                'status' => $criticalStatus,
            ],
            [
                'label' => 'Lotes de Insumos Registrados',
                'value' => "{$totalLots} lotes",
                'subtitle' => 'Partidas de insumos en entradas',
                'status' => 'info',
            ],
        ];

        if ($criticalItems > 0) {
            $diagnosis = "Alerta de inventario: se detectan {$criticalItems} insumos con existencias iguales o inferiores al stock mínimo de seguridad. Se recomienda emitir órdenes de compra de reposición. El almacén cuenta con {$totalItems} artículos catalogados, {$totalLots} lotes de partida y un valor total de $ ".number_format($totalStockValue, 2).'.';
        } else {
            $diagnosis = "Cadena de suministros estable: los {$totalItems} insumos catalogados se encuentran por encima de sus límites de seguridad mínimos, con trazabilidad garantizada en {$totalLots} lotes de entrada y una valoración de existencias de $ ".number_format($totalStockValue, 2).'.';
        }

        $items = (clone $itemQuery)->with(['farm:id,name', 'supplier:id,name', 'warehouse:id,name'])
            ->orderBy('name')
            ->limit(500)
            ->get();

        return [$kpis, $diagnosis, [
            'items' => $items,
            'inventory' => [
                'total_items' => $totalItems,
                'total_lots' => $totalLots,
                'total_stock_value' => $totalStockValue,
                'critical_items' => $criticalItems,
            ],
        ]];
    }

    /**
     * MÓDULO: ACTIVIDADES
     */
    protected function buildActividadesKpis(?int $farmId, $user): array
    {
        $activityQuery = Activity::query();
        $this->applyFarmScope($activityQuery, $farmId);

        // Si el usuario es subordinado (encargado), acota a sus tareas asignadas
        if (! $user->isRoot() && ! $user->isAdmin()) {
            $activityQuery->where('assigned_to', (int) $user->id);
        }

        $totalActivities = (int) (clone $activityQuery)->count();
        $inProgress = (int) (clone $activityQuery)->where('status', Activity::STATUS_IN_PROGRESS)->count();
        $completed = (int) (clone $activityQuery)->where('status', Activity::STATUS_COMPLETED)->count();
        $pending = (int) (clone $activityQuery)->where('status', Activity::STATUS_PENDING)->count();

        $efficiencyPercent = $totalActivities > 0 ? round(($completed / $totalActivities) * 100, 1) : 0.0;
        $efficiencyStatus = $efficiencyPercent >= 80 ? 'success' : ($efficiencyPercent >= 50 ? 'warning' : 'danger');

        $kpis = [
            [
                'label' => 'Total Actividades',
                'value' => "{$totalActivities} tareas",
                'subtitle' => 'Asignaciones programadas',
                'status' => 'info',
            ],
            [
                'label' => 'Actividades En Proceso',
                'value' => "{$inProgress} en curso",
                'subtitle' => 'Labores en ejecución activa',
                'status' => 'warning',
            ],
            [
                'label' => 'Actividades Terminadas',
                'value' => "{$completed} concluidas",
                'subtitle' => 'Verificadas y finalizadas',
                'status' => 'success',
            ],
            [
                'label' => '% Eficiencia de Cumplimiento',
                'value' => "{$efficiencyPercent}%",
                'subtitle' => $efficiencyPercent >= 80 ? 'Rendimiento operativo alto' : "{$pending} tareas aún pendientes",
                'status' => $efficiencyStatus,
            ],
        ];

        if ($efficiencyPercent < 80) {
            $diagnosis = "Atención operativa: la tasa de cumplimiento del personal se sitúa en un {$efficiencyPercent}% ({$completed} concluidas de {$totalActivities} programadas, con {$inProgress} en proceso y {$pending} pendientes). Se sugiere priorizar las actividades con fechas de vencimiento próximas.";
        } else {
            $diagnosis = "Rendimiento óptimo: el personal de granja mantiene un {$efficiencyPercent}% de cumplimiento ({$completed} actividades finalizadas de {$totalActivities} programadas, con {$inProgress} en curso), cumpliendo oportunamente con los protocolos sanitarios y operativos.";
        }

        return [$kpis, $diagnosis];
    }

    /**
     * MÓDULO: ANALÍTICA
     */
    protected function buildAnaliticaKpis(?int $farmId): array
    {
        // 1. Costo Total de Cosecha Global
        $lots = Lot::query();
        $this->applyFarmScope($lots, $farmId);
        $lotCollection = $lots->get();
        Lot::loadHarvestCost($lotCollection);
        $totalHarvestCost = round((float) $lotCollection->sum('harvest_cost'), 2);

        // 2. % Ocupación de Infraestructura
        $galponQuery = Galpon::query()->where('is_active', true);
        $this->applyFarmScope($galponQuery, $farmId);
        $galpones = $galponQuery->get(['id', 'max_capacity']);
        $capacity = (int) $galpones->sum('max_capacity');

        $activeLots = $lotCollection->where('status', Lot::STATUS_ACTIVE);
        Lot::loadCurrentOccupancy($activeLots);
        $occupied = 0;
        foreach ($activeLots as $lot) {
            if ($lot->galpon_id) {
                $occupied += (int) ($lot->current_occupancy ?? $lot->quantity);
            }
        }
        $occupancyPercent = $capacity > 0 ? round(($occupied / $capacity) * 100, 1) : 0.0;
        $occupancyStatus = $occupancyPercent > 90 ? 'danger' : ($occupancyPercent > 75 ? 'warning' : 'success');

        // 3. % Eficiencia de Postura (Huevos Buenos)
        $goodEggs = (int) $lotCollection->sum('total_eggs');
        $brokenEggs = (int) $lotCollection->sum('broken_eggs');
        $totalEggs = $goodEggs + $brokenEggs;
        $goodPercent = $totalEggs > 0 ? round(($goodEggs / $totalEggs) * 100, 1) : 100.0;
        $postureStatus = $goodPercent >= 95 ? 'success' : 'warning';

        // 4. % Productividad del Personal
        $actQuery = Activity::query();
        $this->applyFarmScope($actQuery, $farmId);
        $totalActs = (int) (clone $actQuery)->count();
        $completedActs = (int) (clone $actQuery)->where('status', Activity::STATUS_COMPLETED)->count();
        $productivityPercent = $totalActs > 0 ? round(($completedActs / $totalActs) * 100, 1) : 100.0;
        $prodStatus = $productivityPercent >= 85 ? 'success' : 'warning';

        $kpis = [
            [
                'label' => 'Costo Total Cosecha Global',
                'value' => '$ '.number_format($totalHarvestCost, 2),
                'subtitle' => 'Ventas pecuarias y postura neta',
                'status' => 'success',
            ],
            [
                'label' => '% Ocupación Infraestructura',
                'value' => "{$occupancyPercent}%",
                'subtitle' => number_format($capacity).' plazas autorizadas',
                'status' => $occupancyStatus,
            ],
            [
                'label' => '% Eficiencia de Postura',
                'value' => "{$goodPercent}%",
                'subtitle' => number_format($goodEggs).' huevos comerciales aptos',
                'status' => $postureStatus,
            ],
            [
                'label' => '% Productividad del Personal',
                'value' => "{$productivityPercent}%",
                'subtitle' => "{$completedActs} de {$totalActs} tareas completadas",
                'status' => $prodStatus,
            ],
        ];

        $diagnosis = "Diagnóstico gerencial Zootika: la infraestructura opera al {$occupancyPercent}% de ocupación, con una valorización de cosecha acumulada de $ ".number_format($totalHarvestCost, 2).". La eficiencia de postura se mantiene en {$goodPercent}% y la productividad del personal en {$productivityPercent}%, evidenciando un control zootécnico y financiero consistente.";

        return [$kpis, $diagnosis];
    }
}
