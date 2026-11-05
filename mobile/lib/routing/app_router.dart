import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../ui/screens/auth/login_screen.dart';
import '../ui/screens/common/profile_screen.dart';
import '../ui/screens/common/splash_screen.dart';
import '../ui/screens/admin/admin_activities_screen.dart';
import '../ui/screens/admin/admin_dashboard_screen.dart';
import '../ui/screens/admin/admin_subordinates_screen.dart';
import '../ui/screens/encargado/encargado_dashboard_screen.dart';
import '../ui/screens/encargado/my_activities_screen.dart';
import '../ui/screens/modules/galpones_screen.dart';
import '../ui/screens/modules/inventory_screen.dart';
import '../ui/screens/modules/lots_screen.dart';
import '../ui/screens/modules/potreros_screen.dart';
import '../ui/screens/root/root_dashboard_screen.dart';
import '../ui/screens/root/root_farms_screen.dart';

class AppRouter {
  static GoRouter createRouter(AuthProvider authProvider) {
    return GoRouter(
      initialLocation: '/',
      refreshListenable: authProvider,
      redirect: (context, state) {
        final isAuth = authProvider.isAuthenticated;
        final loc = state.matchedLocation;

        if (loc == '/') return null; // Let splash decide

        final isLoggingIn = loc == '/login';
        if (!isAuth && !isLoggingIn) return '/login';
        if (isAuth && isLoggingIn) {
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

        // Modular Operation Routes
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

        // Common
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        body: Center(
          child: Text('Ruta no encontrada: ${state.matchedLocation}'),
        ),
      ),
    );
  }
}

