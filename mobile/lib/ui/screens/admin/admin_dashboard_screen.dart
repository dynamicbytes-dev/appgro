import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/farm_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/module_card.dart';
import '../../widgets/stat_card.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FarmProvider>().loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final farmProv = context.watch<FarmProvider>();
    final stats = farmProv.dashboard;

    return Scaffold(
      appBar: AppBar(
        title: Text('Admin • ${user?.farm?.name ?? 'Granja'}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => farmProv.loadDashboard(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () => farmProv.loadDashboard(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Banner de la Finca
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        user?.farm?.name ?? 'Granja Principal',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          user?.farm?.code ?? 'FINCA',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Ubicación: ${user?.farm?.location ?? 'Sector Rural'}',
                    style: const TextStyle(fontSize: 13, color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Métricas KPI de la finca
            const Text(
              'Indicadores de la Finca',
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
                    title: 'Total Animales',
                    value: stats['total_animals']?.toString() ?? '0',
                    subtitle: 'Bovinos/Porcinos',
                    icon: Icons.pets,
                    iconColor: AppColors.secondary,
                    onTap: () => context.go('/modules/lots'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatCard(
                    title: 'Potreros',
                    value: stats['total_potreros']?.toString() ?? '0',
                    subtitle: 'Disponibles',
                    icon: Icons.grass,
                    iconColor: AppColors.success,
                    onTap: () => context.go('/modules/potreros'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Encargados',
                    value: '${farmProv.subordinates.length}',
                    subtitle: 'Personal de campo',
                    icon: Icons.people,
                    iconColor: AppColors.info,
                    onTap: () => context.go('/admin/subordinates'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatCard(
                    title: 'Insumos Alerta',
                    value: stats['low_stock_items']?.toString() ?? '0',
                    subtitle: 'Stock bajo',
                    icon: Icons.warning_amber_rounded,
                    iconColor: AppColors.warning,
                    onTap: () => context.go('/modules/inventory'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Accesos directos a Módulos
            const Text(
              'Administración y Operaciones',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            ModuleCard(
              title: 'Gestión de Tareas y Actividades',
              description: 'Asignar labores diarias a supervisores y seguir avance.',
              icon: Icons.assignment,
              color: AppColors.primary,
              onTap: () => context.go('/admin/activities'),
            ),
            ModuleCard(
              title: 'Equipo de Campo (Encargados)',
              description: 'Registrar nuevos supervisores y configurar sus módulos.',
              icon: Icons.badge,
              color: AppColors.info,
              onTap: () => context.go('/admin/subordinates'),
            ),
            ModuleCard(
              title: 'Potreros y Mapas de Pastoreo',
              description: 'Aforos de biomasa, capacidad de carga y tratamientos.',
              icon: Icons.grass,
              color: AppColors.success,
              onTap: () => context.go('/modules/potreros'),
            ),
            ModuleCard(
              title: 'Lotes e Inventario Ganadero',
              description: 'Trazabilidad de pesajes, sanidad y curvas de engorde.',
              icon: Icons.pets,
              color: AppColors.secondary,
              onTap: () => context.go('/modules/lots'),
            ),
            ModuleCard(
              title: 'Galpones e Instalaciones',
              description: 'Producción diaria de postura y mermas en naves avícolas.',
              icon: Icons.warehouse,
              color: AppColors.warning,
              onTap: () => context.go('/modules/galpones'),
            ),
            ModuleCard(
              title: 'Almacenes e Inventario',
              description: 'Movimientos de insumos, medicinas, piensos y compras.',
              icon: Icons.inventory_2,
              color: AppColors.accent,
              onTap: () => context.go('/modules/inventory'),
            ),
          ],
        ),
      ),
    );
  }
}

