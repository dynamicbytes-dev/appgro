import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/lot_model.dart';
import '../models/lote_animal_model.dart';

class LotRepository {
  final ApiClient _apiClient;

  LotRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<LotModel>> getLots() async {
    final response = await _apiClient.get(ApiEndpoints.lots);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => LotModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<LotModel> createLot(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.lots, body: payload);
    final data = response['data'] ?? response;
    return LotModel.fromJson(data);
  }

  Future<LotModel> updateLot(int id, Map<String, dynamic> payload) async {
    final response = await _apiClient.put('${ApiEndpoints.lots}/$id', body: payload);
    final data = response['data'] ?? response;
    return LotModel.fromJson(data);
  }

  Future<LotModel> toggleLotStatus(int id) async {
    final response = await _apiClient.patch('${ApiEndpoints.lots}/$id/status', body: {});
    final data = response['data'] ?? response;
    return LotModel.fromJson(data);
  }

  Future<void> deleteLot(int id) async {
    await _apiClient.delete('${ApiEndpoints.lots}/$id');
  }

  Future<List<LoteAnimalModel>> getLotAnimals(int lotId) async {
    final response = await _apiClient.get(ApiEndpoints.lotAnimals(lotId));
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => LoteAnimalModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<LoteAnimalModel> createAnimal(int lotId, Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.lotAnimals(lotId), body: payload);
    final data = response['data'] ?? response;
    return LoteAnimalModel.fromJson(data);
  }

  Future<void> deleteAnimal(int animalId) async {
    await _apiClient.delete('${ApiEndpoints.lots}/animals/$animalId');
  }

  Future<void> recordHarvest(int lotId, int quantity, String notes) async {
    await _apiClient.post('${ApiEndpoints.lots}/$lotId/harvest', body: {
      'quantity': quantity,
      'notes': notes,
    });
  }
}
