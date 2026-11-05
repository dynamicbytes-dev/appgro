import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';

class AnalyticsRepository {
  final ApiClient _apiClient;

  AnalyticsRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<Map<String, dynamic>> getSummary() async {
    final response = await _apiClient.get('${ApiEndpoints.baseUrl}/analytics/summary');
    if (response is Map<String, dynamic> && response['data'] != null) {
      return response['data'] as Map<String, dynamic>;
    }
    return response is Map<String, dynamic> ? response : {};
  }

  Future<Map<String, dynamic>> getFinancial() async {
    final response = await _apiClient.get('${ApiEndpoints.baseUrl}/analytics/financial');
    if (response is Map<String, dynamic> && response['data'] != null) {
      return response['data'] as Map<String, dynamic>;
    }
    return response is Map<String, dynamic> ? response : {};
  }

  Future<Map<String, dynamic>> getOperations() async {
    final response = await _apiClient.get('${ApiEndpoints.baseUrl}/analytics/operations');
    if (response is Map<String, dynamic> && response['data'] != null) {
      return response['data'] as Map<String, dynamic>;
    }
    return response is Map<String, dynamic> ? response : {};
  }

  Future<Map<String, dynamic>> getStaff() async {
    final response = await _apiClient.get('${ApiEndpoints.baseUrl}/analytics/staff');
    if (response is Map<String, dynamic> && response['data'] != null) {
      return response['data'] as Map<String, dynamic>;
    }
    return response is Map<String, dynamic> ? response : {};
  }
}

