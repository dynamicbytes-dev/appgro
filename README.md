# 🌾 AppGro — Plataforma Integral de Gestión Agropecuaria

<p align="center">
  <img src="frontend/public/logo-zootika.png" alt="AppGro Logo" width="180" style="border-radius: 12px; margin-bottom: 12px;" />
</p>

<p align="center">
  <strong>Sistema Multi-Granja y Multi-Rol para la Administración Integral de Fincas, Ganadería, Avicultura, Pasturas e Inventario Agropecuario.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PHP-8.2%2B-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP 8.2+" />
  <img src="https://img.shields.io/badge/Laravel-12.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" alt="Laravel 12" />
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x%20%2F%206.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Leaflet-GeoJSON-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet Maps" />
  <img src="https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white" alt="JWT Auth" />
</p>

---

## 📖 Descripción General

**AppGro** (también denominado en la plataforma **Zootika / Appgropecuaria**) es una solución de software moderna y robusta concebida para la digitalización, control y toma de decisiones en explotaciones agropecuarias y ganaderas.

Diseñada bajo una arquitectura **Multi-Granja (Multi-Tenant SaaS)**, la plataforma permite gestionar desde una única instalación centralizada múltiples fincas independientes, cada una con su propio personal, módulos habilitados, inventarios y registros productivos.

---

## ✨ Módulos Principales del Sistema

| Módulo | Código | Descripción y Capacidades |
| :--- | :---: | :--- |
| 🌱 **Potreros y Pasturas** | `potreros` | Delimitación geoespacial con mapas interactivos (Leaflet / GeoJSON), cálculo de áreas (ha), estados de rotación (descanso, ocupado, mantenimiento), aforos de biomasa (disponibilidad forrajera en kg MS/ha) y tratamientos agronómicos (fertilización, encalado, control fitosanitario). |
| 🐄 **Lotes y Ganadería** | `lots` | Trazabilidad por lotes e individual por animal (bovinos, porcinos, ovinos, etc.). Control de pesajes y curvas de crecimiento, registros sanitarios, eventos reproductivos y generación de fichas técnicas individuales en PDF. |
| 🏷️ **Especies Pecuarias** | `species` | Catálogo maestro de especies zootécnicas, razas, parámetros biométricos y tipificación de animales en producción. |
| 🐔 **Galpones e Instalaciones** | `barns` | Administración de naves y galpones avícolas/pecuarios. Registro y control diario de postura y recolección de huevos por clasificación, mermas, densidades y habitabilidad. |
| 📦 **Inventario Agropecuario** | `inventory` | Control multialmacén de insumos agrícolas y veterinarios (alimentos balanceados, medicamentos, fertilizantes, herramientas). Trazabilidad de lotes con fechas de expiración, directorio de proveedores y bitácora de movimientos (entradas, salidas, transferencias y mermas). |
| 📋 **Actividades y Tareas** | `activities` | Planificación, asignación y seguimiento de labores de campo para el personal operativo. Bitácora de incidencias, estados de avance y registro fotográfico/observaciones. |
| 📊 **Analítica y Reportes** | `analytics` | Tableros de control con KPIs consolidados en tiempo real. Generación automatizada de reportes ejecutivos en PDF (vía `jsPDF` y `jsPDF-AutoTable`) listos para auditorías y juntas directivas. |
| 🛡️ **Historial y Auditoría** | `history` | Registro cronológico inmutable de actividades y cambios realizados por los usuarios en cada granja para máxima trazabilidad y cumplimiento normativo. |

---

## 👥 Jerarquía de Roles y Seguridad

1. **👑 Superadministrador (`root`)**:
   - Acceso global a todas las granjas registradas en la plataforma.
   - Creación, edición y suspensión de fincas y cuentas de administradores.
   - Activación y personalización de módulos habilitados por suscripción para cada granja.
   - Auditoría de logs globales y métricas globales de la plataforma.

2. **👔 Administrador de Finca (`admin`)**:
   - Gestión integral y exclusiva de su granja asignada.
   - Panel de control de KPIs de productividad, inventario y ocupación.
   - Creación y gestión de encargados y supervisores de campo, definiendo qué módulos pueden operar.
   - Exportación de reportes ejecutivos y balances técnicos.

3. **👷 Encargado / Supervisor de Campo (`encargado`)**:
   - Vista optimizada para trabajo en campo y dispositivos móviles (**"Mis Actividades"**).
   - Registro de labores diarias, aforos de potreros, pesajes de ganado, postura de huevos y consumo de insumos.

---

## 🏗️ Arquitectura Tecnológica

### Backend (`/backend`)
- **Lenguaje / Framework**: PHP 8.2+ / Laravel 12
- **Autenticación**: JWT (`tymon/jwt-auth`) + Laravel Sanctum
- **Base de Datos**: PostgreSQL (recomendado en producción), MySQL o SQLite
- **Patrones**: Form Requests, Resource Controllers, Global Scopes multi-granja (`farm_id`), Middleware de módulos y roles
- **Testing**: PHPUnit 11 / Pail

### Frontend (`/frontend`)
- **Framework / Bundler**: React 19 (SPA) + Vite 8
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS v4 + Tailwind Merge + Clsx
- **Mapas Geoespaciales**: Leaflet + React Leaflet
- **Reportes & PDFs**: jsPDF + jsPDF-AutoTable
- **Iconografía**: Lucide React
- **Navegación**: React Router v7
- **Cliente HTTP**: Axios con interceptores automáticos para renovación y manejo de tokens JWT

---

## 📁 Estructura del Repositorio

```text
appgro/
├── backend/                    # API RESTful en Laravel 12
│   ├── app/
│   │   ├── Http/Controllers/  # Controladores de la API (Auth, Potreros, Inventario, Lotes, etc.)
│   │   ├── Models/            # Modelos Eloquent y relaciones multi-tenant
│   │   └── Scopes/            # Scopes de aislamiento por granja (farm_id)
│   ├── config/                # Configuraciones de Laravel (cors, jwt, database, etc.)
│   ├── database/
│   │   ├── migrations/        # Esquema de base de datos relacional
│   │   └── seeders/           # Semillas (módulos canónicos, usuario root)
│   ├── routes/
│   │   └── api.php            # Definición completa de rutas bajo /api/v1/
│   └── tests/                 # Pruebas automatizadas unitarias y de integración
│
├── frontend/                   # Interfaz de Usuario SPA (React 19 + TypeScript)
│   ├── src/
│   │   ├── components/        # Componentes reutilizables (Sidebar, Layouts, Modales, Tablas)
│   │   ├── context/           # Contextos globales (AuthContext, FarmContext)
│   │   ├── pages/             # Vistas por rol (Root, Admin, Encargado) y por módulo
│   │   ├── services/          # Clientes API Axios (api.ts, auth, potreros, inventario, etc.)
│   │   └── types/             # Definiciones e interfaces de TypeScript
│   └── public/                # Recursos estáticos, logos e iconografía
│
├── mobile/                     # Aplicación Móvil Nativa (Flutter 3.x / Dart)
│   ├── lib/
│   │   ├── core/              # Red, almacenamiento seguro JWT, temas y constantes
│   │   ├── data/              # Modelos y repositorios de consumo de la API REST
│   │   ├── providers/         # Estado de la app (ViewModels / ChangeNotifier)
│   │   ├── routing/           # Enrutamiento protegido por roles (GoRouter)
│   │   └── ui/                # Vistas para Encargado, Admin, Root y módulos de campo
│   └── test/                  # Pruebas unitarias de serialización y componentes UI
│
├── .gitignore                  # Reglas de exclusión de Git
└── README.md                   # Documentación principal del proyecto
```

---

## 🚀 Guía de Instalación y Despliegue Local

### 1. Clonar el Repositorio
```bash
git clone git@github.com:dynamicbytes-dev/appgro.git
cd appgro
```

---

### 2. Configurar el Backend (Laravel)

1. **Acceder al directorio:**
   ```bash
   cd backend
   ```

2. **Instalar dependencias de PHP:**
   ```bash
   composer install
   ```

3. **Configurar el archivo de entorno:**
   ```bash
   cp .env.example .env
   ```

4. **Generar las claves de aplicación y JWT:**
   ```bash
   php artisan key:generate
   php artisan jwt:secret
   ```

5. **Configurar la base de datos en `.env`:**
   Edita `.env` con las credenciales de tu base de datos (PostgreSQL, MySQL o SQLite):
   ```ini
   DB_CONNECTION=pgsql
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_DATABASE=appgropecuaria
   DB_USERNAME=postgres
   DB_PASSWORD=tu_password
   ```

6. **Ejecutar migraciones y sembrar datos iniciales:**
   ```bash
   php artisan migrate --seed
   ```
   > ℹ️ **Nota:** El seeder inicializa el catálogo canónico de módulos (`potreros`, `lots`, `species`, `barns`, `inventory`, `activities`, `analytics`, `history`) y el usuario Superadministrador (`root`).

7. **Iniciar el servidor backend:**
   ```bash
   php artisan serve --port=8000
   ```
   La API quedará disponible en: `http://localhost:8000/api/v1`

---

### 3. Configurar el Frontend (React + Vite)

1. **Abrir otra terminal y acceder al directorio:**
   ```bash
   cd frontend
   ```

2. **Instalar dependencias de Node.js:**
   ```bash
   npm install
   ```

3. **Configurar el archivo de entorno:**
   ```bash
   cp .env.example .env
   ```
   Verifica que `VITE_API_URL` apunte a la API de Laravel:
   ```ini
   VITE_API_URL=http://localhost:8000/api/v1
   ```

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación web estará disponible en: `http://localhost:5173`

---

## 🔐 Credenciales Predeterminadas (Entorno de Desarrollo)

Al ejecutar `php artisan migrate --seed`, se crea automáticamente la cuenta **Root** inicial:

- **Usuario / Correo:** `rosangeles92@gmail.com`
- **Contraseña:** `Miranda*30`
- **Rol:** `root` (Superadministrador con acceso total)

Desde el panel de **Root**, podrás registrar tu primera finca, dar de alta al administrador de la granja y asignarle los módulos que requiera.

---

## 📡 Resumen de Rutas de la API (`/api/v1`)

### Autenticación
- `POST /api/v1/auth/login` — Inicio de sesión y emisión de tokens JWT.
- `POST /api/v1/auth/logout` — Cierre de sesión y revocación de token.
- `POST /api/v1/auth/refresh` — Refresco de token JWT.
- `GET  /api/v1/auth/me` — Datos del usuario autenticado y perfil.
- `GET  /api/v1/auth/modules` — Módulos activos para el usuario autenticado.

### Panel Root (Superadministrador)
- `GET    /api/v1/root/stats` — Métricas y KPIs globales.
- `GET    /api/v1/root/farms` — Listado de granjas.
- `POST   /api/v1/root/farms` — Registro de nueva granja.
- `PUT    /api/v1/root/farms/{id}/modules` — Asignación de módulos a una granja.
- `GET    /api/v1/root/admins` — Gestión de propietarios/administradores.
- `GET    /api/v1/root/activity-logs` — Auditoría global de operaciones.

### Operaciones de Granja (Admin / Encargados)
- `GET /api/v1/admin/dashboard` — Resumen ejecutivo de la granja.
- `CRUD /api/v1/potreros` — Gestión de potreros, mapas GeoJSON y estados.
- `CRUD /api/v1/potreros/biomass-surveys` — Aforos de pasturas.
- `CRUD /api/v1/potreros/treatments` — Tratamientos agronómicos.
- `CRUD /api/v1/lots` — Gestión de lotes pecuarios.
- `CRUD /api/v1/lots/{id}/animals` — Animales dentro del lote y pesajes.
- `CRUD /api/v1/species` — Especies y razas.
- `CRUD /api/v1/galpones` & `/barns` — Galpones y registro de postura avícola.
- `CRUD /api/v1/inventory/items` — Catálogo de insumos y productos.
- `CRUD /api/v1/inventory/warehouses` — Almacenes y bodegas.
- `CRUD /api/v1/inventory/movements` — Entradas, salidas y traslados.
- `CRUD /api/v1/activities` — Asignación y control de tareas de campo.
- `GET  /api/v1/reports/{module}/executive-kpis` — Datos consolidados para reportes ejecutivos.

---

## 🛠️ Comandos de Desarrollo y Pruebas

### Backend
```bash
# Ejecutar conjunto de pruebas automatizadas
composer test
# O directamente con Artisan:
php artisan test

# Limpiar cachés de configuración y rutas
php artisan config:clear
php artisan route:clear
php artisan cache:clear

# Monitoreo de logs en vivo
php artisan pail
```

### Frontend
```bash
# Ejecutar linter rápido (Oxlint)
npm run lint

# Validar TypeScript y compilar bundle para producción
npm run build

# Previsualizar el bundle de producción
npm run preview
```

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia [MIT](LICENSE).

---

<p align="center">
  Desarrollado con dedicación para el sector agropecuario por <strong>Dynamic Bytes Dev</strong>.
</p>
