import 'package:flutter/material.dart';
import '../data/models/notification_model.dart';
import '../data/repositories/notification_repository.dart';

class NotificationProvider extends ChangeNotifier {
  final NotificationRepository _repository;

  bool _isLoading = false;
  List<NotificationModel> _notifications = [];

  NotificationProvider({NotificationRepository? repository})
      : _repository = repository ?? NotificationRepository();

  bool get isLoading => _isLoading;
  List<NotificationModel> get notifications => _notifications;

  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  Future<void> loadNotifications() async {
    _isLoading = true;
    notifyListeners();

    try {
      _notifications = await _repository.getNotifications();
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> markAllAsRead() async {
    await _repository.markAllAsRead();
    for (var i = 0; i < _notifications.length; i++) {
      _notifications[i] = NotificationModel(
        id: _notifications[i].id,
        title: _notifications[i].title,
        message: _notifications[i].message,
        isRead: true,
        createdAt: _notifications[i].createdAt,
      );
    }
    notifyListeners();
  }
}

