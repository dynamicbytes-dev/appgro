<?php

namespace App\Http\Controllers\Root;

use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class RootAdminController extends Controller
{
    /**
     * Resolve module IDs from either module_ids (array of ints) or modules (array of codes/strings/ints/objects).
     */
    private function resolveModuleIds(Request $request): ?array
    {
        $input = $request->input('modules', $request->input('module_ids', null));
        if ($input === null) {
            return null;
        }

        if (!is_array($input)) {
            return [];
        }

        // If array of objects: [['id' => 2, 'is_enabled' => true], ...] or associative [2 => ['is_enabled' => true]]
        if (!empty($input) && is_array(reset($input))) {
            $ids = [];
            foreach ($input as $key => $item) {
                $enabled = isset($item['is_enabled']) ? (bool) $item['is_enabled'] : true;
                if ($enabled) {
                    $id = $item['id'] ?? $item['module_id'] ?? $key;
                    if (is_numeric($id)) {
                        $ids[] = (int) $id;
                    }
                }
            }
            return array_values(array_unique($ids));
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
            'analitica' => 'analytics',
            'analytics' => 'analytics',
            'historial' => 'history',
            'history' => 'history',
        ];

        $ids = [];
        foreach ($input as $m) {
            if (is_numeric($m)) {
                $ids[] = (int) $m;
            } elseif (is_string($m)) {
                $searchCode = $codeMap[strtolower(trim($m))] ?? strtolower(trim($m));
                $found = $allMods->firstWhere('code', $searchCode);
                if ($found) {
                    $ids[] = $found->id;
                }
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * List all administrator users (farm owners).
     */
    public function index()
    {
        $admins = User::where('role', 'admin')
            ->with(['farm.modules', 'modules'])
            ->orderBy('created_at', 'desc')
            ->get([
                'id',
                'farm_id',
                'role',
                'name',
                'lastname',
                'email',
                'phone',
                'is_active',
                'created_at',
            ]);

        $admins->transform(function ($admin) {
            $enabledModules = [];
            if ($admin->modules) {
                foreach ($admin->modules as $mod) {
                    if ($mod->pivot && $mod->pivot->is_enabled) {
                        $enabledModules[] = $mod->code;
                    }
                }
            }
            $admin->enabled_modules = $enabledModules;
            return $admin;
        });

        $totalAdmins = User::where('role', 'admin')->count();
        $activeAdmins = User::where('role', 'admin')->where('is_active', true)->count();
        $inactiveAdmins = User::where('role', 'admin')->where('is_active', false)->count();

        return response()->json([
            'status' => 'success',
            'total_admins' => (int) $totalAdmins,
            'active_admins' => (int) $activeAdmins,
            'inactive_admins' => (int) $inactiveAdmins,
            'admins_count' => (int) $totalAdmins,
            'data' => $admins,
        ], Response::HTTP_OK);
    }

    /**
     * Register a new Admin user associated to a farm.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'lastname' => 'nullable|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:6',
            'farm_id' => 'required|exists:farms,id',
            'is_active' => 'nullable|boolean',
            'module_ids' => 'nullable|array',
            'modules' => 'nullable|array',
        ], [
            'name.required' => 'El nombre del administrador es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'El formato de correo es inválido.',
            'email.unique' => 'Este correo ya se encuentra registrado.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
            'farm_id.required' => 'Debe asociar obligatoriamente una granja existente.',
            'farm_id.exists' => 'La granja seleccionada no existe.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $admin = User::create([
            'name' => $request->name,
            'lastname' => $request->lastname,
            'email' => $request->email,
            'phone' => $request->phone,
            'password_hash' => Hash::make($request->password),
            'role' => 'admin',
            'farm_id' => $request->farm_id,
            'is_active' => $request->has('is_active') ? (bool) $request->is_active : true,
        ]);

        // Sincronización de módulos del Administrador usando Eloquent
        if (($request->has('modules') || $request->has('module_ids')) && $admin->farm_id) {
            $moduleIds = $this->resolveModuleIds($request) ?? [];
            $allModules = Module::all();
            $syncData = [];
            foreach ($allModules as $mod) {
                $syncData[$mod->id] = [
                    'is_enabled' => in_array($mod->id, $moduleIds),
                    'updated_at' => now(),
                ];
            }
            $admin->modules()->sync($syncData);
        }

        $admin->load(['farm.modules', 'modules']);

        $enabledModules = [];
        if ($admin->modules) {
            foreach ($admin->modules as $mod) {
                if ($mod->pivot && $mod->pivot->is_enabled) {
                    $enabledModules[] = $mod->code;
                }
            }
        }
        $admin->enabled_modules = $enabledModules;

        return response()->json([
            'status' => 'success',
            'message' => 'Usuario Administrador registrado correctamente.',
            'data' => $admin,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display single admin details.
     */
    public function show($id)
    {
        $admin = User::where('role', 'admin')
            ->with(['farm.modules', 'modules'])
            ->find($id);

        if (!$admin) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario administrador no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        $enabledModules = [];
        if ($admin->modules) {
            foreach ($admin->modules as $mod) {
                if ($mod->pivot && $mod->pivot->is_enabled) {
                    $enabledModules[] = $mod->code;
                }
            }
        }
        $admin->enabled_modules = $enabledModules;

        return response()->json([
            'status' => 'success',
            'data' => $admin,
        ], Response::HTTP_OK);
    }

    /**
     * Update or deactivate an Admin user.
     */
    public function update(Request $request, $id)
    {
        $admin = User::where('role', 'admin')->find($id);

        if (!$admin) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario administrador no encontrado.',
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'lastname' => 'nullable|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:50',
            'farm_id' => 'sometimes|required|exists:farms,id',
            'password' => 'nullable|string|min:6',
            'is_active' => 'sometimes|boolean',
            'module_ids' => 'nullable|array',
            'modules' => 'nullable|array',
        ], [
            'name.required' => 'El nombre no puede estar vacío.',
            'email.required' => 'El correo electrónico no puede estar vacío.',
            'email.unique' => 'Este correo ya está en uso por otro usuario.',
            'farm_id.exists' => 'La granja seleccionada no existe.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($request->has('name')) {
            $admin->name = $request->name;
        }

        if ($request->has('lastname')) {
            $admin->lastname = $request->lastname;
        }

        if ($request->has('email')) {
            $admin->email = $request->email;
        }

        if ($request->has('phone')) {
            $admin->phone = $request->phone;
        }

        if ($request->has('farm_id')) {
            $admin->farm_id = $request->farm_id;
        }

        if ($request->filled('password')) {
            $admin->password_hash = Hash::make($request->password);
        }

        if ($request->has('is_active')) {
            $admin->is_active = (bool) $request->is_active;
        }

        $admin->save();

        // Sincronización de módulos del Administrador usando Eloquent
        if (($request->has('modules') || $request->has('module_ids')) && $admin->farm_id) {
            $moduleIds = $this->resolveModuleIds($request) ?? [];
            $allModules = Module::all();
            $syncData = [];
            foreach ($allModules as $mod) {
                $syncData[$mod->id] = [
                    'is_enabled' => in_array($mod->id, $moduleIds),
                    'updated_at' => now(),
                ];
            }
            $admin->modules()->sync($syncData);
        }

        $admin->load(['farm.modules', 'modules']);

        $enabledModules = [];
        if ($admin->modules) {
            foreach ($admin->modules as $mod) {
                if ($mod->pivot && $mod->pivot->is_enabled) {
                    $enabledModules[] = $mod->code;
                }
            }
        }
        $admin->enabled_modules = $enabledModules;

        return response()->json([
            'status' => 'success',
            'message' => 'Usuario Administrador actualizado correctamente.',
            'data' => $admin,
        ], Response::HTTP_OK);
    }

    /**
     * Toggle the active status of an Admin user.
     */
    public function toggleStatus(Request $request, $id)
    {
        $admin = User::where('role', 'admin')->findOrFail($id);

        if ($request->has('is_active')) {
            $admin->is_active = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
        } else {
            // Invierte el estado booleano actual
            $admin->is_active = !$admin->is_active;
        }

        $admin->save();

        $admin->load(['farm.modules', 'modules']);

        $enabledModules = [];
        if ($admin->modules) {
            foreach ($admin->modules as $mod) {
                if ($mod->pivot && $mod->pivot->is_enabled) {
                    $enabledModules[] = $mod->code;
                }
            }
        }
        $admin->enabled_modules = $enabledModules;

        return response()->json([
            'status' => 'success',
            'message' => 'Estado del administrador actualizado exitosamente.',
            'is_active' => (bool) $admin->is_active,
            'data' => $admin,
        ], Response::HTTP_OK);
    }
}
