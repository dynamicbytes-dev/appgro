import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/root_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/module_card.dart';
import '../../widgets/stat_card.dart';

class RootDashboardScreen extends StatefulWidget {
  const RootDashboardScreen({super.key});

  @override
  State<RootDashboardScreen> createState() => _RootDashboardScreenState();
}

class _RootDashboardScreenState extends State<RootDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RootProvider>().loadRootData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final rootProv = context.watch<RootProvider>();
    final stats = rootProv.stats;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Consola Root Global'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => rootProv.loadRootData(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () => rootProv.loadRootData(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.shield, color: Colors.amber, size: 24),
                      SizedBox(width: 8),
                      Text(
                        'Superadministrador',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Monitoreo centralizado de todas las fincas, clientes y suscripciones.',
                    style: TextStyle(fontSize: 13, color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'Estadísticas Globales de la Plataforma',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Total Granjas',
                    value: stats['total_farms']?.toString() ?? '${rootProv.farms.length}',
                    subtitle: 'Fincas activas',
                    icon: Icons.agriculture,
                    iconColor: AppColors.primary,
                    onTap: () => context.go('/root/farms'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatCard(
                    title: 'Administradores',
                    value: stats['total_admins']?.toString() ?? '${rootProv.admins.length}',
                    subtitle: 'Dueños de finca',
                    icon: Icons.manage_accounts,
                    iconColor: AppColors.accent,
                    onTap: () => context.go('/root/admins'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Animales Totales',
                    value: stats['total_animals']?.toString() ?? '0',
                    subtitle: 'En toda la red',
                    icon: Icons.pets,
                    iconColor: AppColors.secondary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatCard(
                    title: 'Superficie (ha)',
                    value: stats['total_area_ha']?.toString() ?? '0',
                    subtitle: 'Hectáreas registradas',
                    icon: Icons.map,
                    iconColor: AppColors.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            const Text(
              'Gestión Central',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            ModuleCard(
              title: 'Directorio de Granjas',
              description: 'Dar de alta nuevas fincas, configurar suscripciones y módulos.',
              icon: Icons.domain,
              color: AppColors.primary,
              onTap: () => context.go('/root/farms'),
            ),
            ModuleCard(
              title: 'Catálogo de Módulos Oficiales',
              description: 'Gestionar módulos canónicos (Potreros, Lotes, Galpones, etc.).',
              icon: Icons.extension,
              color: AppColors.warning,
              onTap: () => context.go('/root/farms'),
            ),
          ],
        ),
      ),
    );
  }
}

