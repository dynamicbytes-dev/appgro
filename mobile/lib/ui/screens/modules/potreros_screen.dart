import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/potrero_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';

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
    final haController = TextEditingController();
    final capController = TextEditingController();
    final pasturaController = TextEditingController();

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
                    Navigator.pop(ctx);
                    final success = await context.read<PotreroProvider>().createPotrero({
                      'name': nameController.text.trim(),
                      'code': codeController.text.trim(),
                      'sector': sectorController.text.trim(),
                      'superficie_ha': double.tryParse(haController.text) ?? 1.0,
                      'max_capacity': int.tryParse(capController.text) ?? 10,
                      'tipo_pastura': pasturaController.text.trim(),
                      'operational_status': 'disponible',
                      'is_active': true,
                    });
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
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

