import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/notification_model.dart';

class NotificationRepository {
  final ApiClient _apiClient;

  NotificationRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<NotificationModel>> getNotifications() async {
    try {
      final response = await _apiClient.get('${ApiEndpoints.baseUrl}/notifications');
      final rawList = response is Map<String, dynamic> && response['data'] is List
          ? response['data'] as List
          : (response is List ? response : []);

      return rawList
          .map((item) => NotificationModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _apiClient.post('${ApiEndpoints.baseUrl}/notifications/read-all');
    } catch (_) {}
  }
}

