import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/activity_model.dart';

class ActivityRepository {
  final ApiClient _apiClient;

  ActivityRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<ActivityModel>> getActivities({bool myActivitiesOnly = false}) async {
    final url = myActivitiesOnly
        ? '${ApiEndpoints.activities}?my_activities=1'
        : ApiEndpoints.activities;

    final response = await _apiClient.get(url);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => ActivityModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ActivityModel> createActivity({
    required String title,
    String? description,
    int? assignedTo,
    String? dueDate,
  }) async {
    final response = await _apiClient.post(
      ApiEndpoints.activities,
      body: {
        'title': title,
        if (description != null) 'description': description,
        if (assignedTo != null) 'assigned_to': assignedTo,
        if (dueDate != null) 'due_date': dueDate,
        'status': 'pendiente',
      },
    );

    final data = response['data'] ?? response;
    return ActivityModel.fromJson(data);
  }

  Future<ActivityModel> updateActivityStatus({
    required int id,
    required String status,
  }) async {
    final response = await _apiClient.put(
      ApiEndpoints.activityDetail(id),
      body: {'status': status},
    );

    final data = response['data'] ?? response;
    return ActivityModel.fromJson(data);
  }
}

