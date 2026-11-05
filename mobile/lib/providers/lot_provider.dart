import 'package:flutter/material.dart';
import '../data/models/lot_model.dart';
import '../data/repositories/lot_repository.dart';

class LotProvider extends ChangeNotifier {
  final LotRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<LotModel> _lots = [];

  LotProvider({LotRepository? repository})
      : _repository = repository ?? LotRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<LotModel> get lots => _lots;

  Future<void> loadLots() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _lots = await _repository.getLots();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createLot(Map<String, dynamic> payload) async {
    try {
      final lot = await _repository.createLot(payload);
      _lots.insert(0, lot);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}

