import 'package:flutter/material.dart';
import '../data/models/potrero_model.dart';
import '../data/repositories/potrero_repository.dart';

class PotreroProvider extends ChangeNotifier {
  final PotreroRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<PotreroModel> _potreros = [];
  List<Map<String, dynamic>> _currentBiomass = [];
  List<Map<String, dynamic>> _currentTreatments = [];

  PotreroProvider({PotreroRepository? repository})
      : _repository = repository ?? PotreroRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<PotreroModel> get potreros => _potreros;
  List<Map<String, dynamic>> get currentBiomass => _currentBiomass;
  List<Map<String, dynamic>> get currentTreatments => _currentTreatments;

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

  Future<bool> updatePotrero(int id, Map<String, dynamic> payload) async {
    try {
      final updated = await _repository.updatePotrero(id, payload);
      final idx = _potreros.indexWhere((p) => p.id == id);
      if (idx != -1) {
        _potreros[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> toggleStatus(int id) async {
    try {
      final updated = await _repository.togglePotreroStatus(id);
      final idx = _potreros.indexWhere((p) => p.id == id);
      if (idx != -1) {
        _potreros[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deletePotrero(int id) async {
    try {
      await _repository.deletePotrero(id);
      _potreros.removeWhere((p) => p.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> loadPotreroManagement(int potreroId) async {
    _isLoading = true;
    _currentBiomass = [];
    _currentTreatments = [];
    notifyListeners();

    try {
      final results = await Future.wait([
        _repository.getBiomassSurveys(potreroId),
        _repository.getTreatments(potreroId),
      ]);
      _currentBiomass = results[0];
      _currentTreatments = results[1];
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> recordBiomass(int potreroId, Map<String, dynamic> payload) async {
    try {
      await _repository.recordBiomassSurvey(potreroId, payload);
      await loadPotreroManagement(potreroId);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> recordTreatment(int potreroId, Map<String, dynamic> payload) async {
    try {
      await _repository.recordTreatment(potreroId, payload);
      await loadPotreroManagement(potreroId);
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
