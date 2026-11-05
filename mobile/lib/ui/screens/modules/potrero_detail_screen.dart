import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/potrero_model.dart';
import '../../../providers/potrero_provider.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';

class PotreroDetailScreen extends StatefulWidget {
  final PotreroModel potrero;

  const PotreroDetailScreen({super.key, required this.potrero});

  @override
  State<PotreroDetailScreen> createState() => _PotreroDetailScreenState();
}

class _PotreroDetailScreenState extends State<PotreroDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PotreroProvider>().loadPotreroManagement(widget.potrero.id);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showAddBiomassDialog() {
    final kgController = TextEditingController();
    final methodController = TextEditingController(text: 'Muestreo Cuadrante');
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
                  'Nuevo Aforo de Biomasa • ${widget.potrero.name}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: kgController,
                  label: 'Disponibilidad Forrajera (kg MS / ha)',
                  hint: '2500',
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: methodController,
                  label: 'Método de Aforo',
                  hint: 'Cuadrante / Platómetro / Estimación visual',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: notesController,
                  label: 'Observaciones',
                  hint: 'Estado del pasto, altura promedio...',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Aforo',
                  onPressed: () async {
                    final kg = double.tryParse(kgController.text);
                    if (kg == null || kg <= 0) return;
                    final potreroProv = context.read<PotreroProvider>();
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    final success = await potreroProv.recordBiomass(widget.potrero.id, {
                      'biomass_kg_ha': kg,
                      'survey_method': methodController.text.trim(),
                      'notes': notesController.text.trim(),
                      'survey_date': DateTime.now().toIso8601String().substring(0, 10),
                    });
                    if (mounted && success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Aforo de biomasa guardado'),
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

  void _showAddTreatmentDialog() {
    final typeController = TextEditingController(text: 'fertilizacion');
    final productController = TextEditingController();
    final doseController = TextEditingController();
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
                  'Tratamiento Agronómico • ${widget.potrero.name}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: typeController,
                  label: 'Tipo de Tratamiento',
                  hint: 'fertilizacion / encalado / herbicida / riego',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: productController,
                  label: 'Producto / Enmienda Aplicada',
                  hint: 'Urea / Cal Dolomítica / Abono orgánico',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: doseController,
                  label: 'Dosis por Hectárea',
                  hint: '100 kg/ha',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: notesController,
                  label: 'Observaciones',
                  hint: 'Condiciones climáticas, lote aplicado...',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Tratamiento',
                  onPressed: () async {
                    if (productController.text.trim().isEmpty) return;
                    final potreroProv = context.read<PotreroProvider>();
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    final success = await potreroProv.recordTreatment(widget.potrero.id, {
                      'treatment_type': typeController.text.trim(),
                      'product_name': productController.text.trim(),
                      'dosage': doseController.text.trim(),
                      'notes': notesController.text.trim(),
                      'treatment_date': DateTime.now().toIso8601String().substring(0, 10),
                    });
                    if (mounted && success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Tratamiento agronómico registrado'),
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
    final biomass = potreroProv.currentBiomass;
    final treatments = potreroProv.currentTreatments;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.potrero.name),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: [
            Tab(text: 'Aforos (${biomass.length})'),
            Tab(text: 'Tratamientos (${treatments.length})'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () {
          if (_tabController.index == 0) {
            _showAddBiomassDialog();
          } else {
            _showAddTreatmentDialog();
          }
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: Column(
        children: [
          // Header del Potrero
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Área: ${widget.potrero.superficieHa} ha • Capacidad: ${widget.potrero.maxCapacity} an.',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Pastura: ${widget.potrero.tipoPastura ?? 'No especificada'}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                StatusBadge.forStatus(widget.potrero.operationalStatus),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: potreroProv.isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      // Pestaña 1: Aforos
                      biomass.isEmpty
                          ? const Center(child: Text('No hay aforos de biomasa registrados.'))
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: biomass.length,
                              itemBuilder: (context, index) {
                                final b = biomass[index];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: ListTile(
                                    leading: const CircleAvatar(
                                      backgroundColor: AppColors.successBg,
                                      child: Icon(Icons.grass, color: AppColors.success),
                                    ),
                                    title: Text(
                                      '${b['biomass_kg_ha'] ?? b['dry_matter_kg_ha'] ?? 'N/A'} kg MS / ha',
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                    subtitle: Text(
                                      'Método: ${b['survey_method'] ?? 'Muestreo'} • Fecha: ${b['survey_date'] ?? 'Reciente'}',
                                    ),
                                  ),
                                );
                              },
                            ),

                      // Pestaña 2: Tratamientos
                      treatments.isEmpty
                          ? const Center(child: Text('No hay tratamientos agronómicos registrados.'))
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: treatments.length,
                              itemBuilder: (context, index) {
                                final t = treatments[index];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: ListTile(
                                    leading: const CircleAvatar(
                                      backgroundColor: AppColors.infoBg,
                                      child: Icon(Icons.science, color: AppColors.info),
                                    ),
                                    title: Text(
                                      t['product_name'] ?? t['treatment_type'] ?? 'Tratamiento',
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                    subtitle: Text(
                                      'Dosis: ${t['dosage'] ?? 'N/A'} • Fecha: ${t['treatment_date'] ?? 'Reciente'}',
                                    ),
                                  ),
                                );
                              },
                            ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

