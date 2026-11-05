import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/activity_model.dart';
import '../../../providers/activity_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/status_badge.dart';

class MyActivitiesScreen extends StatefulWidget {
  const MyActivitiesScreen({super.key});

  @override
  State<MyActivitiesScreen> createState() => _MyActivitiesScreenState();
}

class _MyActivitiesScreenState extends State<MyActivitiesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ActivityProvider>().loadActivities(myActivitiesOnly: true);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showStatusDialog(ActivityModel activity) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  activity.title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  activity.description ?? 'Sin descripción adicional',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Actualizar Estado de la Tarea:',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                const SizedBox(height: 12),
                ListTile(
                  leading: const Icon(Icons.sync, color: AppColors.info),
                  title: const Text('Marcar En Proceso'),
                  subtitle: const Text('Indica que has comenzado esta labor en campo'),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await context.read<ActivityProvider>().updateStatus(
                          activity.id,
                          'en_proceso',
                        );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.check_circle, color: AppColors.success),
                  title: const Text('Marcar como Terminada'),
                  subtitle: const Text('Finaliza la tarea y registra la hora de culminación'),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await context.read<ActivityProvider>().updateStatus(
                          activity.id,
                          'terminada',
                        );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final activityProv = context.watch<ActivityProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Actividades'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          tabs: [
            Tab(text: 'Pendientes (${activityProv.pendingActivities.length})'),
            Tab(text: 'En Proceso (${activityProv.inProgressActivities.length})'),
            Tab(text: 'Listas (${activityProv.completedActivities.length})'),
          ],
        ),
      ),
      drawer: const AppDrawer(),
      body: activityProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildActivityList(activityProv.pendingActivities, 'No tienes tareas pendientes.'),
                _buildActivityList(activityProv.inProgressActivities, 'No tienes tareas en proceso.'),
                _buildActivityList(activityProv.completedActivities, 'No tienes tareas terminadas aún.'),
              ],
            ),
    );
  }

  Widget _buildActivityList(List<ActivityModel> list, String emptyMessage) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.assignment_turned_in, size: 50, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text(
                emptyMessage,
                style: const TextStyle(fontSize: 15, color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => context.read<ActivityProvider>().loadActivities(myActivitiesOnly: true),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        itemBuilder: (context, index) {
          final act = list[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => _showStatusDialog(act),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            act.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        StatusBadge.forStatus(act.status),
                      ],
                    ),
                    if (act.description != null && act.description!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        act.description!,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.event, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              act.dueDate != null ? 'Vence: ${act.dueDate}' : 'Sin fecha límite',
                              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                        const Text(
                          'Toca para cambiar estado',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

