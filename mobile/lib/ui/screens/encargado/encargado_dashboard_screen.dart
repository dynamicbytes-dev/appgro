import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/activity_provider.dart';
import '../../../providers/auth_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/module_card.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/status_badge.dart';

class EncargadoDashboardScreen extends StatefulWidget {
  const EncargadoDashboardScreen({super.key});

  @override
  State<EncargadoDashboardScreen> createState() => _EncargadoDashboardScreenState();
}

class _EncargadoDashboardScreenState extends State<EncargadoDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ActivityProvider>().loadActivities(myActivitiesOnly: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final activityProv = context.watch<ActivityProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(user?.farm?.name ?? 'AppGro Campo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => activityProv.loadActivities(myActivitiesOnly: true),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () => activityProv.loadActivities(myActivitiesOnly: true),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Header saludo
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
                  Text(
                    '¡Hola, ${user?.name ?? 'Encargado'}!',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Finca: ${user?.farm?.name ?? 'No asignada'} • Sector: ${user?.farm?.sector ?? 'General'}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Resumen de tareas de hoy
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    title: 'Pendientes',
                    value: '${activityProv.pendingActivities.length}',
                    icon: Icons.pending_actions,
                    iconColor: AppColors.warning,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatCard(
                    title: 'En Proceso',
                    value: '${activityProv.inProgressActivities.length}',
                    icon: Icons.sync,
                    iconColor: AppColors.info,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatCard(
                    title: 'Terminadas',
                    value: '${activityProv.completedActivities.length}',
                    icon: Icons.check_circle_outline,
                    iconColor: AppColors.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Mis Actividades Prioritarias
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Mis Actividades de Campo',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                TextButton(
                  onPressed: () => context.go('/encargado/activities'),
                  child: const Text('Ver todas'),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (activityProv.isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (activityProv.activities.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.done_all, size: 40, color: AppColors.success),
                      SizedBox(height: 8),
                      Text(
                        '¡No tienes tareas pendientes para hoy!',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...activityProv.activities.take(3).map(
                    (act) => Card(
                      child: ListTile(
                        title: Text(
                          act.title,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          act.description ?? 'Sin descripción adicional',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: StatusBadge.forStatus(act.status),
                        onTap: () => context.go('/encargado/activities'),
                      ),
                    ),
                  ),

            const SizedBox(height: 24),
            const Text(
              'Registros Rápidos de Campo',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            ModuleCard(
              title: 'Potreros y Pastoreo',
              description: 'Consultar estado de rotación y registrar aforos de pasto.',
              icon: Icons.grass,
              color: AppColors.success,
              onTap: () => context.go('/modules/potreros'),
            ),
            ModuleCard(
              title: 'Lotes de Ganado',
              description: 'Pesajes periódicos y control sanitario del lote.',
              icon: Icons.pets,
              color: AppColors.secondary,
              onTap: () => context.go('/modules/lots'),
            ),
            ModuleCard(
              title: 'Galpones e Instalaciones',
              description: 'Registro de postura de huevos y novedades en galpón.',
              icon: Icons.warehouse,
              color: AppColors.warning,
              onTap: () => context.go('/modules/galpones'),
            ),
            ModuleCard(
              title: 'Consumo de Insumos',
              description: 'Registrar salida o aplicación de alimentos y medicamentos.',
              icon: Icons.inventory_2,
              color: AppColors.info,
              onTap: () => context.go('/modules/inventory'),
            ),
          ],
        ),
      ),
    );
  }
}

