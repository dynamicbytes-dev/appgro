import 'package:flutter/material.dart';
import '../data/models/lot_model.dart';
import '../data/models/lote_animal_model.dart';
import '../data/repositories/lot_repository.dart';

class LotProvider extends ChangeNotifier {
  final LotRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<LotModel> _lots = [];
  List<LoteAnimalModel> _currentLotAnimals = [];

  LotProvider({LotRepository? repository})
      : _repository = repository ?? LotRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<LotModel> get lots => _lots;
  List<LoteAnimalModel> get currentLotAnimals => _currentLotAnimals;

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

  Future<bool> updateLot(int id, Map<String, dynamic> payload) async {
    try {
      final updated = await _repository.updateLot(id, payload);
      final idx = _lots.indexWhere((l) => l.id == id);
      if (idx != -1) {
        _lots[idx] = updated;
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
      final updated = await _repository.toggleLotStatus(id);
      final idx = _lots.indexWhere((l) => l.id == id);
      if (idx != -1) {
        _lots[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteLot(int id) async {
    try {
      await _repository.deleteLot(id);
      _lots.removeWhere((l) => l.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> loadLotAnimals(int lotId) async {
    _isLoading = true;
    _currentLotAnimals = [];
    notifyListeners();

    try {
      _currentLotAnimals = await _repository.getLotAnimals(lotId);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createAnimal(int lotId, Map<String, dynamic> payload) async {
    try {
      final a = await _repository.createAnimal(lotId, payload);
      _currentLotAnimals.insert(0, a);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteAnimal(int animalId) async {
    try {
      await _repository.deleteAnimal(animalId);
      _currentLotAnimals.removeWhere((a) => a.id == animalId);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> recordHarvest(int lotId, int qty, String notes) async {
    try {
      await _repository.recordHarvest(lotId, qty, notes);
      await loadLots();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
