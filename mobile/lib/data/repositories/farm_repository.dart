import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/user_model.dart';

class FarmRepository {
  final ApiClient _apiClient;

  FarmRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<Map<String, dynamic>> getDashboard() async {
    final response = await _apiClient.get(ApiEndpoints.adminDashboard);
    if (response is Map<String, dynamic> && response['data'] != null) {
      return response['data'] as Map<String, dynamic>;
    }
    return response is Map<String, dynamic> ? response : {};
  }

  Future<List<UserModel>> getSubordinates() async {
    final response = await _apiClient.get(ApiEndpoints.adminSubordinates);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList.map((item) => UserModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<UserModel> createSubordinate(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.adminSubordinates, body: payload);
    final data = response['data'] ?? response;
    return UserModel.fromJson(data);
  }
}

