<?php

namespace App\Http\Controllers;

use App\Models\Lot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class LotController extends Controller
{
    public function index()
    {
        $lots = Lot::with('barn')->get();

        return response()->json([
            'status' => 'success',
            'data' => $lots,
        ], Response::HTTP_OK);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'barn_id' => 'required|exists:barns,id',
            'farm_id' => 'nullable|exists:farms,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'errors' => $validator->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $lot = Lot::create([
            'name' => $request->name,
            'barn_id' => $request->barn_id,
            'farm_id' => $request->farm_id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Lote registrado correctamente.',
            'data' => $lot,
        ], Response::HTTP_CREATED);
    }

    public function show($id)
    {
        $lot = Lot::with('barn')->find($id);

        if (!$lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'status' => 'success',
            'data' => $lot,
        ], Response::HTTP_OK);
    }

    public function destroy($id)
    {
        $lot = Lot::find($id);

        if (!$lot) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lote no encontrado o sin acceso.',
            ], Response::HTTP_NOT_FOUND);
        }

        $lot->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Lote eliminado correctamente.',
        ], Response::HTTP_OK);
    }
}
