import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/inventory_model.dart';
import '../../../providers/inventory_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InventoryProvider>().loadItems();
    });
  }

  void _showRecordMovementDialog(InventoryItemModel item) {
    final qtyController = TextEditingController();
    final reasonController = TextEditingController();
    String movementType = 'salida';

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
                      'Movimiento: ${item.name}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Stock actual: ${item.currentStock} ${item.unit}',
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Consumo / Salida')),
                            selected: movementType == 'salida',
                            selectedColor: AppColors.primarySoft,
                            onSelected: (val) {
                              if (val) setModalState(() => movementType = 'salida');
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Entrada / Compra')),
                            selected: movementType == 'entrada',
                            selectedColor: AppColors.primarySoft,
                            onSelected: (val) {
                              if (val) setModalState(() => movementType = 'entrada');
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: qtyController,
                      label: 'Cantidad (${item.unit})',
                      hint: '10',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: reasonController,
                      label: 'Motivo / Destino',
                      hint: 'Consumo en potrero 3 / Tratamiento sanitario',
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Registrar Movimiento',
                      onPressed: () async {
                        final qty = double.tryParse(qtyController.text);
                        if (qty == null || qty <= 0) return;
                        final invProvider = context.read<InventoryProvider>();
                        final messenger = ScaffoldMessenger.of(context);
                        Navigator.pop(ctx);
                        final success = await invProvider.recordMovement({
                          'item_id': item.id,
                          'type': movementType,
                          'quantity': qty,
                          'reason': reasonController.text.trim(),
                        });
                        if (mounted && success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Movimiento de inventario guardado'),
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

  void _showAddItemDialog() {
    final nameController = TextEditingController();
    final codeController = TextEditingController();
    final catController = TextEditingController(text: 'alimento');
    final unitController = TextEditingController(text: 'kg');
    final stockController = TextEditingController();
    final minStockController = TextEditingController();

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
                  'Registrar Nuevo Insumo / Producto',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombre del Insumo',
                  hint: 'Alimento Concentrado Iniciador / Ivermectina 1%',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: codeController,
                  label: 'Código SKU',
                  hint: 'INS-001',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomTextField(
                        controller: catController,
                        label: 'Categoría',
                        hint: 'alimento / medicamento / fertilizante',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: unitController,
                        label: 'Unidad de Medida',
                        hint: 'kg / litro / bulto / unidad',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomTextField(
                        controller: stockController,
                        label: 'Stock Inicial',
                        hint: '50',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: minStockController,
                        label: 'Stock Mínimo (Alerta)',
                        hint: '10',
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Insumo',
                  onPressed: () async {
                    if (nameController.text.trim().isEmpty) return;
                    Navigator.pop(ctx);
                    final success = await context.read<InventoryProvider>().createItem({
                      'name': nameController.text.trim(),
                      'code': codeController.text.trim(),
                      'category': catController.text.trim(),
                      'unit': unitController.text.trim(),
                      'current_stock': double.tryParse(stockController.text) ?? 0.0,
                      'min_stock': double.tryParse(minStockController.text) ?? 5.0,
                    });
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Insumo registrado exitosamente'),
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
    final invProv = context.watch<InventoryProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventario Agropecuario'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => invProv.loadItems(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddItemDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Insumo', style: TextStyle(color: Colors.white)),
      ),
      body: invProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : invProv.items.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.inventory_2, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay insumos en el inventario.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primer Insumo',
                          onPressed: _showAddItemDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => invProv.loadItems(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: invProv.items.length,
                    itemBuilder: (context, index) {
                      final item = invProv.items[index];
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
                                      item.name,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  if (item.isLowStock)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppColors.errorBg,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Text(
                                        'STOCK BAJO',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.error,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Categoría: ${item.category.toUpperCase()} • SKU: ${item.code ?? 'N/A'}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${item.currentStock} ${item.unit}',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: item.isLowStock ? AppColors.error : AppColors.primary,
                                    ),
                                  ),
                                  ElevatedButton.icon(
                                    onPressed: () => _showRecordMovementDialog(item),
                                    icon: const Icon(Icons.swap_horiz, size: 16),
                                    label: const Text('Movimiento'),
                                    style: ElevatedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    ),
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
