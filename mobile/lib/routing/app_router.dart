import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../ui/screens/auth/login_screen.dart';
import '../ui/screens/common/notifications_screen.dart';
import '../ui/screens/common/profile_screen.dart';
import '../ui/screens/common/splash_screen.dart';
import '../ui/screens/admin/admin_activities_screen.dart';
import '../ui/screens/admin/admin_dashboard_screen.dart';
import '../ui/screens/admin/admin_subordinates_screen.dart';
import '../ui/screens/encargado/encargado_dashboard_screen.dart';
import '../ui/screens/encargado/my_activities_screen.dart';
import '../ui/screens/modules/analytics_screen.dart';
import '../ui/screens/modules/galpones_screen.dart';
import '../ui/screens/modules/history_screen.dart';
import '../ui/screens/modules/inventory_screen.dart';
import '../ui/screens/modules/lots_screen.dart';
import '../ui/screens/modules/potreros_screen.dart';
import '../ui/screens/modules/species_screen.dart';
import '../ui/screens/root/root_admins_screen.dart';
import '../ui/screens/root/root_dashboard_screen.dart';
import '../ui/screens/root/root_farms_screen.dart';

class AppRouter {
  static GoRouter createRouter(AuthProvider authProvider) {
    return GoRouter(
      initialLocation: '/',
      refreshListenable: authProvider,
      redirect: (context, state) {
        final status = authProvider.status;
        final isAuth = authProvider.isAuthenticated;
        final loc = state.matchedLocation;

        // Mientras la app inicia y comprueba credenciales, mostrar Splash
        if (status == AuthStatus.initial || status == AuthStatus.loading) {
          return loc == '/' ? null : '/';
        }

        final isLoggingIn = loc == '/login';

        // Si no está autenticado y no está en la pantalla de login, redirigir a /login
        if (!isAuth) {
          return isLoggingIn ? null : '/login';
        }

        // Si ya está autenticado e intenta ir al login o al splash, enviarlo a su dashboard
        if (loc == '/' || isLoggingIn) {
          final user = authProvider.user;
          if (user?.isRoot == true) return '/root/dashboard';
          if (user?.isAdmin == true) return '/admin/dashboard';
          return '/encargado/dashboard';
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const SplashScreen(),
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),

        // Encargado Routes
        GoRoute(
          path: '/encargado/dashboard',
          builder: (context, state) => const EncargadoDashboardScreen(),
        ),
        GoRoute(
          path: '/encargado/activities',
          builder: (context, state) => const MyActivitiesScreen(),
        ),

        // Admin Routes
        GoRoute(
          path: '/admin/dashboard',
          builder: (context, state) => const AdminDashboardScreen(),
        ),
        GoRoute(
          path: '/admin/subordinates',
          builder: (context, state) => const AdminSubordinatesScreen(),
        ),
        GoRoute(
          path: '/admin/activities',
          builder: (context, state) => const AdminActivitiesScreen(),
        ),

        // Root Routes
        GoRoute(
          path: '/root/dashboard',
          builder: (context, state) => const RootDashboardScreen(),
        ),
        GoRoute(
          path: '/root/farms',
          builder: (context, state) => const RootFarmsScreen(),
        ),
        GoRoute(
          path: '/root/admins',
          builder: (context, state) => const RootAdminsScreen(),
        ),

        // Modular Operation Routes
        GoRoute(
          path: '/modules/species',
          builder: (context, state) => const SpeciesScreen(),
        ),
        GoRoute(
          path: '/modules/potreros',
          builder: (context, state) => const PotrerosScreen(),
        ),
        GoRoute(
          path: '/modules/lots',
          builder: (context, state) => const LotsScreen(),
        ),
        GoRoute(
          path: '/modules/galpones',
          builder: (context, state) => const GalponesScreen(),
        ),
        GoRoute(
          path: '/modules/inventory',
          builder: (context, state) => const InventoryScreen(),
        ),
        GoRoute(
          path: '/modules/analytics',
          builder: (context, state) => const AnalyticsScreen(),
        ),
        GoRoute(
          path: '/modules/history',
          builder: (context, state) => const HistoryScreen(),
        ),

        // Common
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        body: Center(
          child: Text('Ruta no encontrada: ${state.uri.toString()}'),
        ),
      ),
    );
  }
}
