<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

/**
 * Base de los catálogos auxiliares del módulo Inventario
 * (proveedores y bodegas).
 *
 *  - `index`   → cualquier rol de la granja (root ve todas o filtra).
 *  - `store`   → solo admin/root.
 *  - `update`  → solo admin de la granja o root.
 *  - `destroy` → solo admin de la granja o root (desenlaza insumos).
 */
abstract class InventoryCatalogController extends Controller
{
    /** @return class-string<Model> */
    abstract protected function modelClass(): string;

    /** Campos editables del catálogo. */
    abstract protected function dataFields(): array;

    /** Reglas de validación (con unicidad por granja). */
    abstract protected function rules(Request $request, bool $isCreate, ?int $farmId, $ignoreId = null): array;

    /** Columna de `inventory_items` que referencia este catálogo. */
    abstract protected function itemsForeignKey(): string;

    /** Etiqueta singular legible (p. ej. 'proveedor', 'bodega'). */
    abstract protected function label(): string;

    public function index(Request $request)
    {
        $user = $this->currentUser();

        if (! $user) {
            return $this->error('Usuario no autenticado.', Response::HTTP_UNAUTHORIZED);
        }

        $model = $this->modelClass();
        $query = $model::query()->with('farm:id,name')->withCount('items');

        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?? $request->input('farmId');
            if ($farmId !== null && $farmId !== '' && strtolower(trim((string) $farmId)) !== 'all') {
                $query->where('farm_id', (int) $farmId);
            }
        } else {
            if (! $user->farm_id) {
                return $this->error('Usuario sin granja asignada.', Response::HTTP_FORBIDDEN);
            }

            $query->where('farm_id', (int) $user->farm_id)->whereNotNull('farm_id');
        }

        if ($request->filled('search')) {
            $term = '%'.trim($request->search).'%';
            $query->where('name', 'like', $term);
        }

        if ($request->has('is_active')
            && $request->input('is_active') !== ''
            && $request->input('is_active') !== null) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $data = $query->orderBy('name')->get()
            ->map(fn ($row) => $this->decorate($row))
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => "Lista de {$this->label()}s obtenida con éxito.",
            'data' => $data,
        ], Response::HTTP_OK);
    }

    public function store(Request $request)
    {
        $user = $this->currentUser();

        if (! $user) {
            return $this->error('Usuario no autenticado.', Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->isRoot() && ! $user->isAdmin()) {
            return $this->error(
                "Acceso denegado: solo el administrador puede gestionar {$this->label()}s.",
                Response::HTTP_FORBIDDEN
            );
        }

        $farmId = $this->resolveFarmId($request, $user);

        if (! $farmId) {
            return $this->error(
                "Debe especificar la granja (farm_id) para registrar el {$this->label()}.",
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $validator = Validator::make($request->all(), $this->rules($request, true, (int) $farmId));

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $model = $this->modelClass();
        $record = $model::create(array_merge($this->attributesFromRequest($request, true), [
            'farm_id' => (int) $farmId,
            'created_by' => $user->id,
        ]));

        return response()->json([
            'status' => 'success',
            'message' => ucfirst($this->label()).' registrado correctamente.',
            'data' => $this->decorate($record),
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, $id)
    {
        $user = $this->currentUser();

        $model = $this->modelClass();
        $record = $model::find($id);

        if (! $record) {
            return $this->error(ucfirst($this->label()).' no encontrado o sin acceso.', Response::HTTP_NOT_FOUND);
        }

        if (! $this->canManage($user, $record)) {
            return $this->error(
                "Acceso denegado: solo el administrador de la granja puede editar {$this->label()}s.",
                Response::HTTP_FORBIDDEN
            );
        }

        $validator = Validator::make(
            $request->all(),
            $this->rules($request, false, (int) $record->farm_id, $record->id)
        );

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $record->fill($this->attributesFromRequest($request, false));
        $record->save();

        return response()->json([
            'status' => 'success',
            'message' => ucfirst($this->label()).' actualizado correctamente.',
            'data' => $this->decorate($record->fresh()->loadCount('items')),
        ], Response::HTTP_OK);
    }

    public function destroy($id)
    {
        $user = $this->currentUser();

        $model = $this->modelClass();
        $record = $model::find($id);

        if (! $record) {
            return $this->error(ucfirst($this->label()).' no encontrado o sin acceso.', Response::HTTP_NOT_FOUND);
        }

        if (! $this->canManage($user, $record)) {
            return $this->error(
                "Acceso denegado: solo el administrador de la granja puede eliminar {$this->label()}s.",
                Response::HTTP_FORBIDDEN
            );
        }

        DB::transaction(function () use ($record) {
            // Desenlaza los insumos que lo referencian (SET NULL manual).
            DB::table('inventory_items')
                ->where($this->itemsForeignKey(), $record->id)
                ->update([$this->itemsForeignKey() => null]);

            $record->delete();
        });

        return response()->json([
            'status' => 'success',
            'message' => ucfirst($this->label()).' eliminado correctamente.',
        ], Response::HTTP_OK);
    }

    /* ----------------------------------------------------------------- */
    /* Helpers                                                            */
    /* ----------------------------------------------------------------- */

    protected function currentUser()
    {
        return Auth::guard('api')->user() ?? Auth::user();
    }

    protected function resolveFarmId(Request $request, $user): ?int
    {
        if ($user->isRoot()) {
            $farmId = $request->input('farm_id') ?: $request->input('farmId');

            return $farmId ? (int) $farmId : null;
        }

        return $user->farm_id ? (int) $user->farm_id : null;
    }

    protected function canManage($user, $record): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->isRoot()) {
            return true;
        }

        return $user->isAdmin() && (int) $record->farm_id === (int) $user->farm_id;
    }

    protected function attributesFromRequest(Request $request, bool $isCreate): array
    {
        $data = [];

        foreach ($this->dataFields() as $field) {
            $value = $request->input($field);
            $data[$field] = is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
        }

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        } elseif ($isCreate) {
            $data['is_active'] = true;
        }

        return $data;
    }

    protected function decorate($record): array
    {
        $farmRelation = $record->relationLoaded('farm') ? $record->getRelation('farm') : null;

        return array_merge($record->toArray(), [
            'farm_name' => $farmRelation?->name,
            'farm' => $farmRelation ? ['id' => $farmRelation->id, 'name' => $farmRelation->name] : null,
        ]);
    }

    protected function error(string $message, int $status)
    {
        return response()->json(['status' => 'error', 'message' => $message], $status);
    }

    protected function validationError($errors)
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Error de validación de datos.',
            'errors' => $errors,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
