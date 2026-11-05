import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;

    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(
              color: AppColors.primary,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.primary, AppColors.primaryDark],
              ),
            ),
            accountName: Text(
              user?.fullName ?? 'Usuario AppGro',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            accountEmail: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user?.email ?? '',
                  style: const TextStyle(fontSize: 13, color: Colors.white70),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    user?.role.toUpperCase() ?? '',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                user != null && user.name.isNotEmpty ? user.name[0].toUpperCase() : 'A',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                // Encargado Section
                if (user?.isEncargado == true) ...[
                  ListTile(
                    leading: const Icon(Icons.task_alt, color: AppColors.primary),
                    title: const Text('Mis Actividades'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/encargado/activities');
                    },
                  ),
                ],

                // Admin Section
                if (user?.isAdmin == true) ...[
                  ListTile(
                    leading: const Icon(Icons.dashboard_outlined, color: AppColors.primary),
                    title: const Text('Panel de Granja'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/admin/dashboard');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.people_outline, color: AppColors.primary),
                    title: const Text('Equipo / Encargados'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/admin/subordinates');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.assignment_outlined, color: AppColors.primary),
                    title: const Text('Gestión de Tareas'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/admin/activities');
                    },
                  ),
                ],

                // Root Section
                if (user?.isRoot == true) ...[
                  ListTile(
                    leading: const Icon(Icons.admin_panel_settings, color: AppColors.primary),
                    title: const Text('Panel Root Global'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/root/dashboard');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.agriculture, color: AppColors.primary),
                    title: const Text('Todas las Granjas'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/root/farms');
                    },
                  ),
                ],

                const Divider(),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'MÓDULOS PRODUCTIVOS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),

                ListTile(
                  leading: const Icon(Icons.grass, color: AppColors.success),
                  title: const Text('Potreros y Pasturas'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/modules/potreros');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.pets, color: AppColors.secondary),
                  title: const Text('Lotes de Ganado'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/modules/lots');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.warehouse, color: AppColors.warning),
                  title: const Text('Galpones e Instalaciones'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/modules/galpones');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.inventory_2, color: AppColors.info),
                  title: const Text('Inventario Agropecuario'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/modules/inventory');
                  },
                ),

                const Divider(),
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: const Text('Mi Perfil'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/profile');
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.error),
            title: const Text('Cerrar Sesión', style: TextStyle(color: AppColors.error)),
            onTap: () async {
              await authProvider.logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

