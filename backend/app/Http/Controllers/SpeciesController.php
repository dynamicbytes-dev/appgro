<?php

namespace App\Http\Controllers;

use App\Models\Galpon;
use App\Models\Potrero;
use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class SpeciesController extends Controller
{
    /**
     * Display a listing of species filtered strictly by the user's farm (or global if Root).
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

        $query = Species::query()->with('farm:id,name,code');

        // Scope resolution: Root can see all (or filter by farm_id unless "all"); non-root strictly scoped to own farm
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

        // Filter by category
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        // Search by name or category
        if ($request->filled('search')) {
            $term = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('category', 'like', $term);
            });
        }

        $species = $query->orderBy('name', 'asc')->get();
        $stats = $this->computeSpeciesStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Lista de especies obtenida con éxito.',
            'data' => $species,
            'stats' => $stats,
            'total_species' => $stats['total_species'],
            'active_species' => $stats['active_species'],
            'inactive_species' => $stats['inactive_species'],
            'categories_count' => $stats['categories_count'],
            'totalSpecies' => $stats['total_species'],
            'activeSpecies' => $stats['active_species'],
            'inactiveSpecies' => $stats['inactive_species'],
            'categoriesCount' => $stats['categories_count'],
        ], Response::HTTP_OK);
    }

    /**
     * Return contextual summary statistics for species KPIs strictly filtered by farm_id.
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

        $stats = $this->computeSpeciesStats($request, $user);

        return response()->json([
            'status' => 'success',
            'message' => 'Estadísticas de especies obtenidas con éxito.',
            'total_species' => $stats['total_species'],
            'active_species' => $stats['active_species'],
            'inactive_species' => $stats['inactive_species'],
            'categories_count' => $stats['categories_count'],
            'totalSpecies' => $stats['total_species'],
            'activeSpecies' => $stats['active_species'],
            'inactiveSpecies' => $stats['inactive_species'],
            'categoriesCount' => $stats['categories_count'],
            'data' => $stats,
        ], Response::HTTP_OK);
    }

    /**
     * Compute summary metrics for species strictly filtered by user farm scope.
     */
    protected function computeSpeciesStats(Request $request, $user): array
    {
        $baseQuery = Species::query();

        if ($user->isRoot()) {
            if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $baseQuery->where('farm_id', (int) $request->farm_id);
            }
        } else {
            if (!$user->farm_id) {
                return [
                    'total_species' => 0,
                    'active_species' => 0,
                    'inactive_species' => 0,
                    'categories_count' => 0,
                    'totalSpecies' => 0,
                    'activeSpecies' => 0,
                    'inactiveSpecies' => 0,
                    'categoriesCount' => 0,
                    'farm_id' => null,
                ];
            }
            $baseQuery->where('farm_id', (int) $user->farm_id);
        }

        $totalSpecies = (int) (clone $baseQuery)->count();
        $activeSpecies = (int) (clone $baseQuery)->where('is_active', true)->count();
        $inactiveSpecies = max(0, $totalSpecies - $activeSpecies);

        // Count unique categories (non-empty)
        $categoriesCount = (int) (clone $baseQuery)
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->count('category');

        $hasSpecificFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';

        $targetFarmId = $user->isRoot()
            ? ($hasSpecificFarm ? (int) $request->farm_id : null)
            : (int) $user->farm_id;

        return [
            'total_species' => $totalSpecies,
            'active_species' => $activeSpecies,
            'inactive_species' => $inactiveSpecies,
            'categories_count' => $categoriesCount,
            'totalSpecies' => $totalSpecies,
            'activeSpecies' => $activeSpecies,
            'inactiveSpecies' => $inactiveSpecies,
            'categoriesCount' => $categoriesCount,
            'farm_id' => $targetFarmId,
        ];
    }

    /**
     * Return the official livestock taxonomy (sector => allowed species).
     */
    public function taxonomy()
    {
        $data = [];
        foreach (Species::TAXONOMY as $category => $speciesMap) {
            $data[] = [
                'category' => $category,
                'species' => array_keys($speciesMap),
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ], Response::HTTP_OK);
    }

    /**
     * Normalize category and name to their canonical values from the official taxonomy.
     */
    protected function normalizeTaxonomyInput(Request $request): void
    {
        if ($request->has('category')) {
            $canonicalCategory = Species::canonicalCategory((string) $request->category);
            $request->merge([
                'category' => $canonicalCategory ?? mb_strtolower(trim((string) $request->category), 'UTF-8'),
            ]);
        }

        if ($request->has('name')) {
            $rawName = preg_replace('/\s+/u', ' ', trim((string) $request->name));
            $canonicalName = Species::canonicalSpeciesName((string) $request->category, $rawName);
            $request->merge([
                'name' => $canonicalName
                    ?? mb_strtoupper(mb_substr($rawName, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($rawName, 1, null, 'UTF-8'),
            ]);
        }
    }

    /**
     * Validation rule: the species name must belong to the selected sector in the official taxonomy.
     */
    protected function taxonomyNameRule(Request $request): \Closure
    {
        return function ($attribute, $value, $fail) use ($request) {
            $category = $request->input('category');

            // Invalid categories are reported by the 'category' rule itself.
            if (!isset(Species::TAXONOMY[$category])) {
                return;
            }

            // Official name of the selected sector: valid (already canonicalized).
            if (array_key_exists($value, Species::TAXONOMY[$category])) {
                return;
            }

            // An official name from a different sector is a real mistake
            // (e.g. "Pollo" under bovina) and must be rejected.
            foreach (array_keys(Species::TAXONOMY) as $otherCategory) {
                if ($otherCategory === $category) {
                    continue;
                }

                if (Species::canonicalSpeciesName($otherCategory, $value) !== null) {
                    $fail("La especie \"{$value}\" pertenece al sector {$otherCategory}, no a {$category}.");

                    return;
                }
            }

            // Any other name is accepted as a custom variant within the
            // selected sector (e.g. "Cerdo de Engorde", "Vaca Holstein").
        };
    }

    /**
     * Store a newly created species in storage.
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

        // Resolve farm_id: Root must provide farm_id if not assigned, non-root uses own farm_id
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');
            if (!$farmId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Debe especificar el ID de la granja (farm_id) para registrar la especie.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        } else {
            if (!$user->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Usuario sin granja asignada.',
                ], Response::HTTP_FORBIDDEN);
            }
            $farmId = $user->farm_id;
        }

        // Normalización de categoría y nombre según la taxonomía oficial
        $this->normalizeTaxonomyInput($request);

        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:255',
                $this->taxonomyNameRule($request),
                Rule::unique('species')->where(function ($query) use ($request, $farmId) {
                    return $query->where('farm_id', $farmId);
                }),
            ],
            'category' => ['required', 'string', Rule::in(Species::VALID_CATEGORIES)],
            'is_active' => 'nullable|boolean',
            'is_custom' => 'nullable|boolean',
            'farm_id' => 'nullable|exists:farms,id',
        ], [
            'name.required' => 'El nombre de la especie es obligatorio.',
            'name.unique' => 'Ya existe una especie con este nombre en la granja seleccionada.',
            'category.required' => 'La categoría de la especie es obligatoria.',
            'category.in' => 'La categoría debe ser una de las opciones válidas: bovina, porcina, avícola, ovina, caprina, cunícola.',
            'farm_id.exists' => 'La granja especificada no existe.',
        ]);

        // Validación case-insensitive robusta contra duplicados (ej: "Pollo" vs "pollo")
        $validator->after(function ($v) use ($request, $farmId) {
            if (!$v->errors()->has('name') && $request->filled('name')) {
                $checkLower = mb_strtolower(trim((string) $request->name));
                $duplicateExists = Species::where('farm_id', $farmId)
                    ->whereRaw('LOWER(TRIM(name)) = ?', [$checkLower])
                    ->exists();

                if ($duplicateExists) {
                    $v->errors()->add('name', 'Ya existe una especie con este nombre en la granja seleccionada.');
                }
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $species = Species::create([
            'name' => trim($request->name),
            'category' => trim($request->category),
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
            // La marca "personalizada" solo es válida si el nombre no
            // pertenece a la taxonomía oficial del sector.
            'is_custom' => $request->boolean('is_custom')
                && Species::isCustomName(trim((string) $request->category), trim((string) $request->name)),
            'farm_id' => $farmId,
        ]);

        $species->load('farm:id,name,code');

        return response()->json([
            'status' => 'success',
            'message' => 'Especie registrada correctamente.',
            'data' => $species,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified species.
     */
    public function show($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $species = Species::with('farm:id,name,code')->find($id);

        if (!$species) {
            return response()->json([
                'status' => 'error',
                'message' => 'Especie no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary check for non-root users
        if ($user && !$user->isRoot() && $species->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Esta especie pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'data' => $species,
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified species in storage.
     */
    public function update(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $species = Species::find($id);

        if (!$species) {
            return response()->json([
                'status' => 'error',
                'message' => 'Especie no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict boundary check
        if ($user && !$user->isRoot() && $species->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Esta especie pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Normalización de categoría y nombre según la taxonomía oficial
        $this->normalizeTaxonomyInput($request);

        $farmId = $species->farm_id;

        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:255',
                $this->taxonomyNameRule($request),
                Rule::unique('species')->where(function ($query) use ($farmId) {
                    return $query->where('farm_id', $farmId);
                })->ignore($species->id),
            ],
            'category' => ['required', 'string', Rule::in(Species::VALID_CATEGORIES)],
            'is_active' => 'nullable|boolean',
            'is_custom' => 'nullable|boolean',
        ], [
            'name.required' => 'El nombre de la especie es obligatorio.',
            'name.unique' => 'Ya existe una especie con este nombre en la granja seleccionada.',
            'category.required' => 'La categoría de la especie es obligatoria.',
            'category.in' => 'La categoría debe ser una de las opciones válidas: bovina, porcina, avícola, ovina, caprina, cunícola.',
        ]);

        // Validación case-insensitive robusta contra duplicados (ej: "Pollo" vs "pollo")
        $validator->after(function ($v) use ($request, $farmId, $species) {
            if (!$v->errors()->has('name') && $request->filled('name')) {
                $checkLower = mb_strtolower(trim((string) $request->name));
                $duplicateExists = Species::where('farm_id', $farmId)
                    ->where('id', '!=', $species->id)
                    ->whereRaw('LOWER(TRIM(name)) = ?', [$checkLower])
                    ->exists();

                if ($duplicateExists) {
                    $v->errors()->add('name', 'Ya existe una especie con este nombre en la granja seleccionada.');
                }
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $species->name = trim($request->name);
        $species->category = trim($request->category);

        if ($request->has('is_active')) {
            $species->is_active = (bool) $request->is_active;
        }

        // La marca "personalizada" solo es válida si el nombre no pertenece
        // a la taxonomía oficial del sector.
        if ($request->has('is_custom')) {
            $species->is_custom = $request->boolean('is_custom')
                && Species::isCustomName(trim((string) $request->category), trim((string) $request->name));
        }

        $species->save();
        $species->load('farm:id,name,code');

        return response()->json([
            'status' => 'success',
            'message' => 'Especie actualizada correctamente.',
            'data' => $species,
        ], Response::HTTP_OK);
    }

    /**
     * Toggle or update the active status of the species.
     */
    public function toggleStatus(Request $request, $id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $species = Species::find($id);

        if (!$species) {
            return response()->json([
                'status' => 'error',
                'message' => 'Especie no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && !$user->isRoot() && $species->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Esta especie pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $newStatus = $request->has('is_active')
            ? (bool) $request->is_active
            : !$species->is_active;

        $species->is_active = $newStatus;
        $species->save();
        $species->load('farm:id,name,code');

        return response()->json([
            'status' => 'success',
            'message' => $newStatus ? 'Especie habilitada correctamente.' : 'Especie inhabilitada correctamente.',
            'data' => $species,
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified species from storage.
     */
    public function destroy($id)
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        $species = Species::find($id);

        if (!$species) {
            return response()->json([
                'status' => 'error',
                'message' => 'Especie no encontrada o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Strict farm boundary: non-root users may only delete their own farm's species
        if ($user && !$user->isRoot() && $species->farm_id !== $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: Esta especie pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Integrity check: block deletion while the species is still linked to any
        // barn/galpón (galpones.species_id cascades on delete, so removing the
        // species would silently destroy farm infrastructure records)
        $hasGalpones = Galpon::where('species_id', $species->id)->exists();

        if ($hasGalpones) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar la especie porque está siendo utilizada en galpones activos.',
                'errors' => [
                    'galpones' => ['No se puede eliminar la especie porque está siendo utilizada en galpones activos.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Integrity check: same protection for potreros (potreros.species_id also
        // cascades on delete)
        $hasPotreros = Potrero::where('species_id', $species->id)->exists();

        if ($hasPotreros) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se puede eliminar la especie porque está siendo utilizada en potreros activos.',
                'errors' => [
                    'potreros' => ['No se puede eliminar la especie porque está siendo utilizada en potreros activos.'],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $species->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Especie eliminada correctamente.',
        ], Response::HTTP_OK);
    }
}
