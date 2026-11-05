import 'package:flutter/material.dart';
import '../data/models/species_model.dart';
import '../data/repositories/species_repository.dart';

class SpeciesProvider extends ChangeNotifier {
  final SpeciesRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<SpeciesModel> _species = [];

  SpeciesProvider({SpeciesRepository? repository})
      : _repository = repository ?? SpeciesRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<SpeciesModel> get species => _species;

  Future<void> loadSpecies() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _species = await _repository.getSpecies();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createSpecies(Map<String, dynamic> payload) async {
    try {
      final s = await _repository.createSpecies(payload);
      _species.insert(0, s);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateSpecies(int id, Map<String, dynamic> payload) async {
    try {
      final updated = await _repository.updateSpecies(id, payload);
      final idx = _species.indexWhere((s) => s.id == id);
      if (idx != -1) {
        _species[idx] = updated;
      }
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> toggleStatus(int id) async {
    try {
      await _repository.toggleStatus(id);
      await loadSpecies();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<bool> deleteSpecies(int id) async {
    try {
      await _repository.deleteSpecies(id);
      _species.removeWhere((s) => s.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
