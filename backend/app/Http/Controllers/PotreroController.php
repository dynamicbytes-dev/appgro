<?php

namespace App\Http\Controllers;

use App\Models\Lot;
use App\Models\PastureBiomassSurvey;
use App\Models\PastureTreatment;
use App\Models\Potrero;
use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class PotreroController extends Controller
{
    private const PURPOSES_BY_CATEGORY = [
        'avícola' => [
            'carne',
            'Carne',
            'CARNE',
            'huevos',
            'Huevos',
            'HUEVOS',
        ],
        'porcina' => [
            'carne',
            'Carne',
            'CARNE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION',
        ],
        'cunícola' => [
            'carne',
            'Carne',
            'CARNE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION',
        ],
        'bovina' => [
            'carne',
            'Carne',
            'CARNE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION',
            'leche',
            'Leche',
            'LECHE',
        ],
        'ovina' => [
            'carne',
            'Carne',
            'CARNE',
            'leche',
            'Leche',
            'LECHE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION',
            'lana',
            'Lana',
            'LANA',
        ],
        'caprina' => [
            'carne',
            'Carne',
            'CARNE',
            'leche',
            'Leche',
            'LECHE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION',
            'fibra',
            'Fibra',
            'FIBRA',
        ],
    ];

    /**
     * Sectores pecuarios habilitados para el módulo de Potreros.
     * Bovino, Ovino y Caprino. Las demás especies se gestionan en el
     * módulo "Galpones".
     */
    public const ALLOWED_POTRERO_CATEGORIES = ['bovina', 'ovina', 'caprina'];

    /**
     * Consumo diario de materia seca por animal (kg MS/animal/día).
     * Supuesto estándar (~2.5% del peso vivo de un bovino adulto) usado
     * para proyectar la fecha estimada de salida cuando no se dispone
     * de pesajes individuales por lote.
     */
    public const DM_INTAKE_PER_ANIMAL_KG = 10.0;

    private function isPurposeAllowedForSpecies(string $purpose, Species $species): bool
    {
        // Especies personalizadas (registradas con "Otro"): solo admiten el
        // propósito universal de carne, ya que no pertenecen a la taxonomía
        // oficial del sector.
        if ($species->is_custom) {
            return Species::normalizeKey($purpose) === 'carne';
        }

        $category = Species::canonicalCategory($species->category);
        $allowedPurposes = self::PURPOSES_BY_CATEGORY[$category] ?? [];

        return in_array($purpose, $allowedPurposes, true);
    }

    /**
     * Display a listing of potreros filtered strictly by the user's farm (or global if Root).
     */
    public function index(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = Potrero::query()->with([
            'farm:id,name,code',
            'species:id,name,category,is_active,is_custom',
        ]);

        // Multi-farm isolation and safe sanitization of farm_id (handles "all" without SQL 22P02 error)
        if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
            $query->where('farm_id', (int) $request->farm_id);
        } elseif ($user->role !== 'root') {
            if (! $user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }

            $query->where('farm_id', $user->farm_id)
                ->whereNotNull('farm_id');
        }

        // Filter by is_active status
        if ($request->has('is_active')) {
            $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isActive !== null) {
                $query->where('is_active', $isActive);
            }
        }

        // Filter by species_id
        if ($request->filled('species_id')) {
            $query->where('species_id', (int) $request->species_id);
        }

        // Filter by category or sector
        if ($request->filled('category')) {
            $query->where(function ($q) use ($request) {
                $q->where('category', $request->category)
                    ->orWhere('sector', $request->category);
            });
        }
        if ($request->filled('sector')) {
            $query->where(function ($q) use ($request) {
                $q->where('sector', $request->sector)
                    ->orWhere('category', $request->sector);
            });
        }

        // Filter by purpose
        if ($request->filled('purpose')) {
            $query->where('purpose', $request->purpose);
        }

        // Search text in name or purpose
        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('purpose', 'like', $term)
                    ->orWhere('category', 'like', $term)
                    ->orWhere('sector', 'like', $term);
            });
        }

        $potreros = $query->orderBy('name', 'asc')->get();

        // Ocupación/available por potrero: suma de la ocupación actual
        // de cada lote activo vinculado. Los lotes de potrero aún no
        // manejan seguimiento individual de animales, por lo que se
        // usa la cantidad declarada del lote (`quantity`).
        $activeLots = Lot::query()
            ->where('status', Lot::STATUS_ACTIVE)
            ->whereNotNull('potrero_id')
            ->when($user->role !== 'root' && $user->farm_id, function ($q) use ($user) {
                $q->where('farm_id', $user->farm_id);
            })
            ->get(['id', 'potrero_id', 'quantity']);

        Lot::loadCurrentOccupancy($activeLots);

        $occupiedByPotrero = [];
        foreach ($activeLots as $lot) {
            $potreroId = (int) $lot->potrero_id;
            $occupiedByPotrero[$potreroId] = ($occupiedByPotrero[$potreroId] ?? 0) + (int) $lot->current_occupancy;
        }

        $potreros->each(function ($potrero) use ($occupiedByPotrero) {
            $occupied = (int) ($occupiedByPotrero[$potrero->id] ?? 0);
            $potrero->occupied_capacity = $occupied;
            $potrero->available_capacity = max(0, (int) $potrero->max_capacity - $occupied);

            // Estado mostrado (híbrido): inactivo > ocupado (derivado) > manual.
            $potrero->operational_state = $potrero->displayStatus($occupied);

            // Carga agronómica: UA por hectárea (si hay superficie declarada).
            $surface = (float) ($potrero->superficie_ha ?? 0);
            $potrero->ua_per_ha = $surface > 0 && $potrero->capacidad_ua !== null
                ? round((float) $potrero->capacidad_ua / $surface, 2)
                : null;
        });

        $stats = $this->computePotreroStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Lista de potreros obtenida con éxito.',
            'data' => $potreros,
            'stats' => $stats,
            'total_potreros' => $stats['total_potreros'],
            'active_potreros' => $stats['active_potreros'],
            'inactive_potreros' => $stats['inactive_potreros'],
            'total_capacity' => $stats['total_capacity'],
            'purposes_count' => $stats['purposes_count'],
            'species_count' => $stats['species_count'],
            'totalPotreros' => $stats['total_potreros'],
            'activePotreros' => $stats['active_potreros'],
            'inactivePotreros' => $stats['inactive_potreros'],
            'totalCapacity' => $stats['total_capacity'],
        ], Response::HTTP_OK);
    }

    /**
     * Return contextual summary statistics for potreros KPIs strictly filtered by farm_id.
     */
    public function stats(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

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

        $stats = $this->computePotreroStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de potreros obtenidas con éxito.',
            'total_potreros' => $stats['total_potreros'],
            'active_potreros' => $stats['active_potreros'],
            'inactive_potreros' => $stats['inactive_potreros'],
            'total_capacity' => $stats['total_capacity'],
            'purposes_count' => $stats['purposes_count'],
            'species_count' => $stats['species_count'],
            'totalPotreros' => $stats['total_potreros'],
            'activePotreros' => $stats['active_potreros'],
            'inactivePotreros' => $stats['inactive_potreros'],
            'totalCapacity' => $stats['total_capacity'],
            'data' => $stats,
        ], Response::HTTP_OK);
    }

    /**
     * Compute summary metrics for potreros strictly filtered by user farm scope.
     */
    protected function computePotreroStats(Request $request, $user): array
    {
        $baseQuery = Potrero::query();

        $hasSpecificFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';

        if ($hasSpecificFarm) {
            $baseQuery->where('farm_id', (int) $request->farm_id);
        } elseif ($user->role !== 'root') {
            if (! $user->farm_id) {
                return [
                    'total_potreros' => 0,
                    'active_potreros' => 0,
                    'inactive_potreros' => 0,
                    'total_capacity' => 0,
                    'purposes_count' => 0,
                    'species_count' => 0,
                    'totalPotreros' => 0,
                    'activePotreros' => 0,
                    'inactivePotreros' => 0,
                    'totalCapacity' => 0,
                    'farm_id' => null,
                ];
            }
            $baseQuery->where('farm_id', (int) $user->farm_id)->whereNotNull('farm_id');
        }

        $totalPotreros = (int) (clone $baseQuery)->count();
        $activePotreros = (int) (clone $baseQuery)->where('is_active', true)->count();
        $inactivePotreros = max(0, $totalPotreros - $activePotreros);
        $totalCapacity = (int) (clone $baseQuery)->sum('max_capacity');

        $purposesCount = (int) (clone $baseQuery)
            ->whereNotNull('purpose')
            ->where('purpose', '!=', '')
            ->distinct()
            ->count('purpose');

        $speciesCount = (int) (clone $baseQuery)
            ->whereNotNull('species_id')
            ->distinct()
            ->count('species_id');

        $targetFarmId = $user->role === 'root'
            ? ($hasSpecificFarm ? (int) $request->farm_id : null)
            : (int) $user->farm_id;

        return [
            'total_potreros' => $totalPotreros,
            'active_potreros' => $activePotreros,
            'inactive_potreros' => $inactivePotreros,
            'total_capacity' => $totalCapacity,
            'purposes_count' => $purposesCount,
            'species_count' => $speciesCount,
            'totalPotreros' => $totalPotreros,
            'activePotreros' => $activePotreros,
            'inactivePotreros' => $inactivePotreros,
            'totalCapacity' => $totalCapacity,
            'farm_id' => $targetFarmId,
        ];
    }

    /**
     * Store a newly created potrero in storage.
     */
    public function store(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'species_id' => 'required|integer|exists:species,id',
            'purpose' => 'required|string|max:255',
            'max_capacity' => 'required|integer|min:1',
            'code' => 'nullable|string|max:50',
            'superficie_ha' => 'nullable|numeric|min:0|max:99999999.99',
            'capacidad_ua' => 'nullable|numeric|min:0|max:99999999.99',
            'operational_status' => ['nullable', Rule::in(Potrero::OPERATIONAL_STATUSES)],
            'tipo_pastura' => 'nullable|string|max:255',
            'topografia' => ['nullable', Rule::in(Potrero::TOPOGRAFIAS)],
            'tipo_cercado' => 'nullable|string|max:255',
            'fuente_agua' => 'nullable|array',
            'fuente_agua.*' => 'string|max:100',
            'geometry' => 'nullable|array',
            'centroid_lat' => 'nullable|numeric|between:-90,90',
            'centroid_lng' => 'nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:2000',
            'is_active' => 'nullable|boolean',
            'farm_id' => 'nullable|exists:farms,id',
        ], [
            'name.required' => 'El nombre del potrero es obligatorio.',
            'species_id.required' => 'La especie asociada es obligatoria.',
            'species_id.exists' => 'La especie seleccionada no existe en el sistema.',
            'purpose.required' => 'El propósito del potrero es obligatorio (ej: Engorde, Cría, Reproducción).',
            'max_capacity.required' => 'La capacidad máxima de animales es obligatoria.',
            'max_capacity.min' => 'La capacidad máxima debe ser de al menos 1 animal.',
            'superficie_ha.numeric' => 'La superficie debe ser un número de hectáreas.',
            'capacidad_ua.numeric' => 'La capacidad UA debe ser un valor numérico.',
            'operational_status.in' => 'El estado operativo debe ser: disponible, descanso o mantenimiento.',
            'topografia.in' => 'La topografía debe ser: plano, ondulado o quebrado.',
            'farm_id.exists' => 'La granja especificada no existe.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Resolve target farm_id
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');
            if (! $farmId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Debe especificar el ID de la granja (farm_id) para registrar el potrero.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        } else {
            $farmId = $user->farm_id;
        }

        // Strict cross-tenant & species integrity validation:
        // Must belong to the same farm and be active!
        $species = Species::find($request->species_id);

        if (! $species || (int) $species->farm_id !== (int) $farmId) {
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

        if (! in_array(Species::canonicalCategory($species->category), self::ALLOWED_POTRERO_CATEGORIES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'El módulo de Potreros solo admite especies de los sectores Bovino, Ovino y Caprino.',
                'errors' => [
                    'species_id' => ['El módulo de Potreros solo admite especies de los sectores Bovino, Ovino y Caprino. Las demás se gestionan en el módulo Galpones.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $this->isPurposeAllowedForSpecies($request->purpose, $species)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => [
                    'purpose' => ['El propósito seleccionado no es válido para el sector de la especie.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Inherit sector/category from selected species
        $sector = $species->category ?? 'General';

        // Código interno único por granja: se acepta el provisto o se autogenera.
        $code = trim((string) $request->input('code', ''));
        if ($code === '') {
            $code = $this->generateUniqueCode((int) $farmId);
        } elseif (Potrero::withoutGlobalScopes()->where('farm_id', (int) $farmId)->where('code', $code)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => [
                    'code' => ['Ya existe un potrero con ese código en esta granja.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Georreferenciación: normaliza el GeoJSON y calcula la superficie.
        [$geometry, $geometryError] = $request->has('geometry')
            ? $this->normalizeGeometry($request->input('geometry'))
            : [null, null];

        if ($geometryError) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => [
                    'geometry' => [$geometryError],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $potrero = Potrero::create([
            'farm_id' => (int) $farmId,
            'species_id' => $species->id,
            'name' => trim($request->name),
            'code' => $code,
            'category' => $sector,
            'sector' => $sector,
            'purpose' => trim($request->purpose),
            'max_capacity' => (int) $request->max_capacity,
            'superficie_ha' => $request->filled('superficie_ha') ? (float) $request->superficie_ha : null,
            'capacidad_ua' => $request->filled('capacidad_ua') ? (float) $request->capacidad_ua : null,
            'operational_status' => $request->filled('operational_status') ? $request->operational_status : 'disponible',
            'tipo_pastura' => $request->filled('tipo_pastura') ? trim((string) $request->tipo_pastura) : null,
            'topografia' => $request->filled('topografia') ? $request->topografia : null,
            'tipo_cercado' => $request->filled('tipo_cercado') ? trim((string) $request->tipo_cercado) : null,
            'fuente_agua' => $this->normalizeFuenteAgua($request->input('fuente_agua')),
            'geometry' => $geometry,
            'geo_area_ha' => $this->computeGeometryAreaHa($geometry),
            'centroid_lat' => $request->filled('centroid_lat') ? (float) $request->centroid_lat : null,
            'centroid_lng' => $request->filled('centroid_lng') ? (float) $request->centroid_lng : null,
            'notes' => $request->filled('notes') ? trim((string) $request->notes) : null,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);

        $potrero->load(['farm:id,name,code', 'species:id,name,category,is_active,is_custom']);

        return response()->json([
            'status' => 'success',
            'message' => 'Potrero registrado correctamente.',
            'data' => $potrero,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified potrero.
     */
    public function show($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $potrero = Potrero::withoutGlobalScopes()->with([
            'farm:id,name,code',
            'species:id,name,category,is_active,is_custom',
        ])->find($id);

        if (! $potrero) {
            return response()->json([
                'status' => 'error',
                'message' => 'Potrero no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary check for non-root users
        if ($user && ! $user->isRoot() && $potrero->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este potrero pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'data' => $potrero,
        ], Response::HTTP_OK);
    }

    /**
     * FeatureCollection GeoJSON con todos los potreros del alcance del usuario.
     * Cada feature incluye su geometría (si existe) y propiedades derivadas
     * (estado operativo, ocupación, superficie, etc.) para el croquis del mapa.
     */
    public function geojson(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = Potrero::query()->with(['species:id,name,category,is_custom']);

        if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
            $query->where('farm_id', (int) $request->farm_id);
        } elseif ($user->role !== 'root') {
            if (! $user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }

            $query->where('farm_id', $user->farm_id)->whereNotNull('farm_id');
        }

        $potreros = $query->orderBy('name', 'asc')->get();

        $activeLots = Lot::query()
            ->where('status', Lot::STATUS_ACTIVE)
            ->whereNotNull('potrero_id')
            ->when($user->role !== 'root' && $user->farm_id, function ($q) use ($user) {
                $q->where('farm_id', $user->farm_id);
            })
            ->get(['id', 'potrero_id', 'quantity']);

        Lot::loadCurrentOccupancy($activeLots);

        $occupiedByPotrero = [];
        foreach ($activeLots as $lot) {
            $potreroId = (int) $lot->potrero_id;
            $occupiedByPotrero[$potreroId] = ($occupiedByPotrero[$potreroId] ?? 0) + (int) $lot->current_occupancy;
        }

        $features = $potreros->map(function ($potrero) use ($occupiedByPotrero) {
            $occupied = (int) ($occupiedByPotrero[$potrero->id] ?? 0);

            return [
                'type' => 'Feature',
                'geometry' => $potrero->geometry,
                'properties' => [
                    'id' => $potrero->id,
                    'code' => $potrero->code,
                    'name' => $potrero->name,
                    'category' => $potrero->category,
                    'sector' => $potrero->sector,
                    'purpose' => $potrero->purpose,
                    'species' => $potrero->species?->name,
                    'is_custom' => (bool) ($potrero->species?->is_custom),
                    'is_active' => (bool) $potrero->is_active,
                    'operational_state' => $potrero->displayStatus($occupied),
                    'max_capacity' => (int) $potrero->max_capacity,
                    'occupied_capacity' => $occupied,
                    'available_capacity' => max(0, (int) $potrero->max_capacity - $occupied),
                    'superficie_ha' => $potrero->superficie_ha !== null ? (float) $potrero->superficie_ha : null,
                    'capacidad_ua' => $potrero->capacidad_ua !== null ? (float) $potrero->capacidad_ua : null,
                    'geo_area_ha' => $potrero->geo_area_ha !== null ? (float) $potrero->geo_area_ha : null,
                    'centroid_lat' => $potrero->centroid_lat !== null ? (float) $potrero->centroid_lat : null,
                    'centroid_lng' => $potrero->centroid_lng !== null ? (float) $potrero->centroid_lng : null,
                ],
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Capa GeoJSON de potreros obtenida con éxito.',
            'data' => [
                'type' => 'FeatureCollection',
                'features' => $features,
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Ficha de manejo del potrero (Fase 2): métricas derivadas de rotación
     * (días de ocupación, descanso y salida estimada), forraje disponible e
     * historial de tratamientos y aforos.
     */
    public function management($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $potrero = Potrero::withoutGlobalScopes()->with([
            'farm:id,name,code',
            'species:id,name,category,is_active,is_custom',
        ])->find($id);

        if (! $potrero) {
            return response()->json([
                'status' => 'error',
                'message' => 'Potrero no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $user->isRoot() && (int) $potrero->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este potrero pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $today = Carbon::now()->startOfDay();

        // Lotes activos que hoy ocupan el potrero.
        $activeLots = Lot::query()
            ->where('potrero_id', $potrero->id)
            ->where('status', Lot::STATUS_ACTIVE)
            ->orderBy('entry_date')
            ->get(['id', 'code', 'quantity', 'entry_date']);

        Lot::loadCurrentOccupancy($activeLots);

        $occupied = (int) $activeLots->sum(
            fn ($lot) => (int) ($lot->current_occupancy ?? $lot->quantity)
        );

        // Días de ocupación: desde el ingreso más antiguo de los lotes activos.
        $firstEntry = $activeLots
            ->filter(fn ($lot) => $lot->entry_date !== null)
            ->min('entry_date');

        $daysOccupied = $firstEntry
            ? (int) Carbon::parse($firstEntry)->startOfDay()->diffInDays($today)
            : null;

        // Último descanso: salida del lote más reciente ya finalizado.
        $lastFinished = Lot::query()
            ->where('potrero_id', $potrero->id)
            ->where('status', '!=', Lot::STATUS_ACTIVE)
            ->orderByDesc('harvest_date')
            ->orderByDesc('updated_at')
            ->first(['id', 'harvest_date', 'updated_at']);

        $lastRestDate = null;
        if ($lastFinished) {
            $lastRestDate = $lastFinished->harvest_date
                ? Carbon::parse($lastFinished->harvest_date)->toDateString()
                : optional($lastFinished->updated_at)->toDateString();
        }

        $daysResting = null;
        if ($activeLots->isEmpty() && $lastRestDate) {
            $daysResting = (int) Carbon::parse($lastRestDate)->startOfDay()->diffInDays($today);
        }

        // Aforo más reciente y forraje disponible (si hay superficie declarada).
        $latestSurvey = PastureBiomassSurvey::query()
            ->where('potrero_id', $potrero->id)
            ->orderByDesc('surveyed_at')
            ->orderByDesc('id')
            ->first();

        $surface = (float) ($potrero->superficie_ha ?? 0);
        $forageAvailable = null;
        if ($latestSurvey && $latestSurvey->biomass_kg_dm_ha !== null && $surface > 0) {
            $forageAvailable = round((float) $latestSurvey->biomass_kg_dm_ha * $surface, 2);
        }

        // Demanda diaria y fecha estimada de salida.
        $dailyDemand = $occupied > 0
            ? round($occupied * self::DM_INTAKE_PER_ANIMAL_KG, 2)
            : null;

        $estimatedExitDate = null;
        if ($forageAvailable !== null && $dailyDemand && $dailyDemand > 0) {
            $remainingDays = (int) floor($forageAvailable / $dailyDemand);
            $estimatedExitDate = $today->copy()->addDays($remainingDays)->toDateString();
        }

        $treatments = PastureTreatment::query()
            ->where('potrero_id', $potrero->id)
            ->orderByDesc('applied_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $biomassSurveys = PastureBiomassSurvey::query()
            ->where('potrero_id', $potrero->id)
            ->orderByDesc('surveyed_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        // Fase 3: historial de rotaciones (lotes que ocuparon el potrero).
        $rotationHistory = Lot::query()
            ->where('potrero_id', $potrero->id)
            ->with('species:id,name')
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->limit(100)
            ->get(['id', 'code', 'quantity', 'status', 'purpose', 'entry_date', 'harvest_date', 'updated_at', 'species_id']);

        $rotationHistory = $rotationHistory->map(function ($lot) use ($today) {
            $entry = $lot->entry_date ? Carbon::parse($lot->entry_date)->startOfDay() : null;
            $isActive = $lot->status === Lot::STATUS_ACTIVE;

            // Salida: cosecha si existe; si no y el lote cerró, la última actualización.
            $exitRaw = $lot->harvest_date ?: (! $isActive ? $lot->updated_at : null);
            $exit = $exitRaw ? Carbon::parse($exitRaw)->startOfDay() : null;

            return [
                'id' => $lot->id,
                'code' => $lot->code,
                'species' => $lot->species?->name,
                'purpose' => $lot->purpose,
                'quantity' => (int) $lot->quantity,
                'status' => $lot->status,
                'entry_date' => $entry?->toDateString(),
                'exit_date' => $exit?->toDateString(),
                'days_occupied' => $entry ? (int) $entry->diffInDays($exit ?? $today) : null,
            ];
        })->values();

        $rotationCount = Lot::query()->where('potrero_id', $potrero->id)->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'potrero' => $potrero,
                'occupied_capacity' => $occupied,
                'available_capacity' => max(0, (int) $potrero->max_capacity - $occupied),
                'operational_state' => $potrero->displayStatus($occupied),
                'ua_per_ha' => $surface > 0 && $potrero->capacidad_ua !== null
                    ? round((float) $potrero->capacidad_ua / $surface, 2)
                    : null,
                'active_lots' => $activeLots->map(fn ($lot) => [
                    'id' => $lot->id,
                    'code' => $lot->code,
                    'quantity' => (int) $lot->quantity,
                    'current_occupancy' => (int) ($lot->current_occupancy ?? $lot->quantity),
                    'entry_date' => $lot->entry_date ? Carbon::parse($lot->entry_date)->toDateString() : null,
                ])->values(),
                'days_occupied' => $daysOccupied,
                'last_rest_date' => $lastRestDate,
                'days_resting' => $daysResting,
                'latest_biomass_kg_dm_ha' => $latestSurvey?->biomass_kg_dm_ha !== null
                    ? (float) $latestSurvey->biomass_kg_dm_ha
                    : null,
                'forage_available_kg_dm' => $forageAvailable,
                'daily_demand_kg_dm' => $dailyDemand,
                'estimated_exit_date' => $estimatedExitDate,
                'treatments' => $treatments,
                'biomass_surveys' => $biomassSurveys,
                'rotation_history' => $rotationHistory,
                'rotation_count' => $rotationCount,
            ],
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified potrero in storage.
     */
    public function update(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $potrero = Potrero::withoutGlobalScopes()->find($id);

        if (! $potrero) {
            return response()->json([
                'status' => 'error',
                'message' => 'Potrero no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict boundary check
        if ($user && ! $user->isRoot() && $potrero->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este potrero pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'species_id' => 'sometimes|required|integer|exists:species,id',
            'purpose' => 'sometimes|required|string|max:255',
            'max_capacity' => 'sometimes|required|integer|min:1',
            'code' => 'sometimes|nullable|string|max:50',
            'superficie_ha' => 'nullable|numeric|min:0|max:99999999.99',
            'capacidad_ua' => 'nullable|numeric|min:0|max:99999999.99',
            'operational_status' => ['nullable', Rule::in(Potrero::OPERATIONAL_STATUSES)],
            'tipo_pastura' => 'nullable|string|max:255',
            'topografia' => ['nullable', Rule::in(Potrero::TOPOGRAFIAS)],
            'tipo_cercado' => 'nullable|string|max:255',
            'fuente_agua' => 'nullable|array',
            'fuente_agua.*' => 'string|max:100',
            'geometry' => 'nullable|array',
            'centroid_lat' => 'nullable|numeric|between:-90,90',
            'centroid_lng' => 'nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:2000',
            'is_active' => 'nullable|boolean',
        ], [
            'name.required' => 'El nombre del potrero es obligatorio.',
            'species_id.exists' => 'La especie seleccionada no existe en el sistema.',
            'purpose.required' => 'El propósito del potrero es obligatorio.',
            'max_capacity.min' => 'La capacidad máxima debe ser de al menos 1 animal.',
            'superficie_ha.numeric' => 'La superficie debe ser un número de hectáreas.',
            'capacidad_ua.numeric' => 'La capacidad UA debe ser un valor numérico.',
            'operational_status.in' => 'El estado operativo debe ser: disponible, descanso o mantenimiento.',
            'topografia.in' => 'La topografía debe ser: plano, ondulado o quebrado.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // If species_id is updated, validate within same farm and active
        $species = null;
        if ($request->has('species_id')) {
            $species = Species::find($request->species_id);

            if (! $species || (int) $species->farm_id !== (int) $potrero->farm_id) {
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

            if ((int) $species->id !== (int) $potrero->species_id
                && ! in_array(Species::canonicalCategory($species->category), self::ALLOWED_POTRERO_CATEGORIES, true)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El módulo de Potreros solo admite especies de los sectores Bovino, Ovino y Caprino.',
                    'errors' => [
                        'species_id' => ['El módulo de Potreros solo admite especies de los sectores Bovino, Ovino y Caprino. Las demás se gestionan en el módulo Galpones.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $potrero->species_id = $species->id;
            $potrero->category = $species->category ?? 'General';
            $potrero->sector = $species->category ?? 'General';
        }

        if ($request->has('purpose')) {
            $purposeSpecies = $species ?? Species::find($potrero->species_id);

            if (! $purposeSpecies || ! $this->isPurposeAllowedForSpecies($request->purpose, $purposeSpecies)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Error de validación de datos.',
                    'errors' => [
                        'purpose' => ['El propósito seleccionado no es válido para el sector de la especie.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if ($request->has('name')) {
            $potrero->name = trim($request->name);
        }
        if ($request->has('purpose')) {
            $potrero->purpose = trim($request->purpose);
        }
        if ($request->has('max_capacity')) {
            $potrero->max_capacity = (int) $request->max_capacity;
        }

        // Código interno: solo se actualiza si viene con valor; único por granja.
        if ($request->has('code')) {
            $newCode = trim((string) $request->input('code', ''));

            if ($newCode !== '' && $newCode !== $potrero->code) {
                $codeTaken = Potrero::withoutGlobalScopes()
                    ->where('farm_id', $potrero->farm_id)
                    ->where('code', $newCode)
                    ->where('id', '!=', $potrero->id)
                    ->exists();

                if ($codeTaken) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Error de validación de datos.',
                        'errors' => [
                            'code' => ['Ya existe un potrero con ese código en esta granja.'],
                        ],
                    ], Response::HTTP_UNPROCESSABLE_ENTITY);
                }

                $potrero->code = $newCode;
            }
        }

        if ($request->has('superficie_ha')) {
            $potrero->superficie_ha = $request->filled('superficie_ha') ? (float) $request->superficie_ha : null;
        }
        if ($request->has('capacidad_ua')) {
            $potrero->capacidad_ua = $request->filled('capacidad_ua') ? (float) $request->capacidad_ua : null;
        }
        if ($request->filled('operational_status')) {
            $potrero->operational_status = $request->operational_status;
        }
        if ($request->has('tipo_pastura')) {
            $potrero->tipo_pastura = $request->filled('tipo_pastura') ? trim((string) $request->tipo_pastura) : null;
        }
        if ($request->has('topografia')) {
            $potrero->topografia = $request->filled('topografia') ? $request->topografia : null;
        }
        if ($request->has('tipo_cercado')) {
            $potrero->tipo_cercado = $request->filled('tipo_cercado') ? trim((string) $request->tipo_cercado) : null;
        }
        if ($request->has('fuente_agua')) {
            $potrero->fuente_agua = $this->normalizeFuenteAgua($request->input('fuente_agua'));
        }
        if ($request->has('notes')) {
            $potrero->notes = $request->filled('notes') ? trim((string) $request->notes) : null;
        }

        // Georreferenciación: normaliza el GeoJSON y recalcula la superficie.
        if ($request->has('geometry')) {
            [$geometry, $geometryError] = $this->normalizeGeometry($request->input('geometry'));

            if ($geometryError) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Error de validación de datos.',
                    'errors' => [
                        'geometry' => [$geometryError],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $potrero->geometry = $geometry;
            $potrero->geo_area_ha = $this->computeGeometryAreaHa($geometry);
        }
        if ($request->has('centroid_lat')) {
            $potrero->centroid_lat = $request->filled('centroid_lat') ? (float) $request->centroid_lat : null;
        }
        if ($request->has('centroid_lng')) {
            $potrero->centroid_lng = $request->filled('centroid_lng') ? (float) $request->centroid_lng : null;
        }
        if ($request->has('is_active')) {
            $potrero->is_active = (bool) $request->is_active;
        }

        $potrero->save();
        $potrero->load(['farm:id,name,code', 'species:id,name,category,is_active,is_custom']);

        return response()->json([
            'status' => 'success',
            'message' => 'Potrero actualizado correctamente.',
            'data' => $potrero,
        ], Response::HTTP_OK);
    }

    /**
     * Toggle or update the active status of the potrero.
     */
    public function toggleStatus(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $potrero = Potrero::withoutGlobalScopes()->find($id);

        if (! $potrero) {
            return response()->json([
                'status' => 'error',
                'message' => 'Potrero no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && $potrero->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este potrero pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $newStatus = $request->has('is_active')
            ? (bool) $request->is_active
            : ! $potrero->is_active;

        $potrero->is_active = $newStatus;
        $potrero->save();
        $potrero->load(['farm:id,name,code', 'species:id,name,category,is_active,is_custom']);

        return response()->json([
            'status' => 'success',
            'message' => $newStatus ? 'Potrero habilitado correctamente.' : 'Potrero inhabilitado correctamente.',
            'data' => $potrero,
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified potrero from storage.
     */
    public function destroy($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $potrero = Potrero::withoutGlobalScopes()->find($id);

        if (! $potrero) {
            return response()->json([
                'status' => 'error',
                'message' => 'Potrero no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary: non-root users may only delete their own farm's potreros
        if ($user && ! $user->isRoot() && $potrero->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este potrero pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Integrity check: block deletion while operational records still
        // depend on this potrero. Extend here when new operational entities
        // are linked to potreros.
        if ($this->hasOperationalDependencies($potrero)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar el potrero porque tiene registros operativos asociados.',
                'errors' => [
                    'potrero' => ['No se puede eliminar el potrero porque tiene registros operativos asociados.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $potrero->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Potrero eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /**
     * Determine if the potrero still has dependent operational records.
     *
     * Un potrero no puede eliminarse mientras tenga lotes (activos o
     * históricos) asociados: los lotes son la entidad operativa que
     * depende de él.
     */
    protected function hasOperationalDependencies(Potrero $potrero): bool
    {
        if (Lot::query()->where('potrero_id', $potrero->id)->exists()) {
            return true;
        }

        if (PastureTreatment::query()->where('potrero_id', $potrero->id)->exists()) {
            return true;
        }

        return PastureBiomassSurvey::query()->where('potrero_id', $potrero->id)->exists();
    }

    /**
     * Genera el siguiente código interno disponible para la granja (POT-0001).
     */
    protected function generateUniqueCode(int $farmId): string
    {
        $prefix = 'POT-';
        $max = 0;

        $codes = Potrero::withoutGlobalScopes()
            ->where('farm_id', $farmId)
            ->where('code', 'LIKE', $prefix.'%')
            ->pluck('code');

        foreach ($codes as $code) {
            if (preg_match('/^POT-(\d+)$/', (string) $code, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return $prefix.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * Normaliza las fuentes de agua: arreglo de textos únicos y no vacíos.
     */
    protected function normalizeFuenteAgua($value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $sources = collect($value)
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $sources === [] ? null : $sources;
    }

    /**
     * Valida y normaliza una geometría GeoJSON (Polygon/MultiPolygon).
     * Cierra los anillos automáticamente.
     *
     * @return array{0: ?array, 1: ?string} [geometría normalizada, error]
     */
    protected function normalizeGeometry($value): array
    {
        if ($value === null) {
            return [null, null];
        }

        if (! is_array($value)) {
            return [null, 'La geometría debe ser un objeto GeoJSON.'];
        }

        $type = $value['type'] ?? null;
        if (! in_array($type, ['Polygon', 'MultiPolygon'], true)) {
            return [null, 'El tipo de geometría debe ser Polygon o MultiPolygon.'];
        }

        $coordinates = $value['coordinates'] ?? null;
        if (! is_array($coordinates) || $coordinates === []) {
            return [null, 'Las coordenadas de la geometría son obligatorias.'];
        }

        if ($type === 'Polygon') {
            $rings = [];
            foreach ($coordinates as $ring) {
                $normalized = $this->normalizeRing($ring);
                if ($normalized === null) {
                    return [null, 'Cada anillo del polígono debe tener al menos 3 puntos válidos [lng, lat].'];
                }
                $rings[] = $normalized;
            }

            return [['type' => 'Polygon', 'coordinates' => $rings], null];
        }

        $polygons = [];
        foreach ($coordinates as $polygon) {
            if (! is_array($polygon) || $polygon === []) {
                return [null, 'Cada polígono del MultiPolygon debe tener anillos.'];
            }

            $rings = [];
            foreach ($polygon as $ring) {
                $normalized = $this->normalizeRing($ring);
                if ($normalized === null) {
                    return [null, 'Cada anillo del polígono debe tener al menos 3 puntos válidos [lng, lat].'];
                }
                $rings[] = $normalized;
            }
            $polygons[] = $rings;
        }

        return [['type' => 'MultiPolygon', 'coordinates' => $polygons], null];
    }

    /**
     * Normaliza un anillo: valida puntos [lng, lat] y cierra el anillo.
     */
    protected function normalizeRing($ring): ?array
    {
        if (! is_array($ring) || count($ring) < 3) {
            return null;
        }

        $points = [];
        foreach ($ring as $point) {
            if (! is_array($point) || count($point) < 2) {
                return null;
            }

            $lng = $point[0] ?? null;
            $lat = $point[1] ?? null;

            if (! is_numeric($lng) || ! is_numeric($lat)) {
                return null;
            }

            $lng = (float) $lng;
            $lat = (float) $lat;

            if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
                return null;
            }

            $points[] = [round($lng, 7), round($lat, 7)];
        }

        $first = $points[0];
        $last = $points[count($points) - 1];
        if ($first[0] !== $last[0] || $first[1] !== $last[1]) {
            $points[] = $first;
        }

        return count($points) >= 4 ? $points : null;
    }

    /**
     * Superficie (ha) aproximada de una geometría GeoJSON. Se usa una
     * proyección equirectangular local (suficiente para lotes pequeños).
     */
    protected function computeGeometryAreaHa(?array $geometry): ?float
    {
        if (! $geometry || ! isset($geometry['type'], $geometry['coordinates'])) {
            return null;
        }

        $total = 0.0;

        if ($geometry['type'] === 'Polygon') {
            $total = $this->polygonAreaHa($geometry['coordinates']);
        } elseif ($geometry['type'] === 'MultiPolygon') {
            foreach ($geometry['coordinates'] as $polygon) {
                $total += $this->polygonAreaHa($polygon);
            }
        }

        return round($total, 4);
    }

    /**
     * Área de un polígono (anillo exterior menos huecos) en hectáreas.
     */
    protected function polygonAreaHa(array $rings): float
    {
        if ($rings === []) {
            return 0.0;
        }

        $area = $this->ringAreaHa($rings[0]);

        for ($i = 1; $i < count($rings); $i++) {
            $area -= $this->ringAreaHa($rings[$i]);
        }

        return max(0.0, $area);
    }

    /**
     * Área de un anillo en hectáreas (fórmula del área de Gauss).
     */
    protected function ringAreaHa(array $ring): float
    {
        $n = count($ring);
        if ($n < 4) {
            return 0.0;
        }

        $latSum = 0.0;
        foreach ($ring as $point) {
            $latSum += (float) $point[1];
        }
        $meanLat = $latSum / $n;

        $metersPerDegreeLat = 110574.0;
        $metersPerDegreeLng = 111320.0 * cos(deg2rad($meanLat));

        $area = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $x1 = (float) $ring[$i][0] * $metersPerDegreeLng;
            $y1 = (float) $ring[$i][1] * $metersPerDegreeLat;
            $j = ($i + 1) % $n;
            $x2 = (float) $ring[$j][0] * $metersPerDegreeLng;
            $y2 = (float) $ring[$j][1] * $metersPerDegreeLat;
            $area += ($x1 * $y2) - ($x2 * $y1);
        }

        return abs($area) / 2.0 / 10000.0;
    }
}
