import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/potrero_model.dart';

class PotreroRepository {
  final ApiClient _apiClient;

  PotreroRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<PotreroModel>> getPotreros() async {
    final response = await _apiClient.get(ApiEndpoints.potreros);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => PotreroModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<PotreroModel> createPotrero(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.potreros, body: payload);
    final data = response['data'] ?? response;
    return PotreroModel.fromJson(data);
  }
}

