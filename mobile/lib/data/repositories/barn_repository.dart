import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/galpon_model.dart';

class BarnRepository {
  final ApiClient _apiClient;

  BarnRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<GalponModel>> getGalpones() async {
    final response = await _apiClient.get(ApiEndpoints.galpones);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => GalponModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<GalponModel> createGalpon(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.galpones, body: payload);
    final data = response['data'] ?? response;
    return GalponModel.fromJson(data);
  }

  Future<GalponModel> updateGalpon(int id, Map<String, dynamic> payload) async {
    final response = await _apiClient.put('${ApiEndpoints.galpones}/$id', body: payload);
    final data = response['data'] ?? response;
    return GalponModel.fromJson(data);
  }

  Future<GalponModel> toggleGalponStatus(int id) async {
    final response = await _apiClient.patch('${ApiEndpoints.galpones}/$id/status', body: {});
    final data = response['data'] ?? response;
    return GalponModel.fromJson(data);
  }

  Future<void> deleteGalpon(int id) async {
    await _apiClient.delete('${ApiEndpoints.galpones}/$id');
  }

  Future<void> recordEggProduction(int galponId, Map<String, dynamic> payload) async {
    await _apiClient.post(ApiEndpoints.galponEggs(galponId), body: payload);
  }
}
