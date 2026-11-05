import 'package:flutter/material.dart';
import '../data/models/inventory_model.dart';
import '../data/models/supplier_model.dart';
import '../data/models/warehouse_model.dart';
import '../data/repositories/inventory_repository.dart';

class InventoryProvider extends ChangeNotifier {
  final InventoryRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<InventoryItemModel> _items = [];
  List<Map<String, dynamic>> _movements = [];
  List<WarehouseModel> _warehouses = [];
  List<SupplierModel> _suppliers = [];

  InventoryProvider({InventoryRepository? repository})
      : _repository = repository ?? InventoryRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<InventoryItemModel> get items => _items;
  List<Map<String, dynamic>> get movements => _movements;
  List<WarehouseModel> get warehouses => _warehouses;
  List<SupplierModel> get suppliers => _suppliers;

  List<InventoryItemModel> get lowStockItems =>
      _items.where((i) => i.isLowStock).toList();

  Future<void> loadItems() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _repository.getItems(),
        _repository.getMovements(),
        _repository.getWarehouses(),
        _repository.getSuppliers(),
      ]);

      _items = results[0] as List<InventoryItemModel>;
      _movements = results[1] as List<Map<String, dynamic>>;
      _warehouses = results[2] as List<WarehouseModel>;
      _suppliers = results[3] as List<SupplierModel>;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createItem(Map<String, dynamic> payload) async {
    try {
      final item = await _repository.createItem(payload);
      _items.insert(0, item);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateItem(int id, Map<String, dynamic> payload) async {
    try {
      final updated = await _repository.updateItem(id, payload);
      final idx = _items.indexWhere((i) => i.id == id);
      if (idx != -1) {
        _items[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteItem(int id) async {
    try {
      await _repository.deleteItem(id);
      _items.removeWhere((i) => i.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> recordMovement(Map<String, dynamic> payload) async {
    try {
      await _repository.recordMovement(payload);
      await loadItems();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> createWarehouse(Map<String, dynamic> payload) async {
    try {
      final w = await _repository.createWarehouse(payload);
      _warehouses.insert(0, w);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateWarehouse(int id, Map<String, dynamic> payload) async {
    try {
      final updated = await _repository.updateWarehouse(id, payload);
      final idx = _warehouses.indexWhere((w) => w.id == id);
      if (idx != -1) {
        _warehouses[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteWarehouse(int id) async {
    try {
      await _repository.deleteWarehouse(id);
      _warehouses.removeWhere((w) => w.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> createSupplier(Map<String, dynamic> payload) async {
    try {
      final s = await _repository.createSupplier(payload);
      _suppliers.insert(0, s);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateSupplier(int id, Map<String, dynamic> payload) async {
    try {
      final updated = await _repository.updateSupplier(id, payload);
      final idx = _suppliers.indexWhere((s) => s.id == id);
      if (idx != -1) {
        _suppliers[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteSupplier(int id) async {
    try {
      await _repository.deleteSupplier(id);
      _suppliers.removeWhere((s) => s.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
