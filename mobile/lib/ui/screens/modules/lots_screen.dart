import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/lot_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';

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
                  'Registrar Nuevo Lote Pecuario',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: codeController,
                  label: 'Código de Lote',
                  hint: 'LOTE-BOV-01',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: sectorController,
                  label: 'Sector / Ubicación',
                  hint: 'Potrero 2 / Corrales',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: purposeController,
                  label: 'Propósito',
                  hint: 'Ceba / Levante / Cría / Leche',
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
                        label: 'Peso Inicial Prom (kg)',
                        hint: '220.5',
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
                    Navigator.pop(ctx);
                    final success = await context.read<LotProvider>().createLot({
                      'code': codeController.text.trim().toUpperCase(),
                      'sector': sectorController.text.trim(),
                      'purpose': purposeController.text.trim(),
                      'quantity': int.tryParse(qtyController.text) ?? 1,
                      'initial_weight': double.tryParse(weightController.text),
                      'status': 'activo',
                    });
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Lote registrado exitosamente'),
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lotes y Ganadería'),
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
                          'No hay lotes pecuarios registrados.',
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
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    lot.code,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  StatusBadge.forStatus(lot.status),
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

