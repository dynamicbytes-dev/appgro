import 'package:shared_preferences/shared_preferences.dart';

class ApiEndpoints {
  // Con 'adb reverse tcp:8000 tcp:8000', el celular físico accede directamente
  // a la API de la Mac usando localhost:8000 a través del cable USB.
  // También se puede usar la IP Wi-Fi de la Mac: http://192.168.1.11:8000/api/v1
  static String baseUrl = 'http://localhost:8000/api/v1';

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString('custom_server_url');
      if (savedUrl != null && savedUrl.trim().isNotEmpty) {
        baseUrl = savedUrl.trim();
      }
    } catch (_) {}
  }

  static Future<void> setBaseUrl(String url) async {
    baseUrl = url.trim();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('custom_server_url', baseUrl);
    } catch (_) {}
  }

  // Auth
  static String get login => '$baseUrl/auth/login';
  static String get logout => '$baseUrl/auth/logout';
  static String get me => '$baseUrl/auth/me';
  static String get refresh => '$baseUrl/auth/refresh';
  static String get modules => '$baseUrl/auth/modules';
  static String get profile => '$baseUrl/auth/profile';

  // Root
  static String get rootStats => '$baseUrl/root/stats';
  static String get rootFarms => '$baseUrl/root/farms';
  static String get rootAdmins => '$baseUrl/root/admins';
  static String rootFarmModules(int farmId) => '$baseUrl/root/farms/$farmId/modules';

  // Admin
  static String get adminDashboard => '$baseUrl/admin/dashboard';
  static String get adminSubordinates => '$baseUrl/admin/subordinates';

  // Modules
  static String get potreros => '$baseUrl/potreros';
  static String get lots => '$baseUrl/lots';
  static String lotAnimals(int lotId) => '$baseUrl/lots/$lotId/animals';
  static String get species => '$baseUrl/species';
  static String get galpones => '$baseUrl/galpones';
  static String galponEggs(int galponId) => '$baseUrl/galpones/$galponId/eggs';
  static String get inventoryItems => '$baseUrl/inventory/items';
  static String get inventoryMovements => '$baseUrl/inventory/movements';
  static String get inventoryWarehouses => '$baseUrl/inventory/warehouses';
  static String get activities => '$baseUrl/activities';
  static String activityDetail(int id) => '$baseUrl/activities/$id';
}
