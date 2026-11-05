class ApiEndpoints {
  // En Android Emulator usar 10.0.2.2:8000, en iOS Simulator localhost:8000
  // o la IP local de la red para dispositivos físicos.
  static String baseUrl = 'http://10.0.2.2:8000/api/v1';

  // Configurar URL en tiempo de ejecución si se requiere
  static void setBaseUrl(String url) {
    baseUrl = url;
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

