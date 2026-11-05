import 'package:flutter/material.dart';
import '../data/models/user_model.dart';
import '../data/repositories/farm_repository.dart';

class FarmProvider extends ChangeNotifier {
  final FarmRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic> _dashboard = {};
  List<UserModel> _subordinates = [];

  FarmProvider({FarmRepository? repository})
      : _repository = repository ?? FarmRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic> get dashboard => _dashboard;
  List<UserModel> get subordinates => _subordinates;

  Future<void> loadDashboard() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _repository.getDashboard(),
        _repository.getSubordinates(),
      ]);

      _dashboard = results[0] as Map<String, dynamic>;
      _subordinates = results[1] as List<UserModel>;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createSubordinate(Map<String, dynamic> payload) async {
    try {
      final sub = await _repository.createSubordinate(payload);
      _subordinates.insert(0, sub);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}

