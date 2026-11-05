import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/potrero_model.dart';
import '../../../providers/potrero_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';
import 'potrero_detail_screen.dart';

class PotrerosScreen extends StatefulWidget {
  const PotrerosScreen({super.key});

  @override
  State<PotrerosScreen> createState() => _PotrerosScreenState();
}

class _PotrerosScreenState extends State<PotrerosScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PotreroProvider>().loadPotreros();
    });
  }

  void _showAddPotreroDialog() {
    final nameController = TextEditingController();
    final codeController = TextEditingController();
    final sectorController = TextEditingController();
    final haController = TextEditingController(text: '5.0');
    final capController = TextEditingController(text: '20');
    final pasturaController = TextEditingController(text: 'Brachiaria decumbens');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
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
                  'Registrar Nuevo Potrero',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombre del Potrero',
                  hint: 'Potrero La Ceiba #3',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: codeController,
                  label: 'Código',
                  hint: 'POT-03',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: sectorController,
                  label: 'Sector',
                  hint: 'Sector Norte',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomTextField(
                        controller: haController,
                        label: 'Área (ha)',
                        hint: '5.2',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: capController,
                        label: 'Capacidad Animales',
                        hint: '25',
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: pasturaController,
                  label: 'Tipo de Pastura',
                  hint: 'Brachiaria / Guinea / Brizantha',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Potrero',
                  onPressed: () async {
                    if (nameController.text.trim().isEmpty) return;
                    final messenger = ScaffoldMessenger.of(context);
                    final potreroProv = context.read<PotreroProvider>();
                    Navigator.pop(ctx);
                    final success = await potreroProv.createPotrero({
                      'name': nameController.text.trim(),
                      'code': codeController.text.trim(),
                      'sector': sectorController.text.trim(),
                      'superficie_ha': double.tryParse(haController.text) ?? 1.0,
                      'max_capacity': int.tryParse(capController.text) ?? 10,
                      'tipo_pastura': pasturaController.text.trim(),
                      'operational_status': 'disponible',
                      'is_active': true,
                    });
                    if (success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Potrero creado exitosamente'),
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
  }

  void _showEditPotreroDialog(PotreroModel potrero) {
    final nameController = TextEditingController(text: potrero.name);
    final codeController = TextEditingController(text: potrero.code ?? '');
    final sectorController = TextEditingController(text: potrero.sector ?? '');
    final haController = TextEditingController(text: '${potrero.superficieHa}');
    final capController = TextEditingController(text: '${potrero.maxCapacity}');
    final pasturaController = TextEditingController(text: potrero.tipoPastura ?? '');
    String selectedStatus = potrero.operationalStatus;

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
                    Text(
                      'Editar Potrero: ${potrero.name}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre del Potrero',
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: codeController,
                      label: 'Código',
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: sectorController,
                      label: 'Sector',
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: CustomTextField(
                            controller: haController,
                            label: 'Área (ha)',
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: CustomTextField(
                            controller: capController,
                            label: 'Capacidad Animales',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: pasturaController,
                      label: 'Tipo de Pastura',
                    ),
                    const SizedBox(height: 12),
                    const Text('Estado Operativo:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedStatus,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'disponible', child: Text('Disponible')),
                        DropdownMenuItem(value: 'ocupado', child: Text('Ocupado')),
                        DropdownMenuItem(value: 'descanso', child: Text('Descanso / Recuperación')),
                        DropdownMenuItem(value: 'mantenimiento', child: Text('Mantenimiento')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedStatus = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Actualizar Potrero',
                      onPressed: () async {
                        if (nameController.text.trim().isEmpty) return;
                        final messenger = ScaffoldMessenger.of(context);
                        final potreroProv = context.read<PotreroProvider>();
                        Navigator.pop(ctx);
                        final success = await potreroProv.updatePotrero(potrero.id, {
                          'name': nameController.text.trim(),
                          'code': codeController.text.trim(),
                          'sector': sectorController.text.trim(),
                          'superficie_ha': double.tryParse(haController.text) ?? potrero.superficieHa,
                          'max_capacity': int.tryParse(capController.text) ?? potrero.maxCapacity,
                          'tipo_pastura': pasturaController.text.trim(),
                          'operational_status': selectedStatus,
                        });
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Potrero actualizado exitosamente'),
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

  void _confirmDeletePotrero(PotreroModel potrero) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Eliminar Potrero'),
          content: Text('¿Está seguro de eliminar "${potrero.name}"? Esta acción no se puede deshacer.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final potreroProv = context.read<PotreroProvider>();
                Navigator.pop(ctx);
                final success = await potreroProv.deletePotrero(potrero.id);
                if (success) {
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text('Potrero eliminado'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                } else {
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(potreroProv.errorMessage ?? 'No se pudo eliminar el potrero'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              },
              child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final potreroProv = context.watch<PotreroProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Potreros y Pasturas'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => potreroProv.loadPotreros(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddPotreroDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Potrero', style: TextStyle(color: Colors.white)),
      ),
      body: potreroProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : potreroProv.potreros.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.grass, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay potreros registrados en esta finca.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primer Potrero',
                          onPressed: _showAddPotreroDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => potreroProv.loadPotreros(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: potreroProv.potreros.length,
                    itemBuilder: (context, index) {
                      final p = potreroProv.potreros[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        clipBehavior: Clip.antiAlias,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 2,
                        child: InkWell(
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => PotreroDetailScreen(potrero: p),
                              ),
                            );
                          },
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
                                        p.name,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                    StatusBadge.forStatus(p.operationalStatus),
                                    PopupMenuButton<String>(
                                      icon: const Icon(Icons.more_vert, size: 20),
                                      onSelected: (val) {
                                        switch (val) {
                                          case 'edit':
                                            _showEditPotreroDialog(p);
                                            break;
                                          case 'toggle':
                                            potreroProv.toggleStatus(p.id);
                                            break;
                                          case 'delete':
                                            _confirmDeletePotrero(p);
                                            break;
                                        }
                                      },
                                      itemBuilder: (ctx) => [
                                        const PopupMenuItem(
                                          value: 'edit',
                                          child: Row(
                                            children: [
                                              Icon(Icons.edit, size: 18, color: AppColors.primary),
                                              SizedBox(width: 8),
                                              Text('Editar'),
                                            ],
                                          ),
                                        ),
                                        PopupMenuItem(
                                          value: 'toggle',
                                          child: Row(
                                            children: [
                                              Icon(
                                                p.isActive ? Icons.toggle_off : Icons.toggle_on,
                                                size: 18,
                                                color: p.isActive ? AppColors.warning : AppColors.success,
                                              ),
                                              const SizedBox(width: 8),
                                              Text(p.isActive ? 'Desactivar' : 'Activar'),
                                            ],
                                          ),
                                        ),
                                        const PopupMenuItem(
                                          value: 'delete',
                                          child: Row(
                                            children: [
                                              Icon(Icons.delete, size: 18, color: AppColors.error),
                                              SizedBox(width: 8),
                                              Text('Eliminar', style: TextStyle(color: AppColors.error)),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    const Icon(Icons.square_foot, size: 16, color: AppColors.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${p.superficieHa} ha',
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                    ),
                                    const SizedBox(width: 16),
                                    const Icon(Icons.group, size: 16, color: AppColors.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Capacidad: ${p.maxCapacity} animales',
                                      style: const TextStyle(fontSize: 13),
                                    ),
                                  ],
                                ),
                                if (p.tipoPastura != null && p.tipoPastura!.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    'Pastura: ${p.tipoPastura}',
                                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                const Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Text(
                                      'Ver aforos y tratamientos',
                                      style: TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    SizedBox(width: 4),
                                    Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.primary),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
