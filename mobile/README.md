# 📱 AppGro Mobile — Aplicación Móvil Oficial (Flutter)

Aplicación móvil nativa multiplataforma (**Android & iOS**) para la gestión agropecuaria y ganadera de **AppGro (Zootika)**, diseñada bajo una arquitectura limpia por capas (Presentation, Domain, Data) con soporte multi-rol, autenticación JWT, sincronización REST y experiencia optimizada para trabajo en campo rural.

---

## 👥 Soporte Multi-Rol Implementado

1. **👷 Encargado / Supervisor de Campo (`encargado`)**:
   - **Bandeja "Mis Actividades"**: Seguimiento de tareas de campo (pendientes, en proceso, terminadas) con actualización táctil de estado.
   - **Registros Rápidos de Campo**:
     - *Potreros y Pastoreo*: Consulta de estados de rotación (descanso, disponible, ocupado, mantenimiento) y capacidad.
     - *Lotes de Ganado*: Control y pesaje de animales.
     - *Galpones*: Recolección y registro diario de postura de huevos y mermas.
     - *Inventario*: Registro de consumos/salidas de alimentos, medicinas y fertilizantes directamente en el lote.

2. **👔 Administrador de Finca (`admin`)**:
   - **Panel de KPIs de Granja**: Conteo de animales, potreros disponibles, insumos con stock bajo.
   - **Gestión de Personal**: Registro de nuevos encargados y supervisores de campo.
   - **Asignación de Actividades**: Creación de tareas con fecha límite y asignación a supervisores.

3. **👑 Superadministrador (`root`)**:
   - **Consola Global**: Estadísticas consolidadas de todas las fincas, clientes y hectáreas registradas.
   - **Directorio de Granjas**: Alta de nuevas fincas y configuración de módulos.

---

## 🏗️ Arquitectura Técnica

- **Lenguaje**: Dart 3.4+ / Flutter 3.22+
- **Patrón Arquitectónico**: Layered MVVM con Provider (`ChangeNotifier`) y Repository Pattern.
- **Enrutamiento**: Declarativo y protegido por roles con `go_router` (`/encargado`, `/admin`, `/root`).
- **Almacenamiento Local**: `shared_preferences` para persistencia de JWT, refresh token y perfiles de sesión.
- **Cliente HTTP**: `http` con interceptor de autenticación Bearer, mapeo de excepciones y manejo de desconexión.
- **Diseño / UI**: Material 3 con paleta agropecuaria (`emerald`, `amber`, `slate`), tipografía legible y widgets táctiles adaptados a la luz solar en campo.

---

## 📁 Estructura del Código (`mobile/lib`)

```text
mobile/lib/
├── core/
│   ├── constants/
│   │   ├── api_endpoints.dart    # URLs base y rutas de la API de Laravel
│   │   └── app_colors.dart       # Paleta de colores oficial de AppGro
│   ├── network/
│   │   ├── api_client.dart       # Cliente HTTP centralizado con token JWT
│   │   └── api_exception.dart    # Manejo estructurado de errores y conexión
│   ├── storage/
│   │   └── token_storage.dart    # Persistencia local de credenciales y usuario
│   └── theme/
│       └── app_theme.dart        # Tema visual Material 3
├── data/
│   ├── models/                   # Modelos de datos y serialización JSON
│   │   ├── user_model.dart
│   │   ├── farm_model.dart
│   │   ├── activity_model.dart
│   │   ├── potrero_model.dart
│   │   ├── lot_model.dart
│   │   ├── galpon_model.dart
│   │   └── inventory_model.dart
│   └── repositories/             # Conexión entre API y reglas de negocio
│       ├── auth_repository.dart
│       ├── farm_repository.dart
│       ├── root_repository.dart
│       ├── activity_repository.dart
│       ├── potrero_repository.dart
│       ├── lot_repository.dart
│       ├── barn_repository.dart
│       └── inventory_repository.dart
├── providers/                    # Gestión de estado (ViewModels con ChangeNotifier)
│   ├── auth_provider.dart
│   ├── farm_provider.dart
│   ├── root_provider.dart
│   ├── activity_provider.dart
│   ├── potrero_provider.dart
│   ├── lot_provider.dart
│   ├── barn_provider.dart
│   └── inventory_provider.dart
├── routing/
│   └── app_router.dart           # Guardias de sesión y enrutador GoRouter
├── ui/
│   ├── widgets/                  # Componentes reutilizables
│   │   ├── custom_button.dart
│   │   ├── custom_text_field.dart
│   │   ├── stat_card.dart
│   │   ├── module_card.dart
│   │   ├── status_badge.dart
│   │   └── app_drawer.dart
│   └── screens/                  # Vistas por rol y módulo
│       ├── auth/login_screen.dart
│       ├── common/splash_screen.dart
│       ├── common/profile_screen.dart
│       ├── encargado/encargado_dashboard_screen.dart
│       ├── encargado/my_activities_screen.dart
│       ├── admin/admin_dashboard_screen.dart
│       ├── admin/admin_subordinates_screen.dart
│       ├── admin/admin_activities_screen.dart
│       ├── root/root_dashboard_screen.dart
│       ├── root/root_farms_screen.dart
│       └── modules/
│           ├── potreros_screen.dart
│           ├── lots_screen.dart
│           ├── galpones_screen.dart
│           └── inventory_screen.dart
└── main.dart                     # Punto de entrada y MultiProvider
```

---

## 🚀 Cómo Ejecutar la Aplicación

1. **Verificar que el backend de Laravel esté corriendo**:
   ```bash
   cd ../backend
   php artisan serve --port=8000
   ```

2. **Configurar la URL de la API**:
   - En el emulador Android de Android Studio: ya viene por defecto apuntando a `http://10.0.2.2:8000/api/v1` en [api_endpoints.dart](file:///Users/rosangeles/Documents/appgropecuaria%2023.23.18/mobile/lib/core/constants/api_endpoints.dart).
   - En dispositivo físico: colocar la IP local de tu computadora en la red Wi-Fi (ej. `http://192.168.1.100:8000/api/v1`).

3. **Ejecutar en tu dispositivo o emulador**:
   ```bash
   cd mobile
   flutter run
   ```

4. **Ejecutar Pruebas**:
   ```bash
   flutter test
   flutter analyze
   ```
