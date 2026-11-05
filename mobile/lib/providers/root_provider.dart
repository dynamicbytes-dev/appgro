import 'package:flutter/material.dart';
import '../data/models/farm_model.dart';
import '../data/models/user_model.dart';
import '../data/repositories/root_repository.dart';

class RootProvider extends ChangeNotifier {
  final RootRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic> _stats = {};
  List<FarmModel> _farms = [];
  List<UserModel> _admins = [];

  RootProvider({RootRepository? repository})
      : _repository = repository ?? RootRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic> get stats => _stats;
  List<FarmModel> get farms => _farms;
  List<UserModel> get admins => _admins;

  Future<void> loadRootData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _repository.getStats(),
        _repository.getFarms(),
        _repository.getAdmins(),
      ]);

      _stats = results[0] as Map<String, dynamic>;
      _farms = results[1] as List<FarmModel>;
      _admins = results[2] as List<UserModel>;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createFarm(Map<String, dynamic> payload) async {
    try {
      final farm = await _repository.createFarm(payload);
      _farms.insert(0, farm);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> createAdmin(Map<String, dynamic> payload) async {
    try {
      final admin = await _repository.createAdmin(payload);
      _admins.insert(0, admin);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> toggleAdminStatus(int id) async {
    try {
      await _repository.toggleAdminStatus(id);
      await loadRootData();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<List<Map<String, dynamic>>> getFarmModules(int farmId) async {
    return await _repository.getFarmModules(farmId);
  }

  Future<bool> updateFarmModules(int farmId, List<int> moduleIds) async {
    try {
      await _repository.updateFarmModules(farmId, moduleIds);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
