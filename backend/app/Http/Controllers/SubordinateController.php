<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class SubordinateController extends Controller
{
    /**
     * Resolve module IDs from either module_ids or modules input array.
     */
    private function resolveModuleIds(Request $request): ?array
    {
        $input = $request->input('module_ids', $request->input('modules', null));
        if ($input === null) {
            return null;
        }

        if (!is_array($input)) {
            return [];
        }

        $allMods = Module::all();
        $codeMap = [
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
            'historial' => 'history',
            'history' => 'history',
        ];

        $ids = [];
        foreach ($input as $item) {
            if (is_numeric($item)) {
                $ids[] = (int) $item;
            } elseif (is_string($item)) {
                $searchCode = $codeMap[strtolower(trim($item))] ?? strtolower(trim($item));
                $found = $allMods->firstWhere('code', $searchCode);
                if ($found) {
                    $ids[] = (int) $found->id;
                }
            } elseif (is_array($item)) {
                $enabled = isset($item['is_enabled']) ? (bool) $item['is_enabled'] : true;
                if ($enabled) {
                    $val = $item['id'] ?? $item['module_id'] ?? null;
                    if (is_numeric($val)) {
                        $ids[] = (int) $val;
                    }
                }
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * List all subordinate users (Encargados) for the authenticated admin's farm.
     * Guaranteed tenant isolation: Admins only see subordinates belonging to their own farm.
     */
    public function index(Request $request)
    {
        $authUser = Auth::guard('api')->user() ?? Auth::user();

        if (!$authUser) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // If not root (e.g. Admin), enforce strict filtering by authenticated user's farm_id
        if (!$authUser->isRoot()) {
            if (!$authUser->farm_id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El usuario administrador no tiene una granja asociada.',
                ], Response::HTTP_FORBIDDEN);
            }

            $subordinates = User::where('role', 'subordinate')
                ->where('farm_id', $authUser->farm_id)
                ->with([
                    'modules',
                    'subordinateModules' => function ($q) {
                        $q->wherePivot('is_enabled', true);
                    },
                ])
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            // Root user can optionally filter by farm_id query param
            $query = User::where('role', 'subordinate')
                ->with([
                    'modules',
                    'subordinateModules' => function ($q) {
                        $q->wherePivot('is_enabled', true);
                    },
                ]);

            if ($request->filled('farm_id') && $request->farm_id !== 'all' && strtolower(trim((string) $request->farm_id)) !== 'all') {
                $query->where('farm_id', (int) $request->query('farm_id'));
            }

            $subordinates = $query->orderBy('created_at', 'desc')->get();
        }

        $subordinates->each(function ($sub) {
            $assigned = [];
            if ($sub->subordinateModules) {
                foreach ($sub->subordinateModules as $mod) {
                    $assigned[] = $mod->code;
                }
            }
            $sub->assigned_modules = $assigned;
        });

        return response()->json([
            'status' => 'success',
            'data' => $subordinates,
        ], Response::HTTP_OK);
    }

    /**
     * Get available enabled modules for the administrator's farm.
     */
    public function availableModules(Request $request)
    {
        $authUser = Auth::guard('api')->user();

        if (!$authUser) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $hasRequestedFarm = $request->filled('farm_id')
            && $request->farm_id !== 'all'
            && strtolower(trim((string) $request->farm_id)) !== 'all';
        $farmId = ($authUser->isRoot() && $hasRequestedFarm)
            ? (int) $request->query('farm_id')
            : ($authUser->isRoot() ? null : $authUser->farm_id);

        if (!$farmId && $authUser->isRoot()) {
            // For Root user listing available modules, return all system modules
            $modules = Module::all(['id', 'code', 'name', 'description']);
            return response()->json([
                'status' => 'success',
                'data' => $modules,
            ], Response::HTTP_OK);
        }

        if (!$farmId) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se especificó una granja asociada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $enabledModules = DB::table('farm_modules')
            ->join('modules', 'farm_modules.module_id', '=', 'modules.id')
            ->where('farm_modules.farm_id', $farmId)
            ->where('farm_modules.is_enabled', true)
            ->select('modules.id', 'modules.code', 'modules.name', 'modules.description')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $enabledModules,
        ], Response::HTTP_OK);
    }

    /**
     * Register a new Subordinate user (Encargado) and assign modules with strict farm validation.
     */
    public function store(Request $request)
    {
        $authUser = Auth::guard('api')->user();

        if (!$authUser) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $farmId = $authUser->isRoot()
            ? ($request->farm_id ?? $authUser->farm_id)
            : $authUser->farm_id;

        if (!$farmId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Debe especificar una granja válida para el encargado.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'lastname' => 'nullable|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:50', // Phone is optional
            'password' => 'required|string|min:6',
            'is_active' => 'nullable|boolean',
            'module_ids' => 'nullable|array',
            'modules' => 'nullable|array',
        ], [
            'name.required' => 'El nombre del encargado es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'El formato de correo electrónico es inválido.',
            'email.unique' => 'Este correo ya se encuentra registrado en el sistema.',
            'password.required' => 'La contraseña de acceso es obligatoria.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
            'module_ids.array' => 'Los módulos deben enviarse en formato de lista.',
            'modules.array' => 'Los módulos deben enviarse en formato de lista.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Strict Hierarchy Validation (Admin -> Subordinate):
        // Verify that each requested module is currently enabled for the farm in `farm_modules` (is_enabled = true)
        $requestedModuleIds = $this->resolveModuleIds($request);
        if ($requestedModuleIds !== null && count($requestedModuleIds) > 0) {
            $enabledFarmModuleIds = DB::table('farm_modules')
                ->where('farm_id', $farmId)
                ->where('is_enabled', true)
                ->pluck('module_id')
                ->map(fn($id) => (int)$id)
                ->toArray();

            $unauthorizedModuleIds = array_diff($requestedModuleIds, $enabledFarmModuleIds);

            if (!empty($unauthorizedModuleIds)) {
                $unauthorizedNames = Module::whereIn('id', $unauthorizedModuleIds)->pluck('name')->implode(', ');
                return response()->json([
                    'status' => 'error',
                    'message' => "Jerarquía de permisos rechazada. Su granja no tiene habilitado(s) el/los módulo(s): {$unauthorizedNames}.",
                    'errors' => [
                        'module_ids' => ["Los siguientes módulos no están habilitados para esta granja y no se pueden asignar: {$unauthorizedNames}"],
                        'modules' => ["Los siguientes módulos no están habilitados para esta granja y no se pueden asignar: {$unauthorizedNames}"],
                    ]
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        // Create Subordinate User with hashed password
        $subordinate = User::create([
            'farm_id' => $farmId,
            'role' => 'subordinate',
            'name' => $request->name,
            'lastname' => $request->lastname,
            'email' => $request->email,
            'phone' => $request->phone,
            'password_hash' => Hash::make($request->password),
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);

        // Assign allowed modules to subordinate in `subordinate_modules`
        if ($requestedModuleIds !== null) {
            $allModuleIds = Module::pluck('id')->toArray();
            foreach ($allModuleIds as $modId) {
                $isEnabled = in_array($modId, $requestedModuleIds);
                DB::table('subordinate_modules')->updateOrInsert(
                    ['user_id' => $subordinate->id, 'module_id' => $modId],
                    ['is_enabled' => $isEnabled]
                );
            }
        }

        $subordinate->load(['subordinateModules', 'farm', 'modules']);

        return response()->json([
            'status' => 'success',
            'message' => 'Usuario Encargado registrado exitosamente con sus módulos correspondientes.',
            'data' => $subordinate,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show single subordinate details.
     */
    public function show($id)
    {
        $authUser = Auth::guard('api')->user() ?? Auth::user();

        $subordinate = User::where('role', 'subordinate')
            ->with(['subordinateModules', 'farm', 'modules'])
            ->find($id);

        if (!$subordinate) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario encargado no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Check farm authorization for non-root users
        if (!$authUser->isRoot() && $subordinate->farm_id !== $authUser->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'No tiene permisos para consultar este usuario de otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'data' => $subordinate,
        ], Response::HTTP_OK);
    }

    /**
     * Update subordinate details and module permissions with strict farm validation.
     */
    public function update(Request $request, $id)
    {
        $authUser = Auth::guard('api')->user();

        $subordinate = User::where('role', 'subordinate')->find($id);

        if (!$subordinate) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario encargado no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        // Check farm authorization for non-root users
        if (!$authUser->isRoot() && $subordinate->farm_id !== $authUser->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'No tiene permisos para editar este usuario de otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'lastname' => 'nullable|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:50',
            'password' => 'nullable|string|min:6',
            'is_active' => 'sometimes|boolean',
            'module_ids' => 'nullable|array',
            'modules' => 'nullable|array',
        ], [
            'name.required' => 'El nombre no puede estar vacío.',
            'email.required' => 'El correo electrónico no puede estar vacío.',
            'email.unique' => 'Este correo ya se encuentra en uso por otro usuario.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
            'module_ids.array' => 'Los módulos deben enviarse en formato de lista.',
            'modules.array' => 'Los módulos deben enviarse en formato de lista.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $farmId = $subordinate->farm_id;

        // Strict Hierarchy Validation (Admin -> Subordinate):
        // Verify that each requested module is currently enabled for the farm in `farm_modules` (is_enabled = true)
        $requestedModuleIds = $this->resolveModuleIds($request);
        if ($requestedModuleIds !== null && count($requestedModuleIds) > 0) {
            $enabledFarmModuleIds = DB::table('farm_modules')
                ->where('farm_id', $farmId)
                ->where('is_enabled', true)
                ->pluck('module_id')
                ->map(fn($id) => (int)$id)
                ->toArray();

            $unauthorizedModuleIds = array_diff($requestedModuleIds, $enabledFarmModuleIds);

            if (!empty($unauthorizedModuleIds)) {
                $unauthorizedNames = Module::whereIn('id', $unauthorizedModuleIds)->pluck('name')->implode(', ');
                return response()->json([
                    'status' => 'error',
                    'message' => "Jerarquía de permisos rechazada. Su granja no tiene habilitado(s) el/los módulo(s): {$unauthorizedNames}.",
                    'errors' => [
                        'module_ids' => ["Los siguientes módulos no están habilitados para esta granja y no se pueden asignar: {$unauthorizedNames}"],
                        'modules' => ["Los siguientes módulos no están habilitados para esta granja y no se pueden asignar: {$unauthorizedNames}"],
                    ]
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if ($request->has('name')) {
            $subordinate->name = $request->name;
        }

        if ($request->has('lastname')) {
            $subordinate->lastname = $request->lastname;
        }

        if ($request->has('email')) {
            $subordinate->email = $request->email;
        }

        if ($request->has('phone')) {
            $subordinate->phone = $request->phone;
        }

        if ($request->filled('password')) {
            $subordinate->password_hash = Hash::make($request->password);
        }

        if ($request->has('is_active')) {
            $subordinate->is_active = (bool) $request->is_active;
        }

        $subordinate->save();

        // Update module permissions in `subordinate_modules`
        if ($requestedModuleIds !== null) {
            $allModuleIds = Module::pluck('id')->toArray();
            foreach ($allModuleIds as $mId) {
                $isEnabled = in_array($mId, $requestedModuleIds);
                DB::table('subordinate_modules')->updateOrInsert(
                    ['user_id' => $subordinate->id, 'module_id' => $mId],
                    ['is_enabled' => $isEnabled]
                );
            }
        }

        $subordinate->load(['subordinateModules', 'farm', 'modules']);

        return response()->json([
            'status' => 'success',
            'message' => 'Datos y permisos del encargado actualizados correctamente.',
            'data' => $subordinate,
        ], Response::HTTP_OK);
    }
}
