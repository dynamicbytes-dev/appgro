<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\EggProduction;
use App\Models\Galpon;
use App\Models\InventoryItem;
use App\Models\InventoryLot;
use App\Models\InventoryMovement;
use App\Models\Lot;
use App\Models\LoteAnimal;
use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Módulo de Analítica y Reportes.
 *
 * Consolida, en un solo lugar, los indicadores gerenciales y operativos
 * que hoy están repartidos entre los módulos de Lotes, Galpones,
 * Inventario y Actividades:
 *
 *  - `summary`    → KPIs del Resumen Ejecutivo.
 *  - `financial`  → costos, mermas, rentabilidad y serie temporal.
 *  - `operations` → ocupación de galpones, lotes e inventario crítico.
 *  - `staff`      → productividad y tiempos del personal.
 *
 * Multigranja: el root consulta todas las granjas o filtra por
 * `farm_id`; los demás roles quedan fijos a su granja (el scope global
 * `BelongsToFarm` refuerza el aislamiento). Un encargado (subordinate)
 * solo ve sus propias métricas en `staff`.
 */
class AnalyticsController extends Controller
{
    /** Etiquetas legibles de los sectores normalizados. */
    public const SECTOR_LABELS = [
        'porcino' => 'Porcino',
        'avicola' => 'Avícola',
        'bovino' => 'Bovino',
        'mixto' => 'Mixto',
        'otros' => 'Otros',
    ];

    /** Etiquetas legibles de los propósitos normalizados. */
    public const PURPOSE_LABELS = [
        'carne' => 'Carne',
        'postura' => 'Postura (huevos)',
        'reproduccion' => 'Reproducción',
        'sin_definir' => 'Sin definir',
        'otros' => 'Otros',
    ];

    /** Estados de animales que ya salieron de producción (para venta). */
    private const ANIMALS_OUT_OF_PRODUCTION = ['cosechado', 'vendido', 'descartado', 'muerto'];

    /* ================================================================= */
    /* Endpoints                                                          */
    /* ================================================================= */

    /**
     * Resumen ejecutivo: KPIs principales.
     */
    public function summary(Request $request)
    {
        $user = $this->currentUser();

        if ($denied = $this->guardContext($user, $request)) {
            return $denied;
        }

        $lots = $this->scopedLots($request, $user)->get();

        $investment = round((float) $lots->sum(fn (Lot $l) => (float) ($l->investment_cost ?? 0)), 2);
        $eggCost = round((float) $lots->sum(fn (Lot $l) => (float) ($l->total_egg_cost ?? 0)), 2);
        $brokenCost = round((float) $lots->sum(fn (Lot $l) => (float) ($l->total_broken_cost ?? 0)), 2);

        $inputs = $this->inventoryConsumption($request, $user);

        $eggs = $this->eggTotals($lots);
        $revenue = $this->harvestRevenue($lots);

        $totalCost = round($investment + $inputs['total'] + $eggCost + $brokenCost, 2);
        $profit = round($revenue - $totalCost, 2);

        $capacity = $this->capacitySnapshot($request, $user);

        $activities = $this->activitiesSnapshot($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Resumen ejecutivo obtenido con éxito.',
            'data' => [
                'total_cost' => $totalCost,
                'total_revenue' => $revenue,
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
                'occupancy_percent' => $capacity['percent'],
                'capacity' => $capacity['capacity'],
                'occupied' => $capacity['occupied'],
                'eggs_total' => $eggs['total'],
                'eggs_good' => $eggs['good'],
                'eggs_broken' => $eggs['broken'],
                'broken_percent' => $eggs['broken_percent'],
                'activities_percent' => $activities['percent'],
                'activities_total' => $activities['total'],
                'activities_completed' => $activities['completed'],
                'items_at_risk' => $this->itemsAtRiskCount($request, $user),
                'lots_total' => $lots->count(),
                'farm_id' => $this->hasSpecificFarm($request) ? (int) $request->farm_id : null,
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Analítica financiera y de producción.
     */
    public function financial(Request $request)
    {
        $user = $this->currentUser();

        if ($denied = $this->guardContext($user, $request)) {
            return $denied;
        }

        $lots = $this->scopedLots($request, $user)->get();
        $sales = $this->animalSales($lots->pluck('id')->all());

        $investment = 0.0;
        $eggCost = 0.0;
        $brokenCost = 0.0;
        $revenue = 0.0;
        $bySector = [];
        $byLot = [];

        foreach ($lots as $lot) {
            $lotInvestment = (float) ($lot->investment_cost ?? 0);
            $lotEggCost = (float) ($lot->total_egg_cost ?? 0);
            $lotBrokenCost = (float) ($lot->total_broken_cost ?? 0);
            $lotRevenue = $this->lotRevenue($lot, $sales);

            $investment += $lotInvestment;
            $eggCost += $lotEggCost;
            $brokenCost += $lotBrokenCost;
            $revenue += $lotRevenue;

            $sectorKey = $this->sectorKey($lot->sector);
            $bySector[$sectorKey] = $bySector[$sectorKey] ?? [
                'sector' => $sectorKey,
                'sector_label' => $this->sectorLabel($sectorKey),
                'lots' => 0,
                'cost' => 0.0,
                'revenue' => 0.0,
            ];
            $bySector[$sectorKey]['lots']++;
            $bySector[$sectorKey]['cost'] += $lotInvestment + $lotEggCost + $lotBrokenCost;
            $bySector[$sectorKey]['revenue'] += $lotRevenue;

            $lotCost = $lotInvestment + $lotEggCost + $lotBrokenCost;

            if ($lotCost > 0 || $lotRevenue > 0) {
                $byLot[] = [
                    'id' => $lot->id,
                    'code' => $lot->code,
                    'purpose' => $this->purposeKey($lot->purpose),
                    'purpose_label' => $this->purposeLabel($lot->purpose),
                    'sector_label' => $this->sectorLabel($this->sectorKey($lot->sector)),
                    'cost' => round($lotCost, 2),
                    'revenue' => round($lotRevenue, 2),
                    'profit' => round($lotRevenue - $lotCost, 2),
                ];
            }
        }

        $inputs = $this->inventoryConsumption($request, $user);

        $totalCost = round($investment + $inputs['total'] + $eggCost + $brokenCost, 2);
        $profit = round($revenue - $totalCost, 2);

        // Misma fuente que el Resumen Ejecutivo, para que la merma de huevos
        // reportada en ambas pestañas sea idéntica.
        $eggs = $this->eggTotals($lots);

        // Ordena y limita el detalle por lote (mayor costo primero).
        usort($byLot, fn ($a, $b) => $b['cost'] <=> $a['cost']);
        $byLot = array_slice($byLot, 0, 50);

        $sectors = array_values(array_map(function (array $row) {
            $row['cost'] = round($row['cost'], 2);
            $row['revenue'] = round($row['revenue'], 2);
            $row['profit'] = round($row['revenue'] - $row['cost'], 2);

            return $row;
        }, $bySector));

        return response()->json([
            'status' => 'success',
            'message' => 'Analítica financiera obtenida con éxito.',
            'data' => [
                'costs' => [
                    'investment' => round($investment, 2),
                    'inputs' => round($inputs['total'], 2),
                    'eggs' => round($eggCost, 2),
                    'eggs_broken' => round($brokenCost, 2),
                    'total' => $totalCost,
                ],
                'revenue' => [
                    'harvest' => round($revenue, 2),
                    'total' => round($revenue, 2),
                ],
                'profit' => $profit,
                'margin_percent' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : null,
                'by_sector' => $sectors,
                'by_lot' => array_values($byLot),
                'inputs_top' => $inputs['items'],
                'eggs' => [
                    'good' => $eggs['good'],
                    'broken' => $eggs['broken'],
                    'total' => $eggs['total'],
                    'broken_percent' => $eggs['broken_percent'],
                ],
                'eggs_series' => $this->eggsSeries($request, $user),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Analítica operativa: ocupación e infraestructura.
     */
    public function operations(Request $request)
    {
        $user = $this->currentUser();

        if ($denied = $this->guardContext($user, $request)) {
            return $denied;
        }

        $capacity = $this->capacitySnapshot($request, $user);

        $lots = $this->scopedLots($request, $user)->get();

        $byStatus = [];
        $byPurpose = [];
        $bySector = [];

        foreach ($lots as $lot) {
            $status = (string) ($lot->status ?: 'sin_estado');
            $byStatus[$status] = ($byStatus[$status] ?? 0) + 1;

            $purposeKey = $this->purposeKey($lot->purpose);
            $byPurpose[$purposeKey] = $byPurpose[$purposeKey] ?? [
                'purpose' => $purposeKey,
                'label' => $this->purposeLabel($purposeKey),
                'count' => 0,
                'quantity' => 0,
            ];
            $byPurpose[$purposeKey]['count']++;
            $byPurpose[$purposeKey]['quantity'] += (int) $lot->quantity;

            $sectorKey = $this->sectorKey($lot->sector);
            $bySector[$sectorKey] = $bySector[$sectorKey] ?? [
                'sector' => $sectorKey,
                'label' => $this->sectorLabel($sectorKey),
                'count' => 0,
                'quantity' => 0,
            ];
            $bySector[$sectorKey]['count']++;
            $bySector[$sectorKey]['quantity'] += (int) $lot->quantity;
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Analítica operativa obtenida con éxito.',
            'data' => [
                'capacity' => $capacity,
                'lots' => [
                    'total' => $lots->count(),
                    'by_status' => array_values(array_map(
                        fn ($status, $count) => ['status' => $status, 'count' => $count],
                        array_keys($byStatus),
                        array_values($byStatus)
                    )),
                    'by_purpose' => array_values($byPurpose),
                    'by_sector' => array_values($bySector),
                ],
                'inventory' => $this->inventorySnapshot($request, $user),
                'items_at_risk' => $this->itemsAtRiskCount($request, $user),
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Analítica de productividad del personal.
     */
    public function staff(Request $request)
    {
        $user = $this->currentUser();

        if ($denied = $this->guardContext($user, $request)) {
            return $denied;
        }

        $activities = $this->activitiesQuery($request, $user)
            ->get(['id', 'assigned_to', 'status', 'due_date', 'completed_at', 'created_at']);

        $byUser = [];

        foreach ($activities as $activity) {
            $key = (int) ($activity->assigned_to ?? 0);

            $byUser[$key] = $byUser[$key] ?? [
                'user_id' => $key,
                'name' => null,
                'total' => 0,
                'completed' => 0,
                'in_progress' => 0,
                'pending' => 0,
                'overdue' => 0,
                '_response_hours' => [],
                '_days_vs_due' => [],
            ];

            $byUser[$key]['total']++;

            if ($activity->status === Activity::STATUS_COMPLETED) {
                $byUser[$key]['completed']++;

                if ($activity->completed_at && $activity->created_at) {
                    $byUser[$key]['_response_hours'][] = $activity->created_at->diffInMinutes($activity->completed_at) / 60;
                }

                if ($activity->completed_at && $activity->due_date) {
                    $byUser[$key]['_days_vs_due'][] = $activity->due_date->startOfDay()->diffInDays($activity->completed_at->startOfDay(), false);
                }
            } elseif ($activity->status === Activity::STATUS_IN_PROGRESS) {
                $byUser[$key]['in_progress']++;
            } else {
                $byUser[$key]['pending']++;
            }

            $isOverdue = $activity->status !== Activity::STATUS_COMPLETED
                && $activity->due_date
                && $activity->due_date->lt(now()->startOfDay());

            if ($isOverdue) {
                $byUser[$key]['overdue']++;
            }
        }

        // Nombres de los usuarios implicados.
        $names = $this->userNames(array_keys($byUser));

        $team = [];
        $allResponse = [];
        $allDaysVsDue = [];
        $summary = [
            'total' => 0,
            'completed' => 0,
            'in_progress' => 0,
            'pending' => 0,
            'overdue' => 0,
        ];

        foreach ($byUser as $key => $row) {
            $responseHours = $row['_response_hours'];
            $daysVsDue = $row['_days_vs_due'];

            $team[] = [
                'user_id' => $key,
                'name' => $names[$key] ?? 'Usuario #'.$key,
                'total' => $row['total'],
                'completed' => $row['completed'],
                'in_progress' => $row['in_progress'],
                'pending' => $row['pending'],
                'overdue' => $row['overdue'],
                'completion_percent' => $row['total'] > 0 ? round(($row['completed'] / $row['total']) * 100, 1) : 0.0,
                'avg_response_hours' => count($responseHours) > 0 ? round(array_sum($responseHours) / count($responseHours), 2) : null,
                'avg_days_vs_due' => count($daysVsDue) > 0 ? round(array_sum($daysVsDue) / count($daysVsDue), 2) : null,
            ];

            foreach (['total', 'completed', 'in_progress', 'pending', 'overdue'] as $field) {
                $summary[$field] += $row[$field];
            }

            $allResponse = array_merge($allResponse, $responseHours);
            $allDaysVsDue = array_merge($allDaysVsDue, $daysVsDue);
        }

        usort($team, fn ($a, $b) => $b['completion_percent'] <=> $a['completion_percent']);

        $summary['completion_percent'] = $summary['total'] > 0
            ? round(($summary['completed'] / $summary['total']) * 100, 1)
            : 0.0;
        $summary['avg_response_hours'] = count($allResponse) > 0
            ? round(array_sum($allResponse) / count($allResponse), 2)
            : null;
        $summary['avg_days_vs_due'] = count($allDaysVsDue) > 0
            ? round(array_sum($allDaysVsDue) / count($allDaysVsDue), 2)
            : null;

        return response()->json([
            'status' => 'success',
            'message' => 'Analítica de personal obtenida con éxito.',
            'data' => [
                'scope' => $this->staffScopeLabel($user, $request),
                'team' => $team,
                'summary' => $summary,
            ],
        ], Response::HTTP_OK);
    }

    /* ================================================================= */
    /* Cálculos auxiliares                                                */
    /* ================================================================= */

    /**
     * Consulta base de lotes con el alcance de granja aplicado.
     */
    private function scopedLots(Request $request, $user)
    {
        $query = Lot::query();
        $this->applyFarmScope($query, $request, $user);

        return $query;
    }

    /**
     * Costo de insumos consumidos (salidas + ajustes negativos) a nivel
     * de granja. No es atribuible a un lote: `inventory_movements` no se
     * relaciona con lotes de animales.
     *
     * @return array{total: float, items: array<int, array<string, mixed>>}
     */
    private function inventoryConsumption(Request $request, $user): array
    {
        $query = DB::table('inventory_movements')
            ->join('inventory_items', 'inventory_items.id', '=', 'inventory_movements.inventory_item_id')
            ->where(function ($q) {
                $q->where('inventory_movements.type', 'salida')
                    ->orWhere(function ($q2) {
                        $q2->where('inventory_movements.type', 'ajuste')
                            ->where('inventory_movements.quantity', '<', 0);
                    });
            });

        if ($user->isRoot()) {
            if ($this->hasSpecificFarm($request)) {
                $query->where('inventory_movements.farm_id', (int) $request->farm_id);
            }
        } elseif ($user->farm_id) {
            $query->where('inventory_movements.farm_id', (int) $user->farm_id);
        }

        $rows = $query
            ->groupBy('inventory_items.id', 'inventory_items.code', 'inventory_items.name', 'inventory_items.unit_cost')
            ->selectRaw('
                inventory_items.id as item_id,
                inventory_items.code as code,
                inventory_items.name as name,
                inventory_items.unit_cost as unit_cost,
                SUM(ABS(inventory_movements.quantity)) as consumed
            ')
            ->get();

        $total = 0.0;
        $items = [];

        foreach ($rows as $row) {
            $consumed = (float) $row->consumed;
            $cost = round($consumed * (float) $row->unit_cost, 2);

            if ($cost <= 0) {
                continue;
            }

            $total += $cost;
            $items[] = [
                'item_id' => (int) $row->item_id,
                'code' => $row->code,
                'name' => $row->name,
                'consumed' => round($consumed, 2),
                'unit_cost' => (float) $row->unit_cost,
                'cost' => $cost,
            ];
        }

        usort($items, fn ($a, $b) => $b['cost'] <=> $a['cost']);

        return [
            'total' => round($total, 2),
            'items' => array_slice($items, 0, 10),
        ];
    }

    /**
     * Ventas individuales de animales por lote (para el valor de cosecha).
     *
     * @param  array<int, int>  $lotIds
     * @return array<int, float>
     */
    private function animalSales(array $lotIds): array
    {
        if (empty($lotIds)) {
            return [];
        }

        return LoteAnimal::whereIn('lote_id', $lotIds)
            ->whereIn('status', self::ANIMALS_OUT_OF_PRODUCTION)
            ->whereNotNull('sale_total_price')
            ->groupBy('lote_id')
            ->pluck(DB::raw('SUM(sale_total_price) as total'), 'lote_id')
            ->map(fn ($value) => (float) $value)
            ->all();
    }

    /**
     * Valor de cosecha de un lote. Prioriza la suma de ventas
     * individuales para evitar el doble conteo con `total_price`
     * (misma regla que `Lot::loadHarvestCost`).
     */
    private function lotRevenue(Lot $lot, array $sales): float
    {
        $individual = (float) ($sales[$lot->id] ?? 0);

        return $individual > 0 ? $individual : (float) ($lot->total_price ?? 0);
    }

    /**
     * Valor de cosecha total de una colección de lotes.
     */
    private function harvestRevenue($lots): float
    {
        $sales = $this->animalSales($lots->pluck('id')->all());

        return round((float) $lots->sum(fn (Lot $lot) => $this->lotRevenue($lot, $sales)), 2);
    }

    /**
     * Consolidado de huevos (buenos y rotos) a partir de los acumuladores de
     * los lotes.
     *
     * Fuente única para el Resumen Ejecutivo y la pestaña Financiera, de modo
     * que ambas reporten exactamente las mismas cifras.
     *
     * @param  \Illuminate\Support\Collection<int, Lot>  $lots
     * @return array{good: int, broken: int, total: int, broken_percent: float}
     */
    private function eggTotals($lots): array
    {
        $good = (int) $lots->sum('total_eggs');
        $broken = (int) $lots->sum('broken_eggs');
        $total = $good + $broken;

        return [
            'good' => $good,
            'broken' => $broken,
            'total' => $total,
            'broken_percent' => $total > 0 ? round(($broken / $total) * 100, 1) : 0.0,
        ];
    }

    /**
     * Serie temporal de producción de huevos (buenos vs. rotos).
     *
     * @return array<int, array<string, mixed>>
     */
    private function eggsSeries(Request $request, $user): array
    {
        // Selecciona las 180 fechas de producción MÁS RECIENTES (no las más
        // antiguas) para no perder el histórico cercano cuando la tabla crece.
        $recentDates = EggProduction::query()
            ->select('production_date')
            ->groupBy('production_date')
            ->orderByDesc('production_date')
            ->limit(180);

        $this->applyFarmScope($recentDates, $request, $user);

        $query = EggProduction::query()
            ->whereIn('production_date', $recentDates)
            ->groupBy('production_date')
            ->orderBy('production_date')
            ->selectRaw('
                production_date,
                SUM(good_eggs) as good_eggs,
                SUM(broken_eggs) as broken_eggs,
                SUM(good_cost) as good_cost,
                SUM(broken_cost) as broken_cost
            ')
            ->limit(180);

        $this->applyFarmScope($query, $request, $user);

        return $query->get()->map(fn ($row) => [
            'date' => $row->production_date instanceof \DateTimeInterface
                ? $row->production_date->format('Y-m-d')
                : (string) $row->production_date,
            'good_eggs' => (int) $row->good_eggs,
            'broken_eggs' => (int) $row->broken_eggs,
            'good_cost' => round((float) $row->good_cost, 2),
            'broken_cost' => round((float) $row->broken_cost, 2),
        ])->values()->all();
    }

    /**
     * Ocupación de galpones: capacidad instalada vs. animales en
     * producción.
     *
     * @return array<string, mixed>
     */
    private function capacitySnapshot(Request $request, $user): array
    {
        $galponQuery = Galpon::query()->where('is_active', true);
        $this->applyFarmScope($galponQuery, $request, $user);

        $galpones = $galponQuery->get(['id', 'farm_id', 'name', 'sector', 'purpose', 'max_capacity']);

        $capacity = (int) $galpones->sum('max_capacity');

        // Ocupación por galpón (solo lotes activos asignados a un galpón).
        $lotQuery = Lot::query()->where('status', Lot::STATUS_ACTIVE);
        $this->applyFarmScope($lotQuery, $request, $user);

        $activeLots = $lotQuery->get(['id', 'galpon_id', 'quantity']);
        Lot::loadCurrentOccupancy($activeLots);

        // Los lotes activos sin `galpon_id` no ocupan cupo de ningún galpón
        // activo, por lo que quedan fuera del consolidado para que éste y el
        // detalle por galpón (`sheds`) siempre coincidan.
        $occupiedByGalpon = [];

        foreach ($activeLots as $lot) {
            if (! $lot->galpon_id) {
                continue;
            }

            $occ = (int) ($lot->current_occupancy ?? $lot->quantity);
            $occupiedByGalpon[(int) $lot->galpon_id] =
                ($occupiedByGalpon[(int) $lot->galpon_id] ?? 0) + $occ;
        }

        $sheds = $galpones->map(function (Galpon $galpon) use ($occupiedByGalpon) {
            $occ = (int) ($occupiedByGalpon[(int) $galpon->id] ?? 0);
            $cap = (int) $galpon->max_capacity;

            return [
                'id' => (int) $galpon->id,
                'name' => $galpon->name,
                'sector_label' => $this->sectorLabel($this->sectorKey($galpon->sector)),
                'purpose_label' => $this->purposeLabel($galpon->purpose),
                'capacity' => $cap,
                'occupied' => $occ,
                'percent' => $cap > 0 ? round(min(100, ($occ / $cap) * 100), 1) : 0.0,
            ];
        })->values()->all();

        // Consolidado = suma de la ocupación de los galpones activos (fuente
        // única con el detalle `sheds`). Se conserva el valor real: si hay
        // sobrecarga, `occupied` puede superar la capacidad instalada.
        $occupied = (int) array_sum(array_column($sheds, 'occupied'));

        return [
            'capacity' => $capacity,
            'occupied' => $occupied,
            'percent' => $capacity > 0 ? round(min(100, ($occupied / $capacity) * 100), 1) : 0.0,
            'galpones_active' => $galpones->count(),
            'sheds' => $sheds,
        ];
    }

    /**
     * Estado resumido de las actividades (para el Resumen Ejecutivo).
     *
     * @return array{total: int, completed: int, percent: float}
     */
    private function activitiesSnapshot(Request $request, $user): array
    {
        $query = $this->activitiesQuery($request, $user)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $total = (int) $query->sum();
        $completed = (int) ($query[Activity::STATUS_COMPLETED] ?? 0);

        return [
            'total' => $total,
            'completed' => $completed,
            'percent' => $total > 0 ? round(($completed / $total) * 100, 1) : 0.0,
        ];
    }

    /**
     * Inventario crítico: bajo stock, por vencer y entradas recientes.
     *
     * @return array<string, mixed>
     */
    private function inventorySnapshot(Request $request, $user): array
    {
        if (! $this->moduleEnabled($request, $user, 'inventory')) {
            return [
                'available' => false,
                'low_stock' => [],
                'expiring' => [],
                'recent_entries' => [],
                'total_items' => 0,
                'stock_value' => 0.0,
            ];
        }

        $itemQuery = InventoryItem::query();
        $this->applyFarmScope($itemQuery, $request, $user);

        $totalItems = (int) (clone $itemQuery)->count();
        $stockValue = round((float) (clone $itemQuery)->sum('total_cost'), 2);

        $lowStock = (clone $itemQuery)
            ->lowStock()
            ->orderBy('current_stock')
            ->limit(10)
            ->get(['id', 'code', 'name', 'current_stock', 'min_stock', 'unit'])
            ->map(fn (InventoryItem $item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'current_stock' => (float) $item->current_stock,
                'min_stock' => (float) $item->min_stock,
                'unit_short' => $item->unitShort(),
            ])
            ->values()
            ->all();

        $expiring = (clone $itemQuery)
            ->expiring()
            ->orderBy('expiration_date')
            ->limit(10)
            ->get(['id', 'code', 'name', 'expiration_date', 'unit'])
            ->map(fn (InventoryItem $item) => [
                'id' => $item->id,
                'code' => $item->code,
                'name' => $item->name,
                'expiration_date' => $item->expiration_date?->toDateString(),
                'is_expired' => $item->isExpired(),
            ])
            ->values()
            ->all();

        $recentQuery = InventoryLot::query()->with(['item:id,code,name,unit']);
        $this->applyFarmScope($recentQuery, $request, $user);

        $recentEntries = $recentQuery
            ->orderByDesc('created_at')
            ->limit(8)
            ->get(['id', 'inventory_item_id', 'code', 'expiration_date', 'created_at'])
            ->map(fn (InventoryLot $lot) => [
                'id' => $lot->id,
                'code' => $lot->code,
                'item_code' => $lot->item?->code,
                'item_name' => $lot->item?->name,
                'expiration_date' => $lot->expiration_date?->toDateString(),
                'created_at' => $lot->created_at?->toDateTimeString(),
            ])
            ->values()
            ->all();

        return [
            'available' => true,
            'low_stock' => $lowStock,
            'expiring' => $expiring,
            'recent_entries' => $recentEntries,
            'total_items' => $totalItems,
            'stock_value' => $stockValue,
        ];
    }

    /**
     * Número de insumos en riesgo (bajo stock o vencidos/por vencer).
     */
    private function itemsAtRiskCount(Request $request, $user): int
    {
        if (! $this->moduleEnabled($request, $user, 'inventory')) {
            return 0;
        }

        $query = InventoryItem::query();
        $this->applyFarmScope($query, $request, $user);

        return (int) (clone $query)
            ->where(function ($q) {
                $q->where(function ($low) {
                    $low->where('min_stock', '>', 0)->whereColumn('current_stock', '<=', 'min_stock');
                })->orWhere(function ($exp) {
                    $exp->whereNotNull('expiration_date')
                        ->whereDate('expiration_date', '<=', now()->addDays(InventoryItem::EXPIRING_SOON_DAYS)->toDateString());
                });
            })
            ->count();
    }

    /**
     * Consulta base de actividades según el rol.
     *
     * Un encargado (subordinate) solo ve sus propias actividades; admin y
     * root ven todo el alcance de granja.
     */
    private function activitiesQuery(Request $request, $user)
    {
        $query = Activity::query();
        $this->applyFarmScope($query, $request, $user);

        if (! $user->isRoot() && ! $user->isAdmin()) {
            $query->where('assigned_to', (int) $user->id);
        }

        return $query;
    }

    /**
     * @param  array<int, int>  $ids
     * @return array<int, string>
     */
    private function userNames(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return DB::table('users')
            ->whereIn('id', $ids)
            ->get(['id', 'name', 'lastname'])
            ->mapWithKeys(fn ($row) => [
                (int) $row->id => trim(($row->name ?? '').' '.($row->lastname ?? '')),
            ])
            ->all();
    }

    /* ================================================================= */
    /* Helpers de alcance, taxonomía y permisos                           */
    /* ================================================================= */

    private function currentUser()
    {
        return Auth::guard('api')->user() ?? Auth::user();
    }

    private function hasSpecificFarm(Request $request): bool
    {
        return $request->filled('farm_id')
            && strtolower(trim((string) $request->farm_id)) !== 'all';
    }

    /**
     * Aplica el alcance de granja a una consulta.
     */
    private function applyFarmScope($query, Request $request, $user, string $column = 'farm_id')
    {
        if ($user->isRoot()) {
            if ($this->hasSpecificFarm($request)) {
                $query->where($column, (int) $request->farm_id);
            }

            return $query;
        }

        if ($user->farm_id) {
            $query->where($column, (int) $user->farm_id);
        }

        return $query;
    }

    /**
     * Valida que el usuario tenga contexto de granja para consultar.
     */
    private function guardContext($user, Request $request)
    {
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

        return null;
    }

    /**
     * ¿El módulo indicado está habilitado para la granja en consulta?
     */
    private function moduleEnabled(Request $request, $user, string $code): bool
    {
        // El root tiene acceso global a todos los módulos.
        if ($user->isRoot() && ! $this->hasSpecificFarm($request)) {
            return true;
        }

        $farmId = $user->isRoot() ? (int) $request->farm_id : (int) $user->farm_id;

        if (! $farmId) {
            return false;
        }

        return DB::table('farm_modules')
            ->join('modules', 'modules.id', '=', 'farm_modules.module_id')
            ->where('farm_modules.farm_id', $farmId)
            ->where('modules.code', $code)
            ->where('farm_modules.is_enabled', true)
            ->exists();
    }

    private function staffScopeLabel($user, Request $request): string
    {
        if ($user->isRoot()) {
            return $this->hasSpecificFarm($request) ? 'farm' : 'global';
        }

        return $user->isAdmin() ? 'farm' : 'self';
    }

    /**
     * Normaliza el sector a una clave canónica.
     */
    private function sectorKey(?string $sector): string
    {
        $key = Species::normalizeKey($sector);

        return match (true) {
            $key === '' || in_array($key, ['general', 'mixto', 'mixta'], true) => $key === '' ? 'otros' : 'mixto',
            str_contains($key, 'porcin') || $key === 'cerdos' || $key === 'cerdo' => 'porcino',
            str_contains($key, 'avicol') || str_contains($key, 'aviar') || str_contains($key, 'gallina') || str_contains($key, 'pollo') => 'avicola',
            str_contains($key, 'bovin') || str_contains($key, 'vacun') || str_contains($key, 'ganado') => 'bovino',
            default => 'otros',
        };
    }

    /**
     * Normaliza el propósito a una clave canónica.
     */
    private function purposeKey(?string $purpose): string
    {
        $key = Species::normalizeKey($purpose);

        return match (true) {
            $key === '' => 'sin_definir',
            str_contains($key, 'huevo') || str_contains($key, 'postura') => 'postura',
            str_contains($key, 'carne') || str_contains($key, 'engorde') || str_contains($key, 'ceba') => 'carne',
            str_contains($key, 'reproduc') || str_contains($key, 'cria') || str_contains($key, 'pie de cria') => 'reproduccion',
            default => 'otros',
        };
    }

    private function sectorLabel(?string $value): string
    {
        $key = ($value !== null && isset(self::SECTOR_LABELS[$value])) ? $value : $this->sectorKey($value);

        return self::SECTOR_LABELS[$key] ?? 'Otros';
    }

    private function purposeLabel(?string $value): string
    {
        $key = ($value !== null && isset(self::PURPOSE_LABELS[$value])) ? $value : $this->purposeKey($value);

        return self::PURPOSE_LABELS[$key] ?? 'Sin definir';
    }
}
