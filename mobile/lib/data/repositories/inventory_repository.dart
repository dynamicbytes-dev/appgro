import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/inventory_model.dart';
import '../models/supplier_model.dart';
import '../models/warehouse_model.dart';

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

  Future<InventoryItemModel> updateItem(int id, Map<String, dynamic> payload) async {
    final response = await _apiClient.put('${ApiEndpoints.inventoryItems}/$id', body: payload);
    final data = response['data'] ?? response;
    return InventoryItemModel.fromJson(data);
  }

  Future<void> deleteItem(int id) async {
    await _apiClient.delete('${ApiEndpoints.inventoryItems}/$id');
  }

  Future<void> recordMovement(Map<String, dynamic> payload) async {
    await _apiClient.post(ApiEndpoints.inventoryMovements, body: payload);
  }

  Future<List<Map<String, dynamic>>> getMovements() async {
    final response = await _apiClient.get(ApiEndpoints.inventoryMovements);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList.map((e) => e as Map<String, dynamic>).toList();
  }

  Future<List<WarehouseModel>> getWarehouses() async {
    final response = await _apiClient.get(ApiEndpoints.inventoryWarehouses);
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => WarehouseModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<WarehouseModel> createWarehouse(Map<String, dynamic> payload) async {
    final response = await _apiClient.post(ApiEndpoints.inventoryWarehouses, body: payload);
    final data = response['data'] ?? response;
    return WarehouseModel.fromJson(data);
  }

  Future<WarehouseModel> updateWarehouse(int id, Map<String, dynamic> payload) async {
    final response = await _apiClient.put('${ApiEndpoints.inventoryWarehouses}/$id', body: payload);
    final data = response['data'] ?? response;
    return WarehouseModel.fromJson(data);
  }

  Future<void> deleteWarehouse(int id) async {
    await _apiClient.delete('${ApiEndpoints.inventoryWarehouses}/$id');
  }

  Future<List<SupplierModel>> getSuppliers() async {
    final response = await _apiClient.get('${ApiEndpoints.baseUrl}/inventory/suppliers');
    final rawList = response is Map<String, dynamic> && response['data'] is List
        ? response['data'] as List
        : (response is List ? response : []);

    return rawList
        .map((item) => SupplierModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<SupplierModel> createSupplier(Map<String, dynamic> payload) async {
    final response = await _apiClient.post('${ApiEndpoints.baseUrl}/inventory/suppliers', body: payload);
    final data = response['data'] ?? response;
    return SupplierModel.fromJson(data);
  }

  Future<SupplierModel> updateSupplier(int id, Map<String, dynamic> payload) async {
    final response = await _apiClient.put('${ApiEndpoints.baseUrl}/inventory/suppliers/$id', body: payload);
    final data = response['data'] ?? response;
    return SupplierModel.fromJson(data);
  }

  Future<void> deleteSupplier(int id) async {
    await _apiClient.delete('${ApiEndpoints.baseUrl}/inventory/suppliers/$id');
  }
}
