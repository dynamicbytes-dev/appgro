<?php

namespace App\Http\Controllers;

use App\Models\AnimalService;
use App\Models\Lot;
use App\Models\LoteAnimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Controlador de Gestión Integral de Cerdos / Animales Individuales por Lote (Zootika).
 *
 * Alimenta el modal "Animales del Lote" y los endpoints de registros porcinos (`/api/pigs`).
 * Garantiza la inclusión de:
 * 1. Identificación y características físicas (`id`, `code`, `ear_tag`, `breed`, `sex`, `status`, `birth_date`, `entry_date`, `weight`, `teats_count`).
 * 2. Datos reproductivos (`farrowings_count`, `born_alive`, `born_dead`, `weaned_count`, `reproductive_summary`).
 * 3. Resumen financiero y sanitario (`accumulated_cost`, `health_controls`, `observations`, `financial_summary`, `health_summary`).
 */
class PigController extends Controller
{
    /**
     * Obtener el usuario autenticado.
     */
    protected function currentUser()
    {
        return Auth::user();
    }

    /**
     * Listar animales individuales (cerdos) con filtros y aislamiento multigranja.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->currentUser();

        $query = LoteAnimal::with(['lote', 'services']);

        // Aislamiento multigranja explícito
        if ($user && ! $user->isRoot() && ! empty($user->farm_id)) {
            $query->whereHas('lote', function ($q) use ($user) {
                $q->where('lots.farm_id', $user->farm_id);
            });
        } elseif ($request->filled('farm_id')) {
            $farmId = (int) $request->farm_id;
            $query->whereHas('lote', function ($q) use ($farmId) {
                $q->where('lots.farm_id', $farmId);
            });
        }

        // Filtro por lote específico
        if ($request->filled('lot_id')) {
            $query->where('lote_id', (int) $request->lot_id);
        } elseif ($request->filled('lote_id')) {
            $query->where('lote_id', (int) $request->lote_id);
        }

        // Filtro por estado
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filtro por género / sexo
        if ($request->filled('gender')) {
            $query->where('gender', $request->gender);
        } elseif ($request->filled('sex')) {
            $query->where('gender', $request->sex);
        }

        // Filtro por raza
        if ($request->filled('breed')) {
            $query->where('breed', 'like', '%'.trim($request->breed).'%');
        }

        // Búsqueda general
        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($term) {
                $q->where('identifier', 'like', $term)
                    ->orWhere('breed', 'like', $term)
                    ->orWhere('notes', 'like', $term);
            });
        }

        $pigs = $query->orderByDesc('created_at')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Registros de animales porcinos obtenidos con éxito.',
            'data' => $pigs,
            'total' => $pigs->count(),
            'total_animals' => $pigs->count(),
        ], Response::HTTP_OK);
    }

    /**
     * Obtener el detalle completo de un cerdo por su ID o Identificador (arete / code).
     */
    public function show(Request $request, $id): JsonResponse
    {
        $user = $this->currentUser();

        $query = LoteAnimal::with(['lote', 'services']);

        if (is_numeric($id)) {
            $animal = $query->where('id', (int) $id)->first();
        } else {
            $animal = $query->where('identifier', (string) $id)->first();
        }

        if (! $animal) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cerdo no encontrado o sin acceso en esta granja.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($user && ! $user->isRoot() && $animal->lote && (int) $animal->lote->farm_id !== (int) $user->farm_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Acceso denegado: El animal pertenece a otra granja.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Detalle del cerdo obtenido con éxito.',
            'data' => $animal,
        ], Response::HTTP_OK);
    }

    /**
     * Registrar un nuevo animal individual.
     */
    public function store(Request $request): JsonResponse
    {
        $lotId = $request->input('lot_id', $request->input('lote_id'));

        if (! $lotId) {
            return response()->json([
                'status' => 'error',
                'message' => 'El lote es obligatorio para registrar un cerdo.',
                'errors' => ['lot_id' => ['El ID del lote es obligatorio.']],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $lotController = app(LotController::class);

        return $lotController->storeAnimal($request, $lotId);
    }

    /**
     * Actualizar los atributos de un cerdo individual.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $lotController = app(LotController::class);

        return $lotController->updateAnimal($request, $id);
    }

    /**
     * Eliminar un registro de cerdo individual (si no tiene servicios).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $lotController = app(LotController::class);

        return $lotController->destroyAnimal($id);
    }

    /**
     * Estadísticas generales de los cerdos de la granja activa.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $this->currentUser();

        $query = LoteAnimal::query();

        if ($user && ! $user->isRoot() && ! empty($user->farm_id)) {
            $query->whereHas('lote', function ($q) use ($user) {
                $q->where('lots.farm_id', $user->farm_id);
            });
        }

        $allPigs = $query->with('services')->get();

        $totalPigs = $allPigs->count();
        $females = $allPigs->where('gender', LoteAnimal::GENDER_FEMALE)->count();
        $males = $allPigs->where('gender', LoteAnimal::GENDER_MALE)->count();
        $active = $allPigs->where('status', LoteAnimal::STATUS_ACTIVE)->count();
        $gestating = $allPigs->where('status', LoteAnimal::STATUS_GESTATION)->count();
        $harvested = $allPigs->whereIn('status', ['cosechado', 'vendido'])->count();

        $totalBornAlive = $allPigs->sum('born_alive');
        $totalBornDead = $allPigs->sum('born_dead');
        $totalWeaned = $allPigs->sum('weaned_count');
        $totalAccumulatedCost = round($allPigs->sum('accumulated_cost'), 2);

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_pigs' => $totalPigs,
                'females' => $females,
                'males' => $males,
                'active' => $active,
                'gestating' => $gestating,
                'harvested' => $harvested,
                'total_born_alive' => $totalBornAlive,
                'total_born_dead' => $totalBornDead,
                'total_weaned' => $totalWeaned,
                'total_accumulated_cost' => $totalAccumulatedCost,
            ],
        ], Response::HTTP_OK);
    }
}
