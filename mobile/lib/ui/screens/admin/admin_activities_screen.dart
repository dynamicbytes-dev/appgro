import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/activity_provider.dart';
import '../../../providers/farm_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';

class AdminActivitiesScreen extends StatefulWidget {
  const AdminActivitiesScreen({super.key});

  @override
  State<AdminActivitiesScreen> createState() => _AdminActivitiesScreenState();
}

class _AdminActivitiesScreenState extends State<AdminActivitiesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ActivityProvider>().loadActivities();
      context.read<FarmProvider>().loadDashboard();
    });
  }

  void _showCreateActivityDialog() {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final dateController = TextEditingController();
    int? selectedSubordinateId;

    final subordinates = context.read<FarmProvider>().subordinates;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 24,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Asignar Nueva Tarea de Campo',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: titleController,
                      label: 'Título de la Actividad',
                      hint: 'Ej: Aforo en Potrero 4 / Vacunación lote A',
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: descController,
                      label: 'Descripción o Instrucciones',
                      hint: 'Detalles específicos para el encargado...',
                      maxLines: 3,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Asignar a Encargado:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<int>(
                      value: selectedSubordinateId,
                      decoration: const InputDecoration(
                        hintText: 'Seleccionar encargado',
                      ),
                      items: subordinates
                          .map((sub) => DropdownMenuItem<int>(
                                value: sub.id,
                                child: Text(sub.fullName),
                              ))
                          .toList(),
                      onChanged: (val) {
                        setModalState(() {
                          selectedSubordinateId = val;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: dateController,
                      label: 'Fecha Límite (AAAA-MM-DD)',
                      hint: '2026-11-15',
                      keyboardType: TextInputType.datetime,
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Asignar Tarea',
                      onPressed: () async {
                        if (titleController.text.trim().isEmpty) return;
                        final actProvider = context.read<ActivityProvider>();
                        final messenger = ScaffoldMessenger.of(context);
                        Navigator.pop(ctx);
                        final success = await actProvider.createActivity(
                              title: titleController.text.trim(),
                              description: descController.text.trim(),
                              assignedTo: selectedSubordinateId,
                              dueDate: dateController.text.trim().isNotEmpty
                                  ? dateController.text.trim()
                                  : null,
                        );
                        if (mounted && success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Actividad creada exitosamente'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final activityProv = context.watch<ActivityProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Actividades de la Granja'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => activityProv.loadActivities(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showCreateActivityDialog,
        icon: const Icon(Icons.add_task, color: Colors.white),
        label: const Text('Nueva Tarea', style: TextStyle(color: Colors.white)),
      ),
      body: activityProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : activityProv.activities.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.assignment_outlined, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay actividades creadas en esta finca.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primera Tarea',
                          onPressed: _showCreateActivityDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => activityProv.loadActivities(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: activityProv.activities.length,
                    itemBuilder: (context, index) {
                      final act = activityProv.activities[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
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
                                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                                ),
                              ],
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    act.assignee != null
                                        ? 'Asignado: ${act.assignee!.fullName}'
                                        : 'Sin asignar',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  Text(
                                    act.dueDate != null ? 'Vence: ${act.dueDate}' : 'Sin fecha',
                                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
