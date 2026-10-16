<?php

namespace App\Http\Controllers;

use App\Models\AnimalService;
use App\Models\EggProduction;
use App\Models\Galpon;
use App\Models\Lot;
use App\Models\LoteAnimal;
use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class LotController extends Controller
{
    /**
     * Usuario autenticado (JWT api o guard por defecto).
     */
    private function currentUser()
    {
        return Auth::guard('api')->user() ?? Auth::user();
    }

    /**
     * Determina si un propósito corresponde a producción de huevos.
     */
    private function isEggPurpose(?string $purpose): bool
    {
        $key = Species::normalizeKey($purpose);

        // Acepta tanto "huevos" como "postura" (y cualquier variante de
        // mayúsculas/acentos), alineado con la lógica del frontend que
        // muestra la acción "Recoger Huevos".
        return $key === 'huevos' || $key === 'postura';
    }

    /**
     * Determina si un propósito corresponde a reproducción.
     */
    private function isReproductionPurpose(?string $purpose): bool
    {
        return Species::normalizeKey($purpose) === 'reproduccion';
    }

    /**
     * Genera un código de lote único e irrepetible (LOT-XXXXX),
     * verificando colisiones ante concurrencia.
     */
    private function generateUniqueCode(): string
    {
        do {
            $code = Lot::generateCode();
        } while (Lot::where('code', $code)->exists());

        return $code;
    }

    /**
     * Genera un identificador de animal único e irrepetible (5 dígitos).
     */
    private function generateUniqueIdentifier(): string
    {
        do {
            $identifier = LoteAnimal::generateIdentifier();
        } while (LoteAnimal::where('identifier', $identifier)->exists());

        return $identifier;
    }

    /**
     * Busca un lote respetando el aislamiento multigranja.
     */
    private function findLotOrFail(int $id)
    {
        return Lot::with([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ])->find($id);
    }

    /**
     * Busca un animal respetando el aislamiento multigranja
     * (scope global de LoteAnimal filtra por granja del lote).
     */
    private function findAnimalOrFail(int $id)
    {
        return LoteAnimal::with(['lote', 'services'])->find($id);
    }

    /**
     * Estados en los que el animal individual deja de contar dentro de la
     * producción del lote (cosecha, venta, descarte o mortalidad).
     */
    private const ANIMAL_OUT_OF_PRODUCTION_STATUSES = ['cosechado', 'vendido', 'descartado', 'muerto'];

    /**
     * Sincroniza la cantidad del lote y, con ello, la capacidad del galpón
     * (el cupo ocupado se calcula en cada consulta como la suma de los lotes
     * activos, por lo que reducir/sumar `quantity` libera o consume cupo).
     *
     * Reglas:
     *  - En producción (activo/gestación/destete) -> fuera de ella:
     *    `quantity = quantity - 1` (libera cupo; nunca baja de 0).
     *  - Fuera de ella -> en producción: revalida el cupo disponible del
     *    galpón y suma `quantity + 1`; devuelve 422 si no hay espacio.
     *  - Cambios dentro del mismo lado: SIN EFECTO sobre el cupo. En
     *    particular, pasar de "activo" a "gestación" (o de "gestación"
     *    a "destete"/"activo") NO libera ni resta cupo: la cerda sigue
     *    ocupando físicamente su lugar en el galpón. Solo las salidas
     *    definitivas (cosechado / vendido / descartado / muerto) lo hacen.
     */
    private function syncLotQuantityOnAnimalStatusChange(Lot $lot, string $oldStatus, string $newStatus): void
    {
        $wasOut = in_array($oldStatus, self::ANIMAL_OUT_OF_PRODUCTION_STATUSES, true);
        $isOut = in_array($newStatus, self::ANIMAL_OUT_OF_PRODUCTION_STATUSES, true);

        if ($wasOut === $isOut) {
            return;
        }

        if ($isOut) {
            // Cosecha / venta / descarte / mortalidad: reduce la cantidad y libera cupo
            $lot->quantity = max(0, (int) $lot->quantity - 1);
            $lot->save();
            // Recargar desde la BD para que la instancia refleje el valor
            // real persistido (útil ante triggers o defaults en PostgreSQL).
            $lot->refresh();

            return;
        }

        // Reingreso a producción: revalidar cupo disponible del galpón
        // (también al reactivar un lote inactivo por cierre automático,
        // ya que volverá a consumir cupo al pasar a activo).
        if ($lot->galpon_id) {
            $galpon = Galpon::find($lot->galpon_id);

            if ($galpon) {
                $occupiedExcludingThisLot = (int) Lot::query()
                    ->where('galpon_id', $lot->galpon_id)
                    ->where('status', Lot::STATUS_ACTIVE)
                    ->where('id', '!=', $lot->id)
                    ->sum('quantity');

                $available = (int) $galpon->max_capacity - $occupiedExcludingThisLot;

                if ($available < ((int) $lot->quantity + 1)) {
                    abort(Response::HTTP_UNPROCESSABLE_ENTITY, 'El galpón no tiene cupo disponible para reincorporar el animal a la producción.');
                }
            }
        }

        $lot->quantity = (int) $lot->quantity + 1;
        $lot->save();
        $lot->refresh();
    }

    /**
     * Display a listing of lotes filtered strictly by the user's farm (or global if Root).
     */
    public function index(Request $request)
    {
        $user = $this->currentUser();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = Lot::query()->with([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ]);

        // Multi-farm isolation and safe sanitization of farm_id (handles "all")
        $hasSpecificFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';

        if ($hasSpecificFarm) {
            $query->where('farm_id', (int) $request->farm_id);
        } elseif (! $user->isRoot()) {
            if (! $user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }

            $query->where('farm_id', $user->farm_id)
                ->whereNotNull('farm_id');
        }

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('galpon_id')) {
            $query->where('galpon_id', (int) $request->galpon_id);
        }

        if ($request->filled('species_id')) {
            $query->where('species_id', (int) $request->species_id);
        }

        if ($request->filled('purpose')) {
            $query->where('purpose', $request->purpose);
        }

        if ($request->filled('sector')) {
            $query->where('sector', $request->sector);
        }

        if ($request->filled('entry_date')) {
            $query->whereDate('entry_date', $request->entry_date);
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('sector', 'like', $term)
                    ->orWhere('purpose', 'like', $term);
            });
        }

        $lots = $query->orderByDesc('created_at')->get();

        // Ocupación actual por lote (activos + gestantes
        // + destetados): cantidad real de animales que
        // ocupan espacio en el galpón.
        Lot::loadCurrentOccupancy($lots);

        // Costo total de cosecha por lote (animales cosechados).
        Lot::loadHarvestCost($lots);

        $stats = $this->computeLotStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Lista de lotes obtenida con éxito.',
            'data' => $lots,
            'stats' => $stats,
            'total_lotes' => $stats['total_lotes'],
            'active_lotes' => $stats['active_lotes'],
            'inactive_lotes' => $stats['inactive_lotes'],
            'total_animals' => $stats['total_animals'],
        ], Response::HTTP_OK);
    }

    /**
     * Return contextual summary statistics for lotes strictly filtered by farm_id.
     */
    public function stats(Request $request)
    {
        $user = $this->currentUser();

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

        $stats = $this->computeLotStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de lotes obtenidas con éxito.',
            'data' => $stats,
            'total_lotes' => $stats['total_lotes'],
            'active_lotes' => $stats['active_lotes'],
            'inactive_lotes' => $stats['inactive_lotes'],
            'total_animals' => $stats['total_animals'],
        ], Response::HTTP_OK);
    }

    /**
     * Compute summary metrics for lotes strictly filtered by user farm scope.
     */
    protected function computeLotStats(Request $request, $user): array
    {
        $baseQuery = Lot::query();

        $hasSpecificFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';

        if ($hasSpecificFarm) {
            $baseQuery->where('farm_id', (int) $request->farm_id);
        } elseif (! $user->isRoot()) {
            if (! $user->farm_id) {
                return $this->emptyLotStats();
            }
            $baseQuery->where('farm_id', (int) $user->farm_id)->whereNotNull('farm_id');
        }

        $totalLotes = (int) (clone $baseQuery)->count();
        $activeLotes = (int) (clone $baseQuery)->where('status', Lot::STATUS_ACTIVE)->count();
        $inactiveLotes = $totalLotes - $activeLotes;
        $totalAnimals = (int) (clone $baseQuery)->sum('quantity');
        $totalLoteAnimals = (int) LoteAnimal::whereHas('lote', function ($q) use ($baseQuery) {
            $q->whereIn('lots.id', (clone $baseQuery)->pluck('lots.id'));
        })->count();

        // Animales en producción (ocupando espacio físico en
        // los galpones): suma de la ocupación actual de cada
        // lote activo (animales activos + en gestación +
        // destetados). Los lotes sin seguimiento individual
        // (ej. engorde) aportan su cantidad declarada, por lo
        // que la métrica refleja los animales realmente
        // alojados y no el `quantity` declarado.
        $productionLots = (clone $baseQuery)
            ->where('status', Lot::STATUS_ACTIVE)
            ->get(['id', 'quantity']);

        Lot::loadCurrentOccupancy($productionLots);

        $inProductionAnimals = (int) $productionLots->sum('current_occupancy');

        return [
            'total_lotes' => $totalLotes,
            'active_lotes' => $activeLotes,
            'inactive_lotes' => $inactiveLotes,
            'total_animals' => $totalAnimals,
            'total_lote_animals' => $totalLoteAnimals,
            'in_production_animals' => $inProductionAnimals,
            'totalLotes' => $totalLotes,
            'activeLotes' => $activeLotes,
            'inactiveLotes' => $inactiveLotes,
            'totalAnimals' => $totalAnimals,
        ];
    }

    private function emptyLotStats(): array
    {
        return [
            'total_lotes' => 0,
            'active_lotes' => 0,
            'inactive_lotes' => 0,
            'total_animals' => 0,
            'total_lote_animals' => 0,
            'in_production_animals' => 0,
            'totalLotes' => 0,
            'activeLotes' => 0,
            'inactiveLotes' => 0,
            'totalAnimals' => 0,
        ];
    }

    /**
     * Store a newly created lote in storage.
     */
    public function store(Request $request)
    {
        $user = $this->currentUser();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $validator = Validator::make($request->all(), [
            'galpon_id' => 'required|integer|exists:galpones,id',
            'species_id' => 'required|integer|exists:species,id',
            'quantity' => 'required|integer|min:1',
            'purpose' => 'nullable|string|max:255',
            'entry_date' => 'nullable|date',
            'investment_cost' => 'nullable|numeric|min:0',
            'farm_id' => 'nullable|exists:farms,id',
            // Destetes de origen (lote de lechones destetados)
            'from_service_ids' => 'nullable|array',
            'from_service_ids.*' => 'integer|exists:animal_services,id',
        ], [
            'galpon_id.required' => 'El galpón destino es obligatorio.',
            'galpon_id.exists' => 'El galpón seleccionado no existe en el sistema.',
            'species_id.required' => 'La especie asociada es obligatoria.',
            'species_id.exists' => 'La especie seleccionada no existe en el sistema.',
            'quantity.required' => 'La cantidad de animales es obligatoria.',
            'quantity.min' => 'La cantidad debe ser de al menos 1 animal.',
            'farm_id.exists' => 'La granja especificada no existe.',
            'from_service_ids.exists' => 'Uno o más registros de destete no existen en el sistema.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Resolve target farm_id (Root must specify; others inherit their farm)
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');
            if (! $farmId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Debe especificar el ID de la granja (farm_id) para registrar el lote.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $farmId = (int) $farmId;
        } else {
            if (! $user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }
            $farmId = (int) $user->farm_id;
        }

        // Galpon: must belong to the same farm and be active
        $galpon = Galpon::find($request->galpon_id);

        if (! $galpon || (int) $galpon->farm_id !== $farmId) {
            return response()->json([
                'status' => 'error',
                'message' => 'El galpón seleccionado no pertenece a esta granja.',
                'errors' => [
                    'galpon_id' => ['El galpón seleccionado no pertenece a esta granja.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $galpon->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'El galpón seleccionado se encuentra inactivo.',
                'errors' => [
                    'galpon_id' => ['El galpón seleccionado se encuentra inactivo.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Species: same farm, active and matching the barn's species
        $species = Species::find($request->species_id);

        if (! $species || (int) $species->farm_id !== $farmId) {
            return response()->json([
                'status' => 'error',
                'message' => 'La especie seleccionada no pertenece a esta granja.',
                'errors' => [
                    'species_id' => ['La especie seleccionada no pertenece a esta granja.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $species->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'La especie seleccionada se encuentra inactiva.',
                'errors' => [
                    'species_id' => ['La especie seleccionada se encuentra inactiva.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ((int) $species->id !== (int) $galpon->species_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'La especie no coincide con la especie asignada al galpón.',
                'errors' => [
                    'species_id' => ['La especie no coincide con la especie asignada al galpón.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Capacity validation: occupied + new quantity must not exceed max_capacity
        $occupied = Lot::occupiedCapacity($galpon->id);
        $available = (int) $galpon->max_capacity - $occupied;

        if ($available < (int) $request->quantity) {
            return response()->json([
                'status' => 'error',
                'message' => 'La cantidad excede la capacidad disponible del galpón.',
                'errors' => [
                    'quantity' => [
                        sprintf(
                            'El galpón tiene %d de %d cupos ocupados. Solo quedan %d cupos disponibles para este lote.',
                            $occupied,
                            (int) $galpon->max_capacity,
                            max(0, $available)
                        ),
                    ],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Lote de lechones destetados: si el frontend vincula los
        // destetes de origen (`from_service_ids`), todos deben
        // seguir PENDIENTES y la cantidad debe coincidir EXACTAMENTE
        // con la suma de sus lechones vivos pendientes.
        $weanedServices = collect();

        if ($request->filled('from_service_ids')) {
            $serviceIds = array_values(array_unique(array_map('intval', (array) $request->input('from_service_ids'))));

            $weanedServices = AnimalService::with('animal:id,lote_id,identifier')
                ->whereIn('id', $serviceIds)
                ->where('status', AnimalService::STATUS_WEANED)
                ->get();

            if ($weanedServices->count() !== count($serviceIds)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Uno o más registros de destete no existen o no son válidos.',
                    'errors' => [
                        'from_service_ids' => ['Uno o más registros de destete no existen o no son válidos.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $resolved = $weanedServices->first(fn ($service) => (int) $service->pending_piglets <= 0);

            if ($resolved) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Uno o más registros de destete ya fueron asignados a un lote de lechones.',
                    'errors' => [
                        'from_service_ids' => ['Uno o más registros de destete ya fueron asignados a un lote de lechones.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $pendingSum = (int) $weanedServices->sum('pending_piglets');

            if ((int) $request->quantity !== $pendingSum) {
                $message = sprintf(
                    'La cantidad del lote debe coincidir exactamente con los %d lechones vivos pendientes de destete.',
                    $pendingSum
                );

                return response()->json([
                    'status' => 'error',
                    'message' => $message,
                    'errors' => [
                        'quantity' => [$message],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        // Automatic inheritance: sector and purpose come directly from the barn
        $sector = $galpon->sector ?: ($galpon->category ?: 'General');
        $purpose = $request->filled('purpose') ? trim((string) $request->purpose) : ($galpon->purpose ?: null);

        $lot = DB::transaction(function () use ($request, $farmId, $galpon, $species, $sector, $purpose, $weanedServices) {
            $lot = Lot::create([
                'farm_id' => $farmId,
                'galpon_id' => $galpon->id,
                'barn_id' => $request->has('barn_id') ? (int) $request->barn_id : null,
                'code' => $this->generateUniqueCode(),
                'species_id' => $species->id,
                'sector' => $sector,
                'purpose' => $purpose,
                'quantity' => (int) $request->quantity,
                'status' => Lot::STATUS_ACTIVE,
                'entry_date' => $request->filled('entry_date') ? $request->input('entry_date') : now()->toDateString(),
                'investment_cost' => $request->filled('investment_cost')
                    ? round((float) $request->input('investment_cost'), 2)
                    : null,
            ]);

            // Resolver los destetes vinculados: sus lechones vivos
            // ya forman parte de este lote y la alerta de
            // "pendientes" desaparece (persistido en BD).
            foreach ($weanedServices as $service) {
                $service->update([
                    'pending_piglets' => 0,
                    'piglet_lot_id' => $lot->id,
                ]);
            }

            return $lot;
        });

        $lot->load([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Lote registrado correctamente.',
            'data' => $lot,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified lote.
     */
    public function show($id)
    {
        $lot = $this->findLotOrFail((int) $id);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $lot->setAttribute('current_occupancy', $lot->currentOccupancy());

        return response()->json([
            'status' => 'success',
            'data' => $lot,
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified lote in storage.
     */
    public function update(Request $request, $id)
    {
        $user = $this->currentUser();

        $lot = Lot::find($id);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary for non-root users
        if ($user && ! $user->isRoot() && (int) $lot->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este lote pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = Validator::make($request->all(), [
            'galpon_id' => 'sometimes|required|integer|exists:galpones,id',
            'species_id' => 'sometimes|required|integer|exists:species,id',
            'quantity' => 'sometimes|required|integer|min:1',
            'purpose' => 'nullable|string|max:255',
            'status' => 'sometimes|required|string|in:activo,inactivo',
            'entry_date' => 'nullable|date',
            'investment_cost' => 'nullable|numeric|min:0',
        ], [
            'quantity.min' => 'La cantidad debe ser de al menos 1 animal.',
            'status.in' => 'El estado del lote debe ser activo o inactivo.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $farmId = (int) $lot->farm_id;

        // Galpon change: validate farm ownership, active state and species match
        if ($request->has('galpon_id')) {
            $galpon = Galpon::find($request->galpon_id);

            if (! $galpon || (int) $galpon->farm_id !== $farmId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El galpón seleccionado no pertenece a esta granja.',
                    'errors' => [
                        'galpon_id' => ['El galpón seleccionado no pertenece a esta granja.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if (! $galpon->is_active) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El galpón seleccionado se encuentra inactivo.',
                    'errors' => [
                        'galpon_id' => ['El galpón seleccionado se encuentra inactivo.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if ($request->has('species_id') && (int) $request->species_id !== (int) $galpon->species_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'La especie no coincide con la especie asignada al galpón.',
                    'errors' => [
                        'species_id' => ['La especie no coincide con la especie asignada al galpón.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $lot->galpon_id = $galpon->id;
            $lot->sector = $galpon->sector ?: ($galpon->category ?: 'General');
            if (! $request->filled('purpose')) {
                $lot->purpose = $galpon->purpose;
            }
        }

        if ($request->has('species_id')) {
            $species = Species::find($request->species_id);

            if (! $species || (int) $species->farm_id !== $farmId || ! $species->is_active) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'La especie seleccionada no es válida para esta granja.',
                    'errors' => [
                        'species_id' => ['La especie seleccionada no es válida para esta granja.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $lot->species_id = $species->id;
        }

        // Quantity change: revalidate the barn capacity excluding this lot's current occupancy
        if ($request->has('quantity')) {
            $galponId = $request->filled('galpon_id') ? (int) $request->galpon_id : (int) $lot->galpon_id;
            $galpon = Galpon::find($galponId);

            if ($galpon) {
                $occupied = Lot::occupiedCapacity($galponId) - (int) $lot->quantity;
                $available = (int) $galpon->max_capacity - $occupied;

                if ($available < (int) $request->quantity) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'La cantidad excede la capacidad disponible del galpón.',
                        'errors' => [
                            'quantity' => [
                                sprintf(
                                    'El galpón tiene %d de %d cupos ocupados (excluyendo este lote). Solo quedan %d cupos disponibles.',
                                    $occupied,
                                    (int) $galpon->max_capacity,
                                    max(0, $available)
                                ),
                            ],
                        ],
                    ], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
            }

            $lot->quantity = (int) $request->quantity;
        }

        if ($request->filled('purpose')) {
            $lot->purpose = trim((string) $request->purpose);
        }

        if ($request->filled('entry_date')) {
            $lot->entry_date = $request->input('entry_date');
        }

        if ($request->has('investment_cost')) {
            $lot->investment_cost = $request->filled('investment_cost')
                ? round((float) $request->input('investment_cost'), 2)
                : null;
        }

        // Status change: reactivating a lot must respect the barn capacity
        if ($request->has('status')) {
            $newStatus = $request->input('status');

            if ($newStatus === Lot::STATUS_ACTIVE && $lot->status !== Lot::STATUS_ACTIVE) {
                $galponId = $lot->galpon_id;
                $galpon = $galponId ? Galpon::find($galponId) : null;

                if ($galpon) {
                    $occupied = Lot::occupiedCapacity($galponId);
                    $available = (int) $galpon->max_capacity - $occupied;

                    if ($available < (int) $lot->quantity) {
                        return response()->json([
                            'status' => 'error',
                            'message' => 'No se puede reactivar el lote: excede la capacidad disponible del galpón.',
                            'errors' => [
                                'status' => [
                                    sprintf(
                                        'El galpón solo tiene %d cupos disponibles y el lote requiere %d.',
                                        max(0, $available),
                                        (int) $lot->quantity
                                    ),
                                ],
                            ],
                        ], Response::HTTP_UNPROCESSABLE_ENTITY);
                    }
                }
            }

            $lot->status = $newStatus;
        }

        $lot->save();
        $lot->load([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Lote actualizado correctamente.',
            'data' => $lot,
        ], Response::HTTP_OK);
    }

    /**
     * Toggle or update the active status of the lote.
     */
    public function toggleStatus(Request $request, $id)
    {
        return $this->update($request, $id);
    }

    /**
     * Cosechar un lote avícola o porcino de carne.
     *
     * Calcula pesos y precios totales, libera el cupo del galpón
     * (el lote pasa a inactivo sin borrarse) y, en cosechas parciales,
     * resta la cantidad cosechada manteniendo el lote activo.
     */
    public function harvest(Request $request, $id)
    {
        $user = $this->currentUser();

        $lot = Lot::find($id);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && (int) $lot->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este lote pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($lot->status !== Lot::STATUS_ACTIVE) {
            return response()->json([
                'status' => 'error',
                'message' => 'Solo se pueden cosechar lotes activos.',
                'errors' => [
                    'status' => ['Solo se pueden cosechar lotes activos.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $isEggProduction = $this->isEggPurpose($lot->purpose);

        $validator = Validator::make($request->all(), [
            'harvest_date' => 'nullable|date',
            'avg_weight' => $isEggProduction ? 'nullable|numeric|min:0' : 'required|numeric|min:0',
            'price_per_kg' => $isEggProduction ? 'nullable|numeric|min:0' : 'required|numeric|min:0',
            'quantity' => 'nullable|integer|min:1',
        ], [
            'avg_weight.required' => 'El peso promedio es obligatorio para la cosecha.',
            'price_per_kg.required' => 'El precio por kilo es obligatorio para la cosecha.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Partial harvest support: defaults to the full lot quantity
        $harvestQuantity = (int) ($request->input('quantity') ?? $lot->quantity);
        $harvestQuantity = min($harvestQuantity, (int) $lot->quantity);

        $avgWeight = (float) $request->input('avg_weight', 0);
        $pricePerKg = (float) $request->input('price_per_kg', 0);
        $totalWeight = $avgWeight * $harvestQuantity;
        $totalPrice = $totalWeight * $pricePerKg;

        $lot->harvest_date = $request->filled('harvest_date')
            ? $request->input('harvest_date')
            : now()->toDateString();
        $lot->avg_weight = round($avgWeight, 2);
        $lot->total_weight = round($totalWeight, 2);
        $lot->price_per_kg = round($pricePerKg, 2);
        $lot->total_price = round($totalPrice, 2);

        $remaining = (int) $lot->quantity - $harvestQuantity;

        if ($remaining <= 0) {
            // Full harvest: release the whole capacity and deactivate the lot (logical delete)
            $lot->quantity = 0;
            $lot->status = Lot::STATUS_INACTIVE;
            $message = 'Lote cosechado correctamente. El cupo del galpón ha sido liberado.';
        } else {
            // Partial harvest: only the harvested quantity is released
            $lot->quantity = $remaining;
            $message = 'Cosecha parcial registrada. El cupo parcial ha sido liberado.';
        }

        $lot->save();
        $lot->load([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => $lot,
            'harvest' => [
                'quantity' => $harvestQuantity,
                'avg_weight' => $lot->avg_weight,
                'total_weight' => $lot->total_weight,
                'price_per_kg' => $lot->price_per_kg,
                'total_price' => $lot->total_price,
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Registrar producción de huevos (completos y rotos) de un lote avícola.
     *
     * Acumula la producción sin liberar el cupo del galpón: el cupo se
     * mantiene ocupado hasta que se coseche el lote completo.
     */
    public function registerEggs(Request $request, $id)
    {
        $user = $this->currentUser();

        $lot = Lot::find($id);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && (int) $lot->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este lote pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $this->isEggPurpose($lot->purpose)) {
            return response()->json([
                'status' => 'error',
                'message' => 'El registro de huevos solo aplica a lotes de producción de huevos.',
                'errors' => [
                    'purpose' => ['El registro de huevos solo aplica a lotes de producción de huevos.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($lot->status !== Lot::STATUS_ACTIVE) {
            return response()->json([
                'status' => 'error',
                'message' => 'Solo se pueden registrar huevos en lotes activos.',
                'errors' => [
                    'status' => ['Solo se pueden registrar huevos en lotes activos.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validator = Validator::make($request->all(), [
            'total_eggs' => 'required|integer|min:0',
            'broken_eggs' => 'nullable|integer|min:0',
            'egg_price' => 'required|numeric|min:0',
        ], [
            'total_eggs.required' => 'La cantidad de huevos es obligatoria.',
            'egg_price.required' => 'El precio por huevo es obligatorio.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $totalEggs = (int) $request->total_eggs;
        $brokenEggs = (int) ($request->input('broken_eggs', 0));

        $eggPrice = (float) $request->egg_price;

        // Accumulate production history; capacity remains occupied until harvest.
        // "Huevos Completos" (buenos) y "Huevos Rotos" son valores
        // INDEPENDIENTES: el total recolectado es la SUMA de ambos.
        // Costo de producción = completos × precio (base: los buenos).
        $lot->total_eggs += $totalEggs;
        $lot->broken_eggs += $brokenEggs;
        $lot->egg_price = round($eggPrice, 2);
        $lot->total_egg_cost = round((int) $lot->total_eggs * $eggPrice, 2);
        $lot->total_broken_cost = round((int) $lot->broken_eggs * $eggPrice, 2);
        $lot->save();

        // Historial por fecha: permite construir la serie temporal de
        // mermas (buenos vs. rotos) en el módulo de Analítica.
        EggProduction::create([
            'farm_id' => $lot->farm_id,
            'lot_id' => $lot->id,
            'production_date' => now()->toDateString(),
            'good_eggs' => $totalEggs,
            'broken_eggs' => $brokenEggs,
            'egg_price' => round($eggPrice, 2),
            'good_cost' => round($totalEggs * $eggPrice, 2),
            'broken_cost' => round($brokenEggs * $eggPrice, 2),
            'created_by' => $user?->id,
        ]);

        $lot->load([
            'galpon:id,farm_id,name,sector,purpose,max_capacity,is_active',
            'species:id,name,category,is_active',
            'farm:id,name,code',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Producción de huevos registrada. El cupo del galpón se mantiene hasta la cosecha del lote.',
            'data' => $lot,
            'eggs' => [
                // Huevos Completos (buenos): base del costo de producción
                'total_eggs' => $lot->total_eggs,
                // Huevos Rotos (mermas)
                'broken_eggs' => $lot->broken_eggs,
                // Total de Huevos = Completos + Rotos
                'total_eggs_all' => (int) $lot->total_eggs + (int) $lot->broken_eggs,
                'egg_price' => $lot->egg_price,
                // Costo de producción = Completos × precio
                'total_egg_cost' => $lot->total_egg_cost,
                // Costo de mermas = Rotos × precio
                'total_broken_cost' => $lot->total_broken_cost,
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified lote from storage.
     *
     * Los lotes activos con animales deben cosecharse primero (baja lógica);
     * los lotes con animales registrados individualmente no se eliminan.
     */
    public function destroy($id)
    {
        $user = $this->currentUser();

        $lot = Lot::find($id);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && (int) $lot->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este lote pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($lot->animals()->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar el lote porque tiene animales registrados individualmente.',
                'errors' => [
                    'lote_animals' => ['No se puede eliminar el lote porque tiene animales registrados individualmente.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($lot->status === Lot::STATUS_ACTIVE && (int) $lot->quantity > 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar un lote activo con animales. Coseche el lote primero.',
                'errors' => [
                    'status' => ['No se puede eliminar un lote activo con animales. Coseche el lote primero.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $lot->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Lote eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /**
     * Listar los animales registrados individualmente en un lote.
     */
    public function animals(Request $request, $lotId)
    {
        $lot = $this->findLotOrFail((int) $lotId);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $query = $lot->animals();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('gender')) {
            $query->where('gender', $request->gender);
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('identifier', 'like', $term)
                    ->orWhere('breed', 'like', $term);
            });
        }

        $animals = $query->orderByDesc('created_at')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Animales del lote obtenidos con éxito.',
            'data' => $animals,
            'total_animals' => $animals->count(),
        ], Response::HTTP_OK);
    }

    /**
     * Registrar un animal individual en un lote de reproducción.
     */
    public function storeAnimal(Request $request, $lotId)
    {
        $user = $this->currentUser();

        $lot = Lot::find($lotId);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && (int) $lot->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este lote pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (! $this->isReproductionPurpose($lot->purpose)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Solo se pueden registrar animales individuales en lotes de reproducción.',
                'errors' => [
                    'purpose' => ['Solo se pueden registrar animales individuales en lotes de reproducción.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($lot->status !== Lot::STATUS_ACTIVE) {
            return response()->json([
                'status' => 'error',
                'message' => 'Solo se pueden registrar animales en lotes activos.',
                'errors' => [
                    'status' => ['Solo se pueden registrar animales en lotes activos.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validator = Validator::make($request->all(), [
            'breed' => 'nullable|string|max:255',
            'father_breed' => 'nullable|string|max:255',
            'mother_breed' => 'nullable|string|max:255',
            'gender' => 'required|string|in:hembra,macho',
            'birth_date' => 'nullable|date',
            'parity_count' => 'nullable|integer|min:0',
            'teats_count' => 'nullable|integer|min:0',
            'avg_piglets_per_birth' => 'nullable|numeric|min:0',
        ], [
            'gender.required' => 'El género del animal es obligatorio.',
            'gender.in' => 'El género debe ser hembra o macho.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Regla estricta de cupo: el lote no puede tener más
        // animales en producción de los que declara su
        // `quantity`. Cada registro individual debe caber en
        // un cupo declarado del lote. Los cambios de estado
        // dentro de la producción (gestación / destete) no
        // alteran este conteo: solo las salidas definitivas
        // (cosechado / vendido / descartado / muerto) liberan
        // cupo y dejan lugar para un nuevo registro.
        $inProduction = (int) $lot->animals()
            ->whereNotIn('status', self::ANIMAL_OUT_OF_PRODUCTION_STATUSES)
            ->count();

        if ($inProduction >= (int) $lot->quantity) {
            return response()->json([
                'status' => 'error',
                'message' => 'El lote ya tiene registrados todos sus animales.',
                'errors' => [
                    'quantity' => [
                        sprintf(
                            'El lote declara %d animales y ya tiene %d en producción. Libere un cupo (cosecha / venta / descarte) o ajuste la cantidad del lote.',
                            (int) $lot->quantity,
                            $inProduction
                        ),
                    ],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $animal = LoteAnimal::create([
            'lote_id' => $lot->id,
            'identifier' => $this->generateUniqueIdentifier(),
            'breed' => $request->filled('breed') ? trim((string) $request->breed) : null,
            'father_breed' => $request->filled('father_breed') ? trim((string) $request->father_breed) : null,
            'mother_breed' => $request->filled('mother_breed') ? trim((string) $request->mother_breed) : null,
            'gender' => $request->gender,
            'birth_date' => $request->filled('birth_date') ? $request->input('birth_date') : null,
            'parity_count' => (int) ($request->input('parity_count', 0)),
            'teats_count' => (int) ($request->input('teats_count', 0)),
            'avg_piglets_per_birth' => round((float) $request->input('avg_piglets_per_birth', 0), 2),
            'status' => LoteAnimal::STATUS_ACTIVE,
        ]);

        $animal->load(['lote', 'services']);

        return response()->json([
            'status' => 'success',
            'message' => 'Animal registrado correctamente en el lote.',
            'data' => $animal,
        ], Response::HTTP_CREATED);
    }

    /**
     * Mostrar un animal individual.
     */
    public function showAnimal($animalId)
    {
        $animal = $this->findAnimalOrFail((int) $animalId);

        if (! $animal) {
            return response()->json([
                'status' => 'error',
                'message' => 'Animal no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'status' => 'success',
            'data' => $animal,
        ], Response::HTTP_OK);
    }

    /**
     * Actualizar un animal individual (incluye transición de estado).
     */
    public function updateAnimal(Request $request, $animalId)
    {
        $animal = $this->findAnimalOrFail((int) $animalId);

        if (! $animal) {
            return response()->json([
                'status' => 'error',
                'message' => 'Animal no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'breed' => 'nullable|string|max:255',
            'father_breed' => 'nullable|string|max:255',
            'mother_breed' => 'nullable|string|max:255',
            'gender' => 'sometimes|required|string|in:hembra,macho',
            'birth_date' => 'nullable|date',
            'parity_count' => 'nullable|integer|min:0',
            'teats_count' => 'nullable|integer|min:0',
            'avg_piglets_per_birth' => 'nullable|numeric|min:0',
            'sale_weight' => 'nullable|numeric|min:0',
            'sale_price_per_kg' => 'nullable|numeric|min:0',
            'sale_total_price' => 'nullable|numeric|min:0',
            'status' => 'sometimes|required|string|in:activo,gestación,destete,cosechado,vendido,descartado,muerto',
        ], [
            'gender.in' => 'El género debe ser hembra o macho.',
            'status.in' => 'El estado debe ser activo, gestación, destete, cosechado, vendido, descartado o muerto.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($request->filled('breed')) {
            $animal->breed = trim((string) $request->breed);
        }
        if ($request->filled('father_breed')) {
            $animal->father_breed = trim((string) $request->father_breed);
        }
        if ($request->filled('mother_breed')) {
            $animal->mother_breed = trim((string) $request->mother_breed);
        }
        if ($request->filled('gender')) {
            $animal->gender = $request->gender;
        }
        if ($request->filled('birth_date')) {
            $animal->birth_date = $request->input('birth_date');
        }
        if ($request->filled('parity_count')) {
            $animal->parity_count = (int) $request->parity_count;
        }
        if ($request->filled('teats_count')) {
            $animal->teats_count = (int) $request->teats_count;
        }
        if ($request->filled('avg_piglets_per_birth')) {
            $animal->avg_piglets_per_birth = round((float) $request->avg_piglets_per_birth, 2);
        }
        if ($request->filled('sale_weight')) {
            $animal->sale_weight = round((float) $request->sale_weight, 2);
        }
        if ($request->filled('sale_price_per_kg')) {
            $animal->sale_price_per_kg = round((float) $request->sale_price_per_kg, 2);
        }
        // Automatic sale total when weight and price are known
        if ($animal->sale_weight !== null && $animal->sale_price_per_kg !== null) {
            $animal->sale_total_price = round(
                (float) $animal->sale_weight * (float) $animal->sale_price_per_kg,
                2
            );
        } elseif ($request->filled('sale_total_price')) {
            $animal->sale_total_price = round((float) $request->sale_total_price, 2);
        }
        $oldStatus = (string) $animal->status;
        $newStatus = $request->filled('status')
            ? (string) $request->status
            : $oldStatus;

        // Aplicar el nuevo estado al modelo antes de la transacción
        // para que el save() persista el cambio de forma atómica junto
        // con la sincronización de la cantidad del lote.
        $animal->status = $newStatus;

        DB::transaction(function () use ($animal, $oldStatus, $newStatus) {
            // 1. Persistir el estado individual del animal (cosechado,
            //    vendido, descartado, muerto, ...) en la tabla lote_animals.
            $animal->save();

            // 2. Si el estado cambió, sincronizar la cantidad del lote
            //    (y con ello el cupo del galpón) en la misma transacción.
            if ($newStatus !== $oldStatus) {
                $this->syncLotQuantityOnAnimalStatusChange($animal->lote, $oldStatus, $newStatus);
            }

            // 3. Regla de negocio: evaluar la cantidad de animales
            //    vigentes y cerrar el lote automáticamente cuando la
            //    cantidad llega a cero (y reactivarlo si reingresa
            //    un animal a producción).
            $animal->lote->syncStatusFromAnimals();
        });

        // Recargar desde la base de datos para garantizar que la respuesta
        // (y cualquier consulta posterior del lote) refleje el estado
        // real persistido, no el valor en memoria.
        $animal->refresh();
        $animal->load(['lote', 'services']);

        return response()->json([
            'status' => 'success',
            'message' => 'Animal actualizado correctamente.',
            'data' => $animal,
        ], Response::HTTP_OK);
    }

    /**
     * Eliminar un animal individual (solo sin historial de servicios).
     */
    public function destroyAnimal($animalId)
    {
        $animal = $this->findAnimalOrFail((int) $animalId);

        if (! $animal) {
            return response()->json([
                'status' => 'error',
                'message' => 'Animal no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($animal->services()->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar el animal porque tiene servicios registrados.',
                'errors' => [
                    'animal_services' => ['No se puede eliminar el animal porque tiene servicios registrados.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $wasInProduction = ! in_array((string) $animal->status, self::ANIMAL_OUT_OF_PRODUCTION_STATUSES, true);

        DB::transaction(function () use ($animal, $wasInProduction) {
            $animal->delete();

            // Eliminar un animal en producción también libera su cupo en el lote
            if ($wasInProduction) {
                $this->syncLotQuantityOnAnimalStatusChange($animal->lote, (string) $animal->status, 'descartado');
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Animal eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /**
     * Historial de servicios de un animal.
     */
    public function services($animalId)
    {
        $animal = $this->findAnimalOrFail((int) $animalId);

        if (! $animal) {
            return response()->json([
                'status' => 'error',
                'message' => 'Animal no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $services = $animal->services()->orderByDesc('service_date')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Historial de servicios obtenido con éxito.',
            'data' => $services,
            'total_services' => $services->count(),
        ], Response::HTTP_OK);
    }

    /**
     * Registrar un servicio reproductivo (inseminación / monta).
     */
    /**
     * Lechones destetados pendientes de formar un lote.
     *
     * Persistidos en `animal_services.pending_piglets`: al
     * registrar un destete quedan pendientes sus lechones
     * vivos hasta que se cree el lote de lechones vinculado
     * (POST /lots con `from_service_ids`). Así la alerta del
     * frontend sobrevive a un refresco de página.
     */
    public function weanedPending($lotId)
    {
        $lot = $this->findLotOrFail((int) $lotId);

        if (! $lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $services = AnimalService::query()
            ->where('status', AnimalService::STATUS_WEANED)
            ->whereNotNull('pending_piglets')
            ->where('pending_piglets', '>', 0)
            ->whereHas('animal', function ($query) use ($lot) {
                $query->where('lote_id', $lot->id);
            })
            ->with('animal:id,lote_id,identifier')
            ->get(['id', 'lote_animal_id', 'birth_date', 'total_piglets', 'live_piglets', 'pending_piglets']);

        return response()->json([
            'status' => 'success',
            'message' => 'Lechones destetados pendientes obtenidos con éxito.',
            'data' => [
                'pending_piglets' => (int) $services->sum('pending_piglets'),
                'services' => $services->values(),
            ],
        ], Response::HTTP_OK);
    }

    public function storeService(Request $request, $animalId)
    {
        $animal = $this->findAnimalOrFail((int) $animalId);

        if (! $animal) {
            return response()->json([
                'status' => 'error',
                'message' => 'Animal no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'service_type' => 'required|string|in:inseminación,monta,parto',
            'service_date' => 'required|date',
            'status' => 'nullable|string|in:activo,gestación,destete',
            // La fecha de gestación ya NO es un campo independiente:
            // se unifica con la fecha del servicio (inicio de la
            // gestación).
            'pregnancy_date' => 'nullable|date',
            // Destete / parto: obligatorio registrar la fecha del
            // parto y los lechones (total y vivos).
            'birth_date' => 'required_if:status,destete|nullable|date',
            'total_piglets' => 'required_if:status,destete|integer|min:0',
            'live_piglets' => 'required_if:status,destete|integer|min:0|max:'.((int) ($request->input('total_piglets', 0)) ?: 2147483647),
        ], [
            'service_type.required' => 'El tipo de servicio es obligatorio.',
            'service_type.in' => 'El tipo de servicio debe ser inseminación, monta o parto.',
            'service_date.required' => 'La fecha del servicio es obligatoria.',
            'birth_date.required_if' => 'La fecha del parto es obligatoria al registrar el destete/parto.',
            'total_piglets.required_if' => 'El total de lechones es obligatorio al registrar el destete/parto.',
            'live_piglets.required_if' => 'Los lechones vivos son obligatorios al registrar el destete/parto.',
            'live_piglets.max' => 'Los lechones vivos no pueden superar el total de lechones.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $status = $request->filled('status') ? $request->status : AnimalService::STATUS_ACTIVE;

        // Regla de negocio: una cerda en gestación no puede recibir
        // otro servicio (inseminación / monta). Solo se permite
        // el registro de su destete / parto.
        if ($animal->status === LoteAnimal::STATUS_GESTATION && $status !== AnimalService::STATUS_WEANED) {
            return response()->json([
                'status' => 'error',
                'message' => 'La cerda se encuentra actualmente en gestación; debe registrar su destete/parto.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // El destete / parto es un evento de parto: su tipo de
        // servicio debe ser "parto" para mantener íntegro el
        // ciclo reproductivo registrado de la cerda.
        if ($status === AnimalService::STATUS_WEANED && $request->service_type !== AnimalService::TYPE_FARROW) {
            return response()->json([
                'status' => 'error',
                'message' => 'El registro de destete/parto debe usar el tipo de servicio "parto".',
                'errors' => [
                    'service_type' => ['El registro de destete/parto debe usar el tipo de servicio "parto".'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $service = AnimalService::create([
            'lote_animal_id' => $animal->id,
            'service_type' => $request->service_type,
            'service_date' => $request->input('service_date'),
            'status' => $status,
            // Fecha de gestación unificada: si no llega explícita,
            // el inicio de la gestación es la fecha del propio servicio.
            'pregnancy_date' => $request->filled('pregnancy_date')
                ? $request->input('pregnancy_date')
                : ($status === AnimalService::STATUS_GESTATION ? $request->input('service_date') : null),
            'birth_date' => $request->filled('birth_date') ? $request->input('birth_date') : null,
            'total_piglets' => (int) ($request->input('total_piglets', 0)),
            'live_piglets' => (int) ($request->input('live_piglets', 0)),
            // Lechones vivos pendientes de formar un lote: se
            // PERSISTEN en BD para que la alerta del frontend
            // sobreviva a un refresco de página. Quedan en 0
            // cuando se crea el lote de lechones vinculado
            // (store, parámetro `from_service_ids`).
            'pending_piglets' => $status === AnimalService::STATUS_WEANED
                ? (int) ($request->input('live_piglets', 0))
                : null,
        ]);

        // Sincronizar el estado del animal según el evento registrado:
        // - Destete / parto: la cerda vuelve a "activo" (ya destetó
        //   a los lechones) y su contador de partos (parity_count)
        //   aumenta en uno.
        // - Cualquier otro servicio reproductivo (inseminación /
        //   monta): la cerda pasa a "gestación".
        if ($status === AnimalService::STATUS_WEANED) {
            $animal->status = LoteAnimal::STATUS_ACTIVE;
            $animal->parity_count = (int) $animal->parity_count + 1;
            $animal->save();
        } else {
            $animal->status = LoteAnimal::STATUS_GESTATION;
            $animal->save();
        }

        $service->load('animal');

        return response()->json([
            'status' => 'success',
            'message' => 'Servicio registrado correctamente.',
            'data' => $service,
        ], Response::HTTP_CREATED);
    }

    /**
     * Eliminar un registro de servicio.
     */
    public function destroyService($serviceId)
    {
        $service = AnimalService::with('animal')->find($serviceId);

        if (! $service) {
            return response()->json([
                'status' => 'error',
                'message' => 'Servicio no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $service->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Servicio eliminado correctamente.',
        ], Response::HTTP_OK);
    }
}
