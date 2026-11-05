import 'package:flutter/material.dart';
import '../data/repositories/analytics_repository.dart';

class AnalyticsProvider extends ChangeNotifier {
  final AnalyticsRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic> _summary = {};
  Map<String, dynamic> _financial = {};
  Map<String, dynamic> _operations = {};
  Map<String, dynamic> _staff = {};

  AnalyticsProvider({AnalyticsRepository? repository})
      : _repository = repository ?? AnalyticsRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic> get summary => _summary;
  Map<String, dynamic> get financial => _financial;
  Map<String, dynamic> get operations => _operations;
  Map<String, dynamic> get staff => _staff;

  Future<void> loadAllAnalytics() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _repository.getSummary(),
        _repository.getFinancial(),
        _repository.getOperations(),
        _repository.getStaff(),
      ]);

      _summary = results[0];
      _financial = results[1];
      _operations = results[2];
      _staff = results[3];
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

