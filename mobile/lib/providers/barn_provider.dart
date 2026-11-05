import 'package:flutter/material.dart';
import '../data/models/galpon_model.dart';
import '../data/repositories/barn_repository.dart';

class BarnProvider extends ChangeNotifier {
  final BarnRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<GalponModel> _galpones = [];

  BarnProvider({BarnRepository? repository})
      : _repository = repository ?? BarnRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<GalponModel> get galpones => _galpones;

  Future<void> loadGalpones() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _galpones = await _repository.getGalpones();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createGalpon(Map<String, dynamic> payload) async {
    try {
      final g = await _repository.createGalpon(payload);
      _galpones.insert(0, g);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> recordEggHarvest(int galponId, Map<String, dynamic> payload) async {
    try {
      await _repository.recordEggProduction(galponId, payload);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}

