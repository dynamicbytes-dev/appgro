<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesPotrero;
use App\Models\PastureTreatment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fase 2: historial de manejo agronómico del potrero
 * (fertilización, control de malezas, resiembra, riego, encalado, etc.).
 */
class PastureTreatmentController extends Controller
{
    use ResolvesPotrero;

    public function index(Request $request, $potrero)
    {
        $user = $this->resolveUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $resolved = $this->resolvePotrero($potrero, $user);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $treatments = PastureTreatment::query()
            ->where('potrero_id', $resolved->id)
            ->orderByDesc('applied_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $treatments,
        ], Response::HTTP_OK);
    }

    public function store(Request $request, $potrero)
    {
        $user = $this->resolveUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $resolved = $this->resolvePotrero($potrero, $user);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $validator = $this->validatePayload($request);

        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $treatment = PastureTreatment::create([
            'farm_id' => $resolved->farm_id,
            'potrero_id' => $resolved->id,
            'type' => $request->input('type'),
            'product' => $request->filled('product') ? trim((string) $request->product) : null,
            'dose' => $request->filled('dose') ? (float) $request->dose : null,
            'dose_unit' => $request->filled('dose_unit') ? trim((string) $request->dose_unit) : null,
            'applied_at' => $request->input('applied_at'),
            'cost' => $request->filled('cost') ? (float) $request->cost : null,
            'notes' => $request->filled('notes') ? trim((string) $request->notes) : null,
            'user_id' => $user->id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Tratamiento registrado correctamente.',
            'data' => $treatment,
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, $potrero, $treatment)
    {
        $user = $this->resolveUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $resolved = $this->resolvePotrero($potrero, $user);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $record = $this->findTreatment($resolved, $treatment);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $validator = $this->validatePayload($request, true);

        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        if ($request->has('type')) {
            $record->type = $request->input('type');
        }
        if ($request->has('product')) {
            $record->product = $request->filled('product') ? trim((string) $request->product) : null;
        }
        if ($request->has('dose')) {
            $record->dose = $request->filled('dose') ? (float) $request->dose : null;
        }
        if ($request->has('dose_unit')) {
            $record->dose_unit = $request->filled('dose_unit') ? trim((string) $request->dose_unit) : null;
        }
        if ($request->has('applied_at')) {
            $record->applied_at = $request->input('applied_at');
        }
        if ($request->has('cost')) {
            $record->cost = $request->filled('cost') ? (float) $request->cost : null;
        }
        if ($request->has('notes')) {
            $record->notes = $request->filled('notes') ? trim((string) $request->notes) : null;
        }

        $record->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Tratamiento actualizado correctamente.',
            'data' => $record,
        ], Response::HTTP_OK);
    }

    public function destroy($potrero, $treatment)
    {
        $user = $this->resolveUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $resolved = $this->resolvePotrero($potrero, $user);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $record = $this->findTreatment($resolved, $treatment);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $record->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Tratamiento eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    private function resolveUser()
    {
        $user = Auth::guard('api')->user() ?? Auth::user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Usuario no autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $user;
    }

    private function findTreatment($potrero, $id)
    {
        $record = PastureTreatment::query()
            ->where('potrero_id', $potrero->id)
            ->where('id', (int) $id)
            ->first();

        if (! $record) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tratamiento no encontrado para este potrero.',
            ], Response::HTTP_NOT_FOUND);
        }

        return $record;
    }

    private function validatePayload(Request $request, bool $partial = false)
    {
        $presence = $partial ? ['sometimes', 'required'] : ['required'];

        return Validator::make($request->all(), [
            'type' => array_merge($presence, [Rule::in(PastureTreatment::TYPES)]),
            'product' => 'nullable|string|max:255',
            'dose' => 'nullable|numeric|min:0|max:99999999.99',
            'dose_unit' => 'nullable|string|max:50',
            'applied_at' => array_merge($presence, ['date']),
            'cost' => 'nullable|numeric|min:0|max:9999999999.99',
            'notes' => 'nullable|string|max:2000',
        ], [
            'type.required' => 'El tipo de tratamiento es obligatorio.',
            'type.in' => 'El tipo de tratamiento no es válido.',
            'applied_at.required' => 'La fecha de aplicación es obligatoria.',
            'applied_at.date' => 'La fecha de aplicación no es válida.',
            'dose.numeric' => 'La dosis debe ser un valor numérico.',
            'cost.numeric' => 'El costo debe ser un valor numérico.',
        ]);
    }

    private function validationError(array $errors): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Error de validación de datos.',
            'errors' => $errors,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
