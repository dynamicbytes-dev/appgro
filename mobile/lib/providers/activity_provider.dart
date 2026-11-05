import 'package:flutter/material.dart';
import '../data/models/activity_model.dart';
import '../data/repositories/activity_repository.dart';

class ActivityProvider extends ChangeNotifier {
  final ActivityRepository _repository;

  bool _isLoading = false;
  String? _errorMessage;
  List<ActivityModel> _activities = [];

  ActivityProvider({ActivityRepository? repository})
      : _repository = repository ?? ActivityRepository();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<ActivityModel> get activities => _activities;

  List<ActivityModel> get pendingActivities =>
      _activities.where((a) => a.isPending).toList();

  List<ActivityModel> get inProgressActivities =>
      _activities.where((a) => a.isInProgress).toList();

  List<ActivityModel> get completedActivities =>
      _activities.where((a) => a.isCompleted).toList();

  Future<void> loadActivities({bool myActivitiesOnly = false}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _activities = await _repository.getActivities(myActivitiesOnly: myActivitiesOnly);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createActivity({
    required String title,
    String? description,
    int? assignedTo,
    String? dueDate,
  }) async {
    try {
      final act = await _repository.createActivity(
        title: title,
        description: description,
        assignedTo: assignedTo,
        dueDate: dueDate,
      );
      _activities.insert(0, act);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateActivity(int id, Map<String, dynamic> data) async {
    try {
      final updated = await _repository.updateActivity(id: id, data: data);
      final index = _activities.indexWhere((a) => a.id == id);
      if (index != -1) {
        _activities[index] = updated;
        notifyListeners();
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateStatus(int id, String newStatus) async {
    try {
      final updated = await _repository.updateActivityStatus(id: id, status: newStatus);
      final index = _activities.indexWhere((a) => a.id == id);
      if (index != -1) {
        _activities[index] = updated;
        notifyListeners();
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteActivity(int id) async {
    try {
      await _repository.deleteActivity(id);
      _activities.removeWhere((a) => a.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
