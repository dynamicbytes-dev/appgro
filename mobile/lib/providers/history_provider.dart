import 'package:flutter/material.dart';
import '../data/models/history_log_model.dart';
import '../data/repositories/history_repository.dart';

class HistoryProvider extends ChangeNotifier {
  final HistoryRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<HistoryLogModel> _logs = [];

  HistoryProvider({HistoryRepository? repository})
      : _repository = repository ?? HistoryRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<HistoryLogModel> get logs => _logs;

  Future<void> loadLogs() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _logs = await _repository.getLogs();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

