<?php

namespace App\Http\Controllers;

use App\Models\Galpon;
use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class GalponController extends Controller
{

    private const PURPOSES_BY_CATEGORY = [
        'avícola'  => [
            'carne',
            'Carne',
            'CARNE',
            'huevos',
            'Huevos',
            'HUEVOS'
        ],
        'porcina'  => [
            'carne',
            'Carne',
            'CARNE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION'
        ],
        'cunícula' => [
            'carne',
            'Carne',
            'CARNE',
            'reproducción',
            'reproduccion',
            'Reproducción',
            'Reproduccion',
            'REPRODUCCIÓN',
            'REPRODUCCION'
        ],
        'bovina'   => [
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
            'LECHE'
        ],
        'ovina'    => [
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
            'LANA'
        ],
        'caprina'  => [
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
            'FIBRA'
        ],
    ];
    

    private function isPurposeAllowedForSpecies(string $purpose, Species $species): bool
    {
        $category = Species::canonicalCategory($species->category);
        $allowedPurposes = self::PURPOSES_BY_CATEGORY[$category] ?? [];

        return in_array($purpose, $allowedPurposes, true);
    }

    /**
     * Display a listing of galpones filtered strictly by the user's farm (or global if Root).
     */
    public function index(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $query = Galpon::query()->with([
            'farm:id,name,code',
            'species:id,name,category,is_active',
        ]);

        // Multi-farm isolation and safe sanitization of farm_id (handles "all" without SQL 22P02 error)
        if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
            $query->where('farm_id', (int) $request->farm_id);
        } elseif ($user->role !== 'root') {
            if (!$user->farm_id) {
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
            $term = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('purpose', 'like', $term)
                    ->orWhere('category', 'like', $term)
                    ->orWhere('sector', 'like', $term);
            });
        }

        $galpones = $query->orderBy('name', 'asc')->get();
        $stats = $this->computeGalponStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Lista de galpones obtenida con éxito.',
            'data' => $galpones,
            'stats' => $stats,
            'total_galpones' => $stats['total_galpones'],
            'active_galpones' => $stats['active_galpones'],
            'inactive_galpones' => $stats['inactive_galpones'],
            'total_capacity' => $stats['total_capacity'],
            'purposes_count' => $stats['purposes_count'],
            'species_count' => $stats['species_count'],
            'totalGalpones' => $stats['total_galpones'],
            'activeGalpones' => $stats['active_galpones'],
            'inactiveGalpones' => $stats['inactive_galpones'],
            'totalCapacity' => $stats['total_capacity'],
        ], Response::HTTP_OK);
    }

    /**
     * Return contextual summary statistics for galpones KPIs strictly filtered by farm_id.
     */
    public function stats(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->isRoot() && !$user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario sin granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $stats = $this->computeGalponStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de galpones obtenidas con éxito.',
            'total_galpones' => $stats['total_galpones'],
            'active_galpones' => $stats['active_galpones'],
            'inactive_galpones' => $stats['inactive_galpones'],
            'total_capacity' => $stats['total_capacity'],
            'purposes_count' => $stats['purposes_count'],
            'species_count' => $stats['species_count'],
            'totalGalpones' => $stats['total_galpones'],
            'activeGalpones' => $stats['active_galpones'],
            'inactiveGalpones' => $stats['inactive_galpones'],
            'totalCapacity' => $stats['total_capacity'],
            'data' => $stats,
        ], Response::HTTP_OK);
    }

    /**
     * Compute summary metrics for galpones strictly filtered by user farm scope.
     */
    protected function computeGalponStats(Request $request, $user): array
    {
        $baseQuery = Galpon::query();

        $hasSpecificFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';

        if ($hasSpecificFarm) {
            $baseQuery->where('farm_id', (int) $request->farm_id);
        } elseif ($user->role !== 'root') {
            if (!$user->farm_id) {
                return [
                    'total_galpones' => 0,
                    'active_galpones' => 0,
                    'inactive_galpones' => 0,
                    'total_capacity' => 0,
                    'purposes_count' => 0,
                    'species_count' => 0,
                    'totalGalpones' => 0,
                    'activeGalpones' => 0,
                    'inactiveGalpones' => 0,
                    'totalCapacity' => 0,
                    'farm_id' => null,
                ];
            }
            $baseQuery->where('farm_id', (int) $user->farm_id)->whereNotNull('farm_id');
        }

        $totalGalpones = (int) (clone $baseQuery)->count();
        $activeGalpones = (int) (clone $baseQuery)->where('is_active', true)->count();
        $inactiveGalpones = max(0, $totalGalpones - $activeGalpones);
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
            'total_galpones' => $totalGalpones,
            'active_galpones' => $activeGalpones,
            'inactive_galpones' => $inactiveGalpones,
            'total_capacity' => $totalCapacity,
            'purposes_count' => $purposesCount,
            'species_count' => $speciesCount,
            'totalGalpones' => $totalGalpones,
            'activeGalpones' => $activeGalpones,
            'inactiveGalpones' => $inactiveGalpones,
            'totalCapacity' => $totalCapacity,
            'farm_id' => $targetFarmId,
        ];
    }

    /**
     * Store a newly created galpón in storage.
     */
    public function store(Request $request)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (!$user) {
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
            'is_active' => 'nullable|boolean',
            'farm_id' => 'nullable|exists:farms,id',
        ], [
            'name.required' => 'El nombre del galpón es obligatorio.',
            'species_id.required' => 'La especie asociada es obligatoria.',
            'species_id.exists' => 'La especie seleccionada no existe en el sistema.',
            'purpose.required' => 'El propósito del galpón es obligatorio (ej: Engorde, Cría, Reproducción).',
            'max_capacity.required' => 'La capacidad máxima de animales es obligatoria.',
            'max_capacity.min' => 'La capacidad máxima debe ser de al menos 1 animal.',
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
            if (!$farmId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Debe especificar el ID de la granja (farm_id) para registrar el galpón.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        } else {
            $farmId = $user->farm_id;
        }

        // Strict cross-tenant & species integrity validation:
        // Must belong to the same farm and be active!
        $species = Species::find($request->species_id);

        if (!$species || (int) $species->farm_id !== (int) $farmId) {
            return response()->json([
                'status' => 'error',
                'message' => 'La especie seleccionada no pertenece a esta granja.',
                'errors' => [
                    'species_id' => ['La especie seleccionada no pertenece a esta granja.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (!$species->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'La especie seleccionada se encuentra inactiva.',
                'errors' => [
                    'species_id' => ['La especie seleccionada se encuentra inactiva.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (!$this->isPurposeAllowedForSpecies($request->purpose, $species)) {
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

        $galpon = Galpon::create([
            'farm_id' => (int) $farmId,
            'species_id' => $species->id,
            'name' => trim($request->name),
            'category' => $sector,
            'sector' => $sector,
            'purpose' => trim($request->purpose),
            'max_capacity' => (int) $request->max_capacity,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);

        $galpon->load(['farm:id,name,code', 'species:id,name,category,is_active']);

        return response()->json([
            'status' => 'success',
            'message' => 'Galpón registrado correctamente.',
            'data' => $galpon,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified galpón.
     */
    public function show($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $galpon = Galpon::withoutGlobalScopes()->with([
            'farm:id,name,code',
            'species:id,name,category,is_active',
            'lots',
        ])->find($id);

        if (!$galpon) {
            return response()->json([
                'status' => 'error',
                'message' => 'Galpón no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary check for non-root users
        if ($user && !$user->isRoot() && $galpon->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este galpón pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'data' => $galpon,
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified galpón in storage.
     */
    public function update(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $galpon = Galpon::withoutGlobalScopes()->find($id);

        if (!$galpon) {
            return response()->json([
                'status' => 'error',
                'message' => 'Galpón no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict boundary check
        if ($user && !$user->isRoot() && $galpon->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este galpón pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'species_id' => 'sometimes|required|integer|exists:species,id',
            'purpose' => 'sometimes|required|string|max:255',
            'max_capacity' => 'sometimes|required|integer|min:1',
            'is_active' => 'nullable|boolean',
        ], [
            'name.required' => 'El nombre del galpón es obligatorio.',
            'species_id.exists' => 'La especie seleccionada no existe en el sistema.',
            'purpose.required' => 'El propósito del galpón es obligatorio.',
            'max_capacity.min' => 'La capacidad máxima debe ser de al menos 1 animal.',
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

            if (!$species || (int) $species->farm_id !== (int) $galpon->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'La especie seleccionada no pertenece a esta granja.',
                    'errors' => [
                        'species_id' => ['La especie seleccionada no pertenece a esta granja.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if (!$species->is_active) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'La especie seleccionada se encuentra inactiva.',
                    'errors' => [
                        'species_id' => ['La especie seleccionada se encuentra inactiva.'],
                    ],
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $galpon->species_id = $species->id;
            $galpon->category = $species->category ?? 'General';
            $galpon->sector = $species->category ?? 'General';
        }

        if ($request->has('purpose')) {
            $purposeSpecies = $species ?? Species::find($galpon->species_id);

            if (!$purposeSpecies || !$this->isPurposeAllowedForSpecies($request->purpose, $purposeSpecies)) {
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
            $galpon->name = trim($request->name);
        }
        if ($request->has('purpose')) {
            $galpon->purpose = trim($request->purpose);
        }
        if ($request->has('max_capacity')) {
            $galpon->max_capacity = (int) $request->max_capacity;
        }
        if ($request->has('is_active')) {
            $galpon->is_active = (bool) $request->is_active;
        }

        $galpon->save();
        $galpon->load(['farm:id,name,code', 'species:id,name,category,is_active']);

        return response()->json([
            'status' => 'success',
            'message' => 'Galpón actualizado correctamente.',
            'data' => $galpon,
        ], Response::HTTP_OK);
    }

    /**
     * Toggle or update the active status of the galpón.
     */
    public function toggleStatus(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $galpon = Galpon::withoutGlobalScopes()->find($id);

        if (!$galpon) {
            return response()->json([
                'status' => 'error',
                'message' => 'Galpón no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && !$user->isRoot() && $galpon->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este galpón pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $newStatus = $request->has('is_active')
            ? (bool) $request->is_active
            : !$galpon->is_active;

        $galpon->is_active = $newStatus;
        $galpon->save();
        $galpon->load(['farm:id,name,code', 'species:id,name,category,is_active']);

        return response()->json([
            'status' => 'success',
            'message' => $newStatus ? 'Galpón habilitado correctamente.' : 'Galpón inhabilitado correctamente.',
            'data' => $galpon,
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified galpón from storage.
     */
    public function destroy($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $galpon = Galpon::withoutGlobalScopes()->find($id);

        if (!$galpon) {
            return response()->json([
                'status' => 'error',
                'message' => 'Galpón no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary: non-root users may only delete their own farm's galpones
        if ($user && !$user->isRoot() && $galpon->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Este galpón pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Integrity check: block deletion while operational records (lots, housed
        // animals, etc.) still depend on this barn
        if ($this->hasOperationalDependencies($galpon)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar el galpón porque tiene lotes o registros operativos asociados.',
                'errors' => [
                    'lotes' => ['No se puede eliminar el galpón porque tiene lotes o registros operativos asociados.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $galpon->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Galpón eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /**
     * Determine if the barn still has dependent operational records.
     *
     * Currently checks lodged lots (animales alojados en lotes). Extend here
     * when new operational entities (movements, animals, feeds) are linked
     * to barns so the deletion guard keeps protecting farm data.
     */
    protected function hasOperationalDependencies(Galpon $galpon): bool
    {
        if ($galpon->lots()->exists()) {
            return true;
        }

        return false;
    }
}
