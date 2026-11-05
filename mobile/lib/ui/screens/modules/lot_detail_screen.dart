import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/lot_model.dart';
import '../../../providers/lot_provider.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';

class LotDetailScreen extends StatefulWidget {
  final LotModel lot;

  const LotDetailScreen({super.key, required this.lot});

  @override
  State<LotDetailScreen> createState() => _LotDetailScreenState();
}

class _LotDetailScreenState extends State<LotDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LotProvider>().loadLotAnimals(widget.lot.id);
    });
  }

  void _showAddAnimalDialog() {
    final codeController = TextEditingController();
    final nameController = TextEditingController();
    final colorController = TextEditingController();
    final weightController = TextEditingController();
    String status = 'activo';

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
                      'Registrar Animal en ${widget.lot.code}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: codeController,
                      label: 'Arete / Código del Animal',
                      hint: 'B-102 / P-405',
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre / Alias (Opcional)',
                      hint: 'Margarita / Sansón',
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: CustomTextField(
                            controller: weightController,
                            label: 'Peso (kg)',
                            hint: '240.5',
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: CustomTextField(
                            controller: colorController,
                            label: 'Color / Señas',
                            hint: 'Negro overo / Blanco',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Estado Reproductivo / Productivo:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: status,
                      items: const [
                        DropdownMenuItem(value: 'activo', child: Text('Activo en Ceba/Levante')),
                        DropdownMenuItem(value: 'gestacion', child: Text('En Gestación')),
                        DropdownMenuItem(value: 'lactancia', child: Text('En Lactancia')),
                        DropdownMenuItem(value: 'destetado', child: Text('Destetado')),
                      ],
                      onChanged: (val) {
                        if (val != null) setModalState(() => status = val);
                      },
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Guardar Animal',
                      onPressed: () async {
                        if (codeController.text.trim().isEmpty) return;
                        final lotProv = context.read<LotProvider>();
                        final messenger = ScaffoldMessenger.of(context);
                        Navigator.pop(ctx);
                        final success = await lotProv.createAnimal(widget.lot.id, {
                          'code': codeController.text.trim().toUpperCase(),
                          'name': nameController.text.trim(),
                          'color': colorController.text.trim(),
                          'weight': double.tryParse(weightController.text),
                          'reproductive_status': status,
                          'is_active': true,
                        });
                        if (mounted && success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Animal registrado en el lote'),
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

  void _showHarvestDialog() {
    final qtyController = TextEditingController();
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
                  'Salida / Cosecha de Animales • ${widget.lot.code}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: qtyController,
                  label: 'Cantidad a retirar / vender',
                  hint: '5',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: notesController,
                  label: 'Motivo / Destino',
                  hint: 'Venta a frigorífico / Traslado',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Registrar Cosecha',
                  onPressed: () async {
                    final qty = int.tryParse(qtyController.text);
                    if (qty == null || qty <= 0) return;
                    final lotProv = context.read<LotProvider>();
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    final success = await lotProv.recordHarvest(
                      widget.lot.id,
                      qty,
                      notesController.text.trim(),
                    );
                    if (mounted && success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Cosecha de lote registrada exitosamente'),
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
    final lotProv = context.watch<LotProvider>();
    final animals = lotProv.currentLotAnimals;

    return Scaffold(
      appBar: AppBar(
        title: Text('Lote ${widget.lot.code}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.outbox),
            tooltip: 'Registrar Cosecha',
            onPressed: _showHarvestDialog,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddAnimalDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Animal', style: TextStyle(color: Colors.white)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Tarjeta resumen del lote
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      widget.lot.code,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    StatusBadge.forStatus(widget.lot.status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Sector: ${widget.lot.sector ?? 'General'} • Propósito: ${widget.lot.purpose ?? 'Engorde'}',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatItem('Total Animales', '${widget.lot.quantity}'),
                    _buildStatItem(
                      'Peso Inicial',
                      widget.lot.initialWeight != null ? '${widget.lot.initialWeight} kg' : 'N/A',
                    ),
                    _buildStatItem(
                      'Individuales',
                      '${animals.length}',
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text(
            'Trazabilidad Individual de Animales',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),

          if (lotProv.isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else if (animals.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: const Center(
                child: Text('No hay animales individuales registrados en este lote.'),
              ),
            )
          else
            ...animals.map(
              (a) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: AppColors.primarySoft,
                    child: Icon(Icons.tag, color: AppColors.primary, size: 20),
                  ),
                  title: Text(
                    a.code ?? 'Sin arete',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    '${a.name != null ? '${a.name} • ' : ''}Peso: ${a.weight != null ? '${a.weight} kg' : 'S/P'}\nEstado: ${a.reproductiveStatus?.toUpperCase() ?? 'ACTIVO'}',
                  ),
                  isThreeLine: true,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primary)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
      ],
    );
  }
}
