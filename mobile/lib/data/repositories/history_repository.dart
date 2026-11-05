import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/history_log_model.dart';

class HistoryRepository {
  final ApiClient _apiClient;

  HistoryRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<HistoryLogModel>> getLogs() async {
    final response = await _apiClient.get('${ApiEndpoints.baseUrl}/history');
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => HistoryLogModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}

