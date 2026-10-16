<?php

namespace App\Http\Controllers\Root;

use App\Http\Controllers\Controller;
use App\Models\Farm;
use App\Models\Module;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class RootFarmController extends Controller
{
    /**
     * List all registered farms.
     */
    public function index()
    {
        $farms = Farm::withCount(['users' => function ($query) {
            $query->where('role', 'admin');
        }])
        ->with('modules')
        ->orderBy('created_at', 'desc')
        ->get();

        $totalFarms = Farm::count();
        $activeFarms = Farm::where('is_active', true)->count();
        $inactiveFarms = Farm::where('is_active', false)->count();

        return response()->json([
            'status' => 'success',
            'total_farms' => (int) $totalFarms,
            'active_farms' => (int) $activeFarms,
            'inactive_farms' => (int) $inactiveFarms,
            'farms_count' => (int) $totalFarms,
            'data' => $farms,
        ], Response::HTTP_OK);
    }

    /**
     * List all active farms for select/dropdown forms.
     * Returns ALL active registered farms without excluding farms that already have an admin.
     */
    public function select(Request $request)
    {
        $includeInactive = $request->boolean('include_inactive') || $request->boolean('all');

        $query = Farm::query();
        if (!$includeInactive) {
            $query->where('is_active', true);
        }

        $farms = $query->orderBy('name', 'asc')
            ->select('id', 'name', 'code', 'sector', 'location', 'is_active')
            ->withCount(['users as admins_count' => function ($q) {
                $q->where('role', 'admin');
            }])
            ->get();

        return response()->json([
            'success' => true,
            'status' => 'success',
            'message' => 'Lista de granjas disponibles para selección.',
            'total' => $farms->count(),
            'data' => $farms,
            'farms' => $farms,
        ], Response::HTTP_OK);
    }

    /**
     * Create a new farm.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:farms,name',
            'sector' => ['required', 'string', \Illuminate\Validation\Rule::in(Farm::VALID_SECTORS)],
            'location' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ], [
            'name.required' => 'El nombre de la granja es obligatorio.',
            'name.unique' => 'Ya existe una granja registrada con este nombre.',
            'sector.required' => 'El sector pecuario es obligatorio.',
            'sector.in' => 'El sector pecuario seleccionado no es válido. Opciones válidas: ' . implode(', ', Farm::VALID_SECTORS),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $farm = Farm::create([
            'name' => $request->name,
            'sector' => $request->sector,
            'location' => $request->location,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);

        // Automatically initialize default system modules for the new farm
        $modules = Module::all();
        foreach ($modules as $module) {
            DB::table('farm_modules')->updateOrInsert(
                ['farm_id' => $farm->id, 'module_id' => $module->id],
                ['is_enabled' => true]
            );
        }

        $farm->load('modules');

        return response()->json([
            'status' => 'success',
            'message' => 'Granja registrada exitosamente.',
            'data' => $farm,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified farm details.
     */
    public function show($id)
    {
        $farm = Farm::with(['modules', 'users'])->find($id);

        if (!$farm) {
            return response()->json([
                'status' => 'error',
                'message' => 'Granja no encontrada.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'status' => 'success',
            'data' => $farm,
        ], Response::HTTP_OK);
    }

    /**
     * Update farm details or change its status (active/inactive).
     */
    public function update(Request $request, $id)
    {
        $farm = Farm::find($id);

        if (!$farm) {
            return response()->json([
                'status' => 'error',
                'message' => 'Granja no encontrada.',
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255|unique:farms,name,' . $id,
            'sector' => ['sometimes', 'required', 'string', \Illuminate\Validation\Rule::in(Farm::VALID_SECTORS)],
            'location' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ], [
            'name.required' => 'El nombre de la granja no puede estar vacío.',
            'name.unique' => 'Ya existe otra granja con este nombre.',
            'sector.in' => 'El sector pecuario seleccionado no es válido. Opciones válidas: ' . implode(', ', Farm::VALID_SECTORS),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($request->has('name')) {
            $farm->name = $request->name;
        }

        if ($request->has('sector')) {
            $farm->sector = $request->sector;
        }

        if ($request->has('location')) {
            $farm->location = $request->location;
        }

        if ($request->has('is_active')) {
            $farm->is_active = (bool) $request->is_active;
        }

        $farm->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Granja actualizada correctamente.',
            'data' => $farm,
        ], Response::HTTP_OK);
    }

    /**
     * Get module configuration for a specific farm.
     * Returns complete list of all official system modules combined with their real state in farm_modules.
     * If a module has no pivot record, is_enabled defaults explicitly to false (never null).
     */
    public function getFarmModules($id)
    {
        $farm = Farm::find($id);

        if (!$farm) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Granja no encontrada.',
            ], Response::HTTP_NOT_FOUND);
        }

        $allOfficialModules = Module::orderBy('id', 'asc')->get();

        $modules = $allOfficialModules->map(function ($module) use ($farm) {
            $pivot = DB::table('farm_modules')
                ->where('farm_id', $farm->id)
                ->where('module_id', $module->id)
                ->first();

            return [
                'id' => (int) $module->id,
                'module_id' => (int) $module->id,
                'code' => (string) $module->code,
                'name' => (string) $module->name,
                'description' => (string) $module->description,
                'is_enabled' => $pivot !== null ? (bool) $pivot->is_enabled : false,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'status' => 'success',
            'message' => 'Módulos de la granja obtenidos correctamente.',
            'farm_id' => (int) $farm->id,
            'farm_name' => (string) $farm->name,
            'data' => [
                'farm_id' => (int) $farm->id,
                'farm_name' => (string) $farm->name,
                'modules' => $modules,
            ],
            'modules' => $modules,
        ], Response::HTTP_OK);
    }

    /**
     * Resolve a Module instance dynamically by numeric ID, code, or alias.
     */
    protected function resolveModule($identifier): ?Module
    {
        if (empty($identifier)) {
            return null;
        }

        // 1. If numeric, search by ID first
        if (is_numeric($identifier)) {
            $mod = Module::find((int) $identifier);
            if ($mod) {
                return $mod;
            }
        }

        $str = strtolower(trim((string) $identifier));

        // 2. Normalize common UI aliases
        $aliasMap = [
            'historial' => 'history',
            'history' => 'history',
            'especies' => 'species',
            'species' => 'species',
            'galpones' => 'barns',
            'barns' => 'barns',
            'lotes' => 'lots',
            'lots' => 'lots',
            'actividades' => 'activities',
            'activities' => 'activities',
            'inventario' => 'inventory',
            'inventory' => 'inventory',
            'analitica' => 'analytics',
            'analytics' => 'analytics',
        ];

        $code = $aliasMap[$str] ?? $str;

        // 3. Search dynamically in modules table
        return Module::where('code', $code)
            ->orWhereRaw('LOWER(code) = ?', [$code])
            ->orWhereRaw('LOWER(code) = ?', [$str])
            ->first();
    }

    /**
     * Update/Toggle enabled modules for a specific farm.
     */
    public function updateFarmModules(Request $request, $id)
    {
        $farm = Farm::find($id);

        if (!$farm) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Granja no encontrada.',
            ], Response::HTTP_NOT_FOUND);
        }

        // 1. Support single module payload ({ module_id: X, is_enabled: Y } or { code: 'history', is_enabled: Y })
        $singleModIdent = $request->input('module_id')
            ?? $request->input('moduleId')
            ?? $request->input('code')
            ?? $request->input('module_code')
            ?? $request->input('module')
            ?? ($request->has('is_enabled') ? $request->input('id') : null);

        if ($singleModIdent !== null && $request->has('is_enabled')) {
            $module = $this->resolveModule($singleModIdent);
            if (!$module) {
                return response()->json([
                    'success' => false,
                    'status' => 'error',
                    'message' => 'Módulo no encontrado.',
                ], Response::HTTP_NOT_FOUND);
            }

            $targetFarmId = (int) ($request->input('farm_id') ?: $farm->id);
            $isEnabled = (bool) $request->input('is_enabled');

            DB::table('farm_modules')->updateOrInsert(
                [
                    'farm_id' => $targetFarmId,
                    'module_id' => $module->id,
                ],
                [
                    'is_enabled' => $isEnabled,
                    'updated_at' => now(),
                ]
            );

            return response()->json([
                'success' => true,
                'status' => 'success',
                'message' => "Estado del módulo '{$module->name}' actualizado con éxito.",
                'data' => [
                    'id' => (int) $module->id,
                    'module_id' => (int) $module->id,
                    'code' => $module->code,
                    'name' => $module->name,
                    'farm_id' => $targetFarmId,
                    'is_enabled' => $isEnabled,
                ]
            ], Response::HTTP_OK);
        }

        // 2. Support batch modules payload:
        //    { modules: [ { module_id: 1, is_enabled: true }, { code: 'history', is_enabled: false }, ... ] }
        $rawModules = $request->input('modules');

        if (!is_array($rawModules) || empty($rawModules)) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Debe proporcionar la lista de módulos.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        foreach ($rawModules as $moduleItem) {
            if (is_array($moduleItem)) {
                $ident = $moduleItem['module_id'] ?? ($moduleItem['id'] ?? ($moduleItem['code'] ?? ($moduleItem['module_code'] ?? null)));
                $modEnabled = isset($moduleItem['is_enabled']) ? (bool) $moduleItem['is_enabled'] : true;
            } elseif (is_numeric($moduleItem) || is_string($moduleItem)) {
                $ident = $moduleItem;
                $modEnabled = true;
            } else {
                continue;
            }

            $module = $this->resolveModule($ident);
            if ($module) {
                DB::table('farm_modules')->updateOrInsert(
                    [
                        'farm_id' => $farm->id,
                        'module_id' => $module->id,
                    ],
                    [
                        'is_enabled' => $modEnabled,
                        'updated_at' => now(),
                    ]
                );
            }
        }

        $modulesList = Module::orderBy('id', 'asc')->get()->map(function ($module) use ($farm) {
            $pivot = DB::table('farm_modules')
                ->where('farm_id', $farm->id)
                ->where('module_id', $module->id)
                ->first();

            return [
                'id' => (int) $module->id,
                'module_id' => (int) $module->id,
                'code' => $module->code,
                'name' => $module->name,
                'description' => $module->description,
                'is_enabled' => $pivot !== null ? (bool) $pivot->is_enabled : false,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'status' => 'success',
            'message' => 'Estado de los módulos actualizado correctamente.',
            'data' => [
                'farm_id' => (int) $farm->id,
                'farm_name' => $farm->name,
                'modules' => $modulesList,
            ],
            'modules' => $modulesList,
        ], Response::HTTP_OK);
    }

    /**
     * Toggle a single farm module state independently.
     */
    public function updateSingleFarmModule(Request $request, $farmId, $moduleId)
    {
        $farm = Farm::find($farmId);

        if (!$farm) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Granja no encontrada.',
            ], Response::HTTP_NOT_FOUND);
        }

        $module = $this->resolveModule($moduleId)
            ?? $this->resolveModule($request->input('module_id'))
            ?? $this->resolveModule($request->input('code'));

        if (!$module) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Módulo no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'is_enabled' => 'required|boolean',
        ], [
            'is_enabled.required' => 'El estado is_enabled es obligatorio.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Strictly update or insert ONLY for this specific composite key (farm_id + module_id)
        $targetFarmId = (int) ($request->input('farm_id') ?: $farm->id);
        $targetModuleId = (int) $module->id;
        $isEnabled = (bool) $request->is_enabled;

        DB::table('farm_modules')->updateOrInsert(
            [
                'farm_id' => $targetFarmId,
                'module_id' => $targetModuleId,
            ],
            [
                'is_enabled' => $isEnabled,
                'updated_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'status' => 'success',
            'message' => "Estado do módulo '{$module->name}' atualizado com sucesso.",
            'data' => [
                'id' => (int) $module->id,
                'module_id' => (int) $module->id,
                'farm_id' => $targetFarmId,
                'module_code' => $module->code,
                'code' => $module->code,
                'module_name' => $module->name,
                'name' => $module->name,
                'is_enabled' => $isEnabled,
            ]
        ], Response::HTTP_OK);
    }
}
