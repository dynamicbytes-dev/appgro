import 'package:flutter/material.dart';
import '../data/models/potrero_model.dart';
import '../data/repositories/potrero_repository.dart';

class PotreroProvider extends ChangeNotifier {
  final PotreroRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<PotreroModel> _potreros = [];

  PotreroProvider({PotreroRepository? repository})
      : _repository = repository ?? PotreroRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<PotreroModel> get potreros => _potreros;

  Future<void> loadPotreros() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _potreros = await _repository.getPotreros();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createPotrero(Map<String, dynamic> payload) async {
    try {
      final item = await _repository.createPotrero(payload);
      _potreros.insert(0, item);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}

