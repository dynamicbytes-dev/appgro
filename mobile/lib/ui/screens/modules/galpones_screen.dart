import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/galpon_model.dart';
import '../../../providers/barn_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class GalponesScreen extends StatefulWidget {
  const GalponesScreen({super.key});

  @override
  State<GalponesScreen> createState() => _GalponesScreenState();
}

class _GalponesScreenState extends State<GalponesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BarnProvider>().loadGalpones();
    });
  }

  void _showEggHarvestDialog(GalponModel galpon) {
    final qtyController = TextEditingController();
    final brokenController = TextEditingController();
    final notesController = TextEditingController();

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
                  'Registro de Postura • ${galpon.name}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: qtyController,
                  label: 'Huevos Recolectados (Unidades)',
                  hint: '350',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: brokenController,
                  label: 'Huevos Rotos / Mermas',
                  hint: '5',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: notesController,
                  label: 'Observaciones',
                  hint: 'Novedades de la jornada...',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Recolección',
                  onPressed: () async {
                    if (qtyController.text.trim().isEmpty) return;
                    Navigator.pop(ctx);
                    final success = await context.read<BarnProvider>().recordEggHarvest(
                      galpon.id,
                      {
                        'quantity': int.tryParse(qtyController.text) ?? 0,
                        'broken_quantity': int.tryParse(brokenController.text) ?? 0,
                        'notes': notesController.text.trim(),
                        'harvest_date': DateTime.now().toIso8601String().substring(0, 10),
                      },
                    );
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Postura registrada con éxito'),
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

  void _showAddGalponDialog() {
    final nameController = TextEditingController();
    final sectorController = TextEditingController();
    final purposeController = TextEditingController();
    final capController = TextEditingController();

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
                  'Registrar Nuevo Galpón / Nave',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombre del Galpón',
                  hint: 'Galpón de Postura #1',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: sectorController,
                  label: 'Sector',
                  hint: 'Área Avícola Central',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: purposeController,
                  label: 'Propósito / Tipo',
                  hint: 'Ponedoras / Pollos de Engorde / Maternidad',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: capController,
                  label: 'Capacidad Máxima (Aves/Animales)',
                  hint: '1000',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Galpón',
                  onPressed: () async {
                    if (nameController.text.trim().isEmpty) return;
                    Navigator.pop(ctx);
                    final success = await context.read<BarnProvider>().createGalpon({
                      'name': nameController.text.trim(),
                      'sector': sectorController.text.trim(),
                      'purpose': purposeController.text.trim(),
                      'max_capacity': int.tryParse(capController.text) ?? 500,
                      'is_active': true,
                    });
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Galpón registrado exitosamente'),
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

  @override
  Widget build(BuildContext context) {
    final barnProv = context.watch<BarnProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Galpones e Instalaciones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => barnProv.loadGalpones(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddGalponDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Galpón', style: TextStyle(color: Colors.white)),
      ),
      body: barnProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : barnProv.galpones.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.warehouse, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay galpones registrados.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primer Galpón',
                          onPressed: _showAddGalponDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => barnProv.loadGalpones(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: barnProv.galpones.length,
                    itemBuilder: (context, index) {
                      final g = barnProv.galpones[index];
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
                                      g.name,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  TextButton.icon(
                                    onPressed: () => _showEggHarvestDialog(g),
                                    icon: const Icon(Icons.egg, size: 18),
                                    label: const Text('Postura'),
                                    style: TextButton.styleFrom(
                                      foregroundColor: AppColors.secondary,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Sector: ${g.sector ?? 'General'} • Tipo: ${g.purpose ?? 'Avícola'}',
                                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(Icons.group, size: 16, color: AppColors.textMuted),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Capacidad: ${g.maxCapacity} animales',
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
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

