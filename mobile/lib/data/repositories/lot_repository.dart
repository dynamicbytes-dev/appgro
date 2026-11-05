import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/lot_model.dart';

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
}

