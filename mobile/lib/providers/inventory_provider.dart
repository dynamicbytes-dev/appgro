import 'package:flutter/material.dart';
import '../data/models/inventory_model.dart';
import '../data/repositories/inventory_repository.dart';

class InventoryProvider extends ChangeNotifier {
  final InventoryRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<InventoryItemModel> _items = [];

  InventoryProvider({InventoryRepository? repository})
      : _repository = repository ?? InventoryRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<InventoryItemModel> get items => _items;

  List<InventoryItemModel> get lowStockItems =>
      _items.where((i) => i.isLowStock).toList();

  Future<void> loadItems() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _items = await _repository.getItems();
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
}

