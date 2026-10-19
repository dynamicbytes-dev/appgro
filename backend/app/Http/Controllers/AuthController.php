<?php

namespace App\Http\Controllers;

use App\Models\Module;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    /**
     * Authenticate user strictly querying the `users` table via `email` and validating password using `Hash::check()`.
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ], [
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'El formato del correo electrónico es inválido.',
            'password.required' => 'La contraseña es obligatoria.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de datos.',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // 1. Directly query the users table in PostgreSQL by email
        $user = User::where('email', $request->email)->first();

        // 2. Validate user existence and verify password using Hash::check() against password_hash
        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Credenciales inválidas. Verifique su correo y clave.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // 3. Verify user active status
        if (!$user->is_active) {
            return response()->json([
                'status' => 'error',
                'message' => 'Su cuenta se encuentra inactiva. Contacte al administrador.',
            ], Response::HTTP_FORBIDDEN);
        }

        // 4. Issue JWT token for authenticated database user
        $token = Auth::guard('api')->login($user);

        return $this->createNewTokenResponse($token);
    }

    /**
     * Get authenticated user profile.
     */
    public function me()
    {
        $user = Auth::guard('api')->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $modules = $this->getUserModules($user);

        $farmData = $user->farm ? [
            'id' => (int) $user->farm->id,
            'code' => $user->farm->code,
            'name' => $user->farm->name,
            'sector' => $user->farm->sector,
            'location' => $user->farm->location,
            'is_active' => (bool) $user->farm->is_active,
        ] : null;

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'lastname' => $user->lastname,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                    'farm_id' => $user->farm_id ? (int) $user->farm_id : null,
                    'farm' => $farmData,
                    'is_active' => (bool) $user->is_active,
                    'created_at' => $user->created_at,
                ],
                'farm' => $farmData,
                'modules' => $modules,
            ]
        ], Response::HTTP_OK);
    }

    /**
     * Update authenticated user profile (Name, Email, Password).
     */
    public function updateProfile(Request $request)
    {
        $user = Auth::guard('api')->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:6',
        ], [
            'name.required' => 'El nombre no puede estar vacío.',
            'email.required' => 'El correo electrónico no puede estar vacío.',
            'email.unique' => 'Este correo ya se encuentra en uso por otro usuario.',
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
            $user->name = $request->name;
        }

        if ($request->has('email')) {
            $user->email = $request->email;
        }

        if ($request->filled('password')) {
            $user->password_hash = Hash::make($request->password);
        }

        $user->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Perfil actualizado correctamente.',
            'data' => [
                'user' => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'farm_id' => $user->farm_id ? (int) $user->farm_id : null,
                    'is_active' => (bool) $user->is_active,
                ]
            ]
        ], Response::HTTP_OK);
    }

    /**
     * Refresh JWT token.
     */
    public function refresh()
    {
        try {
            $newToken = Auth::guard('api')->refresh();
            return response()->json([
                'status' => 'success',
                'message' => 'Token renovado con éxito.',
                'data' => [
                    'access_token' => $newToken,
                    'token_type' => 'bearer',
                    'expires_in' => Auth::guard('api')->factory()->getTTL() * 60,
                ]
            ], Response::HTTP_OK);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se pudo renovar el token. Token inválido o ha expirado definitivamente.',
            ], Response::HTTP_UNAUTHORIZED);
        }
    }

    /**
     * Log the user out (Invalidate the token).
     */
    public function logout()
    {
        try {
            Auth::guard('api')->logout();
            return response()->json([
                'status' => 'success',
                'message' => 'Sesión cerrada correctamente.',
            ], Response::HTTP_OK);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error al cerrar sesión.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Format JWT token response.
     */
    protected function createNewTokenResponse(string $token)
    {
        $user = Auth::guard('api')->user();
        $modules = $this->getUserModules($user);

        $farmData = $user->farm ? [
            'id' => (int) $user->farm->id,
            'code' => $user->farm->code,
            'name' => $user->farm->name,
            'sector' => $user->farm->sector,
            'location' => $user->farm->location,
            'is_active' => (bool) $user->farm->is_active,
        ] : null;

        return response()->json([
            'status' => 'success',
            'message' => 'Autenticación exitosa.',
            'data' => [
                'access_token' => $token,
                'token_type' => 'bearer',
                'expires_in' => Auth::guard('api')->factory()->getTTL() * 60,
                'user' => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'lastname' => $user->lastname,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                    'farm_id' => $user->farm_id ? (int) $user->farm_id : null,
                    'farm' => $farmData,
                    'is_active' => (bool) $user->is_active,
                ],
                'farm' => $farmData,
                'modules' => $modules,
            ]
        ], Response::HTTP_OK);
    }

    /**
     * Get accessible modules for authenticated user.
     */
    public function userModules()
    {
        $user = Auth::guard('api')->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (($user->isAdmin() || $user->isSubordinate()) && !$user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'El usuario no tiene una granja asignada.',
            ], Response::HTTP_FORBIDDEN);
        }

        $modules = $this->getUserModules($user) ?: [];

        return response()->json([
            'status' => 'success',
            'message' => 'Módulos de usuario obtenidos con éxito.',
            'modules' => $modules,
            'data' => $modules,
        ], Response::HTTP_OK);
    }

    /**
     * Get accessible modules list for a user with uniform structure and clear is_enabled boolean.
     * Performs direct SQL JOIN on farm_modules using Auth::user()->farm_id.
     */
    protected function getUserModules(User $user)
    {
        if ($user->isRoot()) {
            return Module::all()->map(function ($module) {
                return [
                    'id' => (int) $module->id,
                    'code' => $module->code,
                    'name' => $module->name,
                    'description' => $module->description,
                    'is_enabled' => true,
                ];
            });
        }

        if ($user->isAdmin() && $user->farm_id) {
            \App\Models\Farm::ensureDefaultModules($user->farm_id);

            return \Illuminate\Support\Facades\DB::table('modules')
                ->leftJoin('farm_modules', function ($join) use ($user) {
                    $join->on('modules.id', '=', 'farm_modules.module_id')
                         ->where('farm_modules.farm_id', '=', $user->farm_id);
                })
                ->select(
                    'modules.id',
                    'modules.code',
                    'modules.name',
                    'modules.description',
                    \Illuminate\Support\Facades\DB::raw('COALESCE(farm_modules.is_enabled, false) as is_enabled')
                )
                ->get()
                ->map(function ($mod) {
                    return [
                        'id' => (int) $mod->id,
                        'code' => $mod->code,
                        'name' => $mod->name,
                        'description' => $mod->description,
                        'is_enabled' => (bool) $mod->is_enabled,
                    ];
                });
        }

        if ($user->isSubordinate() && $user->farm_id) {
            \App\Models\Farm::ensureDefaultModules($user->farm_id);

            return \Illuminate\Support\Facades\DB::table('modules')
                ->leftJoin('farm_modules', function ($join) use ($user) {
                    $join->on('modules.id', '=', 'farm_modules.module_id')
                         ->where('farm_modules.farm_id', '=', $user->farm_id);
                })
                ->leftJoin('subordinate_modules', function ($join) use ($user) {
                    $join->on('modules.id', '=', 'subordinate_modules.module_id')
                         ->where('subordinate_modules.user_id', '=', $user->id);
                })
                ->select(
                    'modules.id',
                    'modules.code',
                    'modules.name',
                    'modules.description',
                    \Illuminate\Support\Facades\DB::raw('(COALESCE(farm_modules.is_enabled, false) AND COALESCE(subordinate_modules.is_enabled, false)) as is_enabled')
                )
                ->get()
                ->map(function ($mod) {
                    return [
                        'id' => (int) $mod->id,
                        'code' => $mod->code,
                        'name' => $mod->name,
                        'description' => $mod->description,
                        'is_enabled' => (bool) $mod->is_enabled,
                    ];
                });
        }

        return [];
    }
}
