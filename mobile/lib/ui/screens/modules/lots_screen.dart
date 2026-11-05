import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/lot_model.dart';
import '../../../providers/lot_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';
import 'lot_detail_screen.dart';

class LotsScreen extends StatefulWidget {
  const LotsScreen({super.key});

  @override
  State<LotsScreen> createState() => _LotsScreenState();
}

class _LotsScreenState extends State<LotsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LotProvider>().loadLots();
    });
  }

  void _showAddLotDialog() {
    final codeController = TextEditingController();
    final sectorController = TextEditingController();
    final purposeController = TextEditingController();
    final qtyController = TextEditingController();
    final weightController = TextEditingController();

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
                  'Registrar Nuevo Lote',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: codeController,
                  label: 'Código del Lote',
                  hint: 'LOT-BOV-01',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: sectorController,
                  label: 'Sector',
                  hint: 'Bovino / Porcino / Avícola',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: purposeController,
                  label: 'Propósito',
                  hint: 'Ceba / Cría / Reproducción',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomTextField(
                        controller: qtyController,
                        label: 'Cantidad Animales',
                        hint: '30',
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: weightController,
                        label: 'Peso Promedio (kg)',
                        hint: '320.5',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Lote',
                  onPressed: () async {
                    if (codeController.text.trim().isEmpty) return;
                    final messenger = ScaffoldMessenger.of(context);
                    final lotProv = context.read<LotProvider>();
                    Navigator.pop(ctx);
                    final success = await lotProv.createLot({
                      'code': codeController.text.trim(),
                      'sector': sectorController.text.trim(),
                      'purpose': purposeController.text.trim(),
                      'quantity': int.tryParse(qtyController.text) ?? 1,
                      'initial_weight': double.tryParse(weightController.text) ?? 0.0,
                      'current_weight': double.tryParse(weightController.text) ?? 0.0,
                      'status': 'activo',
                    });
                    if (success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Lote creado exitosamente'),
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

  void _showEditLotDialog(LotModel lot) {
    final codeController = TextEditingController(text: lot.code);
    final sectorController = TextEditingController(text: lot.sector ?? '');
    final purposeController = TextEditingController(text: lot.purpose ?? '');
    final qtyController = TextEditingController(text: '${lot.quantity}');
    final weightController = TextEditingController(text: '${lot.currentWeight ?? ''}');

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
                Text(
                  'Editar Lote: ${lot.code}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: codeController,
                  label: 'Código del Lote',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: sectorController,
                  label: 'Sector',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: purposeController,
                  label: 'Propósito',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomTextField(
                        controller: qtyController,
                        label: 'Cantidad Animales',
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: weightController,
                        label: 'Peso Actual (kg)',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Actualizar Lote',
                  onPressed: () async {
                    if (codeController.text.trim().isEmpty) return;
                    final messenger = ScaffoldMessenger.of(context);
                    final lotProv = context.read<LotProvider>();
                    Navigator.pop(ctx);
                    final success = await lotProv.updateLot(lot.id, {
                      'code': codeController.text.trim(),
                      'sector': sectorController.text.trim(),
                      'purpose': purposeController.text.trim(),
                      'quantity': int.tryParse(qtyController.text) ?? lot.quantity,
                      'current_weight': double.tryParse(weightController.text) ?? lot.currentWeight,
                    });
                    if (success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Lote actualizado exitosamente'),
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

  void _confirmDeleteLot(LotModel lot) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Eliminar Lote'),
          content: Text('¿Está seguro de eliminar el lote "${lot.code}"? Esta acción no se puede deshacer.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final lotProv = context.read<LotProvider>();
                Navigator.pop(ctx);
                final success = await lotProv.deleteLot(lot.id);
                if (success) {
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text('Lote eliminado'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                } else {
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(lotProv.errorMessage ?? 'No se pudo eliminar el lote'),
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
    final lotProv = context.watch<LotProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lotes de Ganado'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => lotProv.loadLots(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddLotDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Lote', style: TextStyle(color: Colors.white)),
      ),
      body: lotProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : lotProv.lots.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.pets, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay lotes registrados.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primer Lote',
                          onPressed: _showAddLotDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => lotProv.loadLots(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: lotProv.lots.length,
                    itemBuilder: (context, index) {
                      final lot = lotProv.lots[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => LotDetailScreen(lot: lot),
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
                                        lot.code,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                    StatusBadge.forStatus(lot.status),
                                    PopupMenuButton<String>(
                                      icon: const Icon(Icons.more_vert, size: 20),
                                      onSelected: (val) {
                                        switch (val) {
                                          case 'edit':
                                            _showEditLotDialog(lot);
                                            break;
                                          case 'toggle':
                                            lotProv.toggleStatus(lot.id);
                                            break;
                                          case 'delete':
                                            _confirmDeleteLot(lot);
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
                                                lot.isActive ? Icons.toggle_off : Icons.toggle_on,
                                                size: 18,
                                                color: lot.isActive ? AppColors.warning : AppColors.success,
                                              ),
                                              const SizedBox(width: 8),
                                              Text(lot.isActive ? 'Cerrar / Desactivar' : 'Reactivar'),
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
                                    const Icon(Icons.pets, size: 16, color: AppColors.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${lot.quantity} animales',
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                    ),
                                    const SizedBox(width: 16),
                                    const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      lot.sector ?? 'Sin sector',
                                      style: const TextStyle(fontSize: 13),
                                    ),
                                  ],
                                ),
                                if (lot.purpose != null && lot.purpose!.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    'Propósito: ${lot.purpose}',
                                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                const Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    Text(
                                      'Ver animales y cosechas',
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
