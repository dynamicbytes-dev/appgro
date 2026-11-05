import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../models/user_model.dart';

class AuthRepository {
  final ApiClient _apiClient;

  AuthRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<UserModel> login(String email, String password) async {
    final response = await _apiClient.post(
      ApiEndpoints.login,
      body: {
        'email': email.trim(),
        'password': password,
      },
    );

    final data = response['data'];
    final token = data['access_token'] as String;
    final user = UserModel.fromJson(data['user']);

    await TokenStorage.saveToken(token);
    await TokenStorage.saveUser(user);

    if (data['modules'] is List) {
      final moduleList = (data['modules'] as List)
          .map((m) => m is Map ? (m['code'] ?? '').toString() : m.toString())
          .where((m) => m.isNotEmpty)
          .toList();
      await TokenStorage.saveModules(moduleList);
    }

    return user;
  }

  Future<UserModel?> getProfile() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.me);
      final data = response['data'];
      final user = UserModel.fromJson(data['user']);
      await TokenStorage.saveUser(user);
      return user;
    } catch (_) {
      return await TokenStorage.getUser();
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.post(ApiEndpoints.logout);
    } catch (_) {}
    await TokenStorage.clearAll();
  }
}

