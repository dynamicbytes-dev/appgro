import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/farm_model.dart';
import '../models/user_model.dart';

class RootRepository {
  final ApiClient _apiClient;

  RootRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<Map<String, dynamic>> getStats() async {
    final response = await _apiClient.get(ApiEndpoints.rootStats);
    if (response is Map<String, dynamic> && response['data'] != null) {
      return response['data'] as Map<String, dynamic>;
    }
    return response is Map<String, dynamic> ? response : {};
  }

  Future<List<FarmModel>> getFarms() async {
    final response = await _apiClient.get(ApiEndpoints.rootFarms);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList.map((item) => FarmModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<UserModel>> getAdmins() async {
    final response = await _apiClient.get(ApiEndpoints.rootAdmins);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList.map((item) => UserModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<FarmModel> createFarm(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.rootFarms, body: payload);
    final data = response['data'] ?? response;
    return FarmModel.fromJson(data);
  }
}

