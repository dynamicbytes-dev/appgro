import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/inventory_model.dart';

class InventoryRepository {
  final ApiClient _apiClient;

  InventoryRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<List<InventoryItemModel>> getItems() async {
    final response = await _apiClient.get(ApiEndpoints.inventoryItems);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => InventoryItemModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<InventoryItemModel> createItem(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.inventoryItems, body: payload);
    final data = response['data'] ?? response;
    return InventoryItemModel.fromJson(data);
  }

  Future<void> recordMovement(Map<String, dynamic> payload) async {
    await _apiClient.post(ApiEndpoints.inventoryMovements, body: payload);
  }
}

