import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/species_model.dart';

class SpeciesRepository {
  final ApiClient _apiClient;

  SpeciesRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<SpeciesModel>> getSpecies() async {
    final response = await _apiClient.get(ApiEndpoints.species);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => SpeciesModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<SpeciesModel> createSpecies(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.species, body: payload);
    final data = response['data'] ?? response;
    return SpeciesModel.fromJson(data);
  }

  Future<SpeciesModel> updateSpecies(int id, Map<String, dynamic> payload) async {
    final response = await _apiClient.put('${ApiEndpoints.species}/$id', body: payload);
    final data = response['data'] ?? response;
    return SpeciesModel.fromJson(data);
  }

  Future<void> toggleStatus(int id) async {
    await _apiClient.patch('${ApiEndpoints.species}/$id/status', body: {});
  }

  Future<void> deleteSpecies(int id) async {
    await _apiClient.delete('${ApiEndpoints.species}/$id');
  }
}
