import 'package:flutter/material.dart';
import '../core/storage/token_storage.dart';
import '../data/models/user_model.dart';
import '../data/repositories/auth_repository.dart';

enum AuthStatus { initial, authenticated, unauthenticated, loading }

class AuthProvider extends ChangeNotifier {
  final AuthRepository _repository;

  AuthStatus _status = AuthStatus.initial;
  UserModel? _user;
  List<String> _modules = [];
  String? _errorMessage;

  AuthProvider({AuthRepository? repository})
      : _repository = repository ?? AuthRepository();

  AuthStatus get status => _status;
  UserModel? get user => _user;
  List<String> get modules => _modules;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _user != null;

  bool hasModule(String moduleCode) {
    if (_user?.isRoot == true) return true;
    return _modules.contains(moduleCode.toLowerCase());
  }

  Future<void> checkAuth() async {
    _status = AuthStatus.loading;
    notifyListeners();

    final token = await TokenStorage.getToken();
    if (token == null || token.isEmpty) {
      _status = AuthStatus.unauthenticated;
      _user = null;
      notifyListeners();
      return;
    }

    try {
      _user = await _repository.getProfile();
      _modules = await TokenStorage.getModules();
      _status = _user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
    } catch (_) {
      _status = AuthStatus.unauthenticated;
      _user = null;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _status = AuthStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      _user = await _repository.login(email, password);
      _modules = await TokenStorage.getModules();
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _status = AuthStatus.unauthenticated;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    _user = null;
    _modules = [];
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}

