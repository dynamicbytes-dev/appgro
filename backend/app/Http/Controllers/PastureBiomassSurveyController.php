<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesPotrero;
use App\Models\PastureBiomassSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fase 2: historial de aforo de forraje del potrero
 * (altura de entrada/salida y disponibilidad de materia seca).
 */
class PastureBiomassSurveyController extends Controller
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

        $surveys = PastureBiomassSurvey::query()
            ->where('potrero_id', $resolved->id)
            ->orderByDesc('surveyed_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $surveys,
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

        $survey = PastureBiomassSurvey::create([
            'farm_id' => $resolved->farm_id,
            'potrero_id' => $resolved->id,
            'surveyed_at' => $request->input('surveyed_at'),
            'entry_height_cm' => $request->filled('entry_height_cm') ? (float) $request->entry_height_cm : null,
            'exit_height_cm' => $request->filled('exit_height_cm') ? (float) $request->exit_height_cm : null,
            'biomass_kg_dm_ha' => $request->filled('biomass_kg_dm_ha') ? (float) $request->biomass_kg_dm_ha : null,
            'notes' => $request->filled('notes') ? trim((string) $request->notes) : null,
            'user_id' => $user->id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Aforo registrado correctamente.',
            'data' => $survey,
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, $potrero, $survey)
    {
        $user = $this->resolveUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $resolved = $this->resolvePotrero($potrero, $user);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $record = $this->findSurvey($resolved, $survey);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $validator = $this->validatePayload($request, true);

        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        if ($request->has('surveyed_at')) {
            $record->surveyed_at = $request->input('surveyed_at');
        }
        if ($request->has('entry_height_cm')) {
            $record->entry_height_cm = $request->filled('entry_height_cm') ? (float) $request->entry_height_cm : null;
        }
        if ($request->has('exit_height_cm')) {
            $record->exit_height_cm = $request->filled('exit_height_cm') ? (float) $request->exit_height_cm : null;
        }
        if ($request->has('biomass_kg_dm_ha')) {
            $record->biomass_kg_dm_ha = $request->filled('biomass_kg_dm_ha') ? (float) $request->biomass_kg_dm_ha : null;
        }
        if ($request->has('notes')) {
            $record->notes = $request->filled('notes') ? trim((string) $request->notes) : null;
        }

        $record->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Aforo actualizado correctamente.',
            'data' => $record,
        ], Response::HTTP_OK);
    }

    public function destroy($potrero, $survey)
    {
        $user = $this->resolveUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $resolved = $this->resolvePotrero($potrero, $user);
        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $record = $this->findSurvey($resolved, $survey);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $record->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Aforo eliminado correctamente.',
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

    private function findSurvey($potrero, $id)
    {
        $record = PastureBiomassSurvey::query()
            ->where('potrero_id', $potrero->id)
            ->where('id', (int) $id)
            ->first();

        if (! $record) {
            return response()->json([
                'status' => 'error',
                'message' => 'Aforo no encontrado para este potrero.',
            ], Response::HTTP_NOT_FOUND);
        }

        return $record;
    }

    private function validatePayload(Request $request, bool $partial = false)
    {
        $presence = $partial ? ['sometimes', 'required'] : ['required'];

        return Validator::make($request->all(), [
            'surveyed_at' => array_merge($presence, ['date']),
            'entry_height_cm' => 'nullable|numeric|min:0|max:9999.99',
            'exit_height_cm' => 'nullable|numeric|min:0|max:9999.99',
            'biomass_kg_dm_ha' => 'nullable|numeric|min:0|max:99999999.99',
            'notes' => 'nullable|string|max:2000',
        ], [
            'surveyed_at.required' => 'La fecha del aforo es obligatoria.',
            'surveyed_at.date' => 'La fecha del aforo no es válida.',
            'entry_height_cm.numeric' => 'La altura de entrada debe ser un valor numérico.',
            'exit_height_cm.numeric' => 'La altura de salida debe ser un valor numérico.',
            'biomass_kg_dm_ha.numeric' => 'La disponibilidad de forraje debe ser un valor numérico.',
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
