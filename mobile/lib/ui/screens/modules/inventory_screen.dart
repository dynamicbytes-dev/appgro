import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/inventory_model.dart';
import '../../../data/models/supplier_model.dart';
import '../../../data/models/warehouse_model.dart';
import '../../../providers/inventory_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InventoryProvider>().loadItems();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showRecordMovementDialog([InventoryItemModel? preselectedItem]) {
    final invProv = context.read<InventoryProvider>();
    final targetItem = preselectedItem ??
        (invProv.items.isNotEmpty ? invProv.items.first : null);

    if (targetItem == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay insumos registrados para mover')),
      );
      return;
    }

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
                      'Registrar Movimiento: ${targetItem.name}',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Stock actual: ${targetItem.currentStock} ${targetItem.unit}',
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 16),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                          value: 'salida',
                          label: Text('Salida / Consumo'),
                          icon: Icon(Icons.arrow_upward, color: AppColors.error),
                        ),
                        ButtonSegment(
                          value: 'entrada',
                          label: Text('Entrada / Compra'),
                          icon: Icon(Icons.arrow_downward,
                              color: AppColors.success),
                        ),
                      ],
                      selected: {movementType},
                      onSelectionChanged: (set) {
                        setModalState(() {
                          movementType = set.first;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: qtyController,
                      label: 'Cantidad (${targetItem.unit})',
                      hint: '10',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: reasonController,
                      label: 'Motivo o Observación',
                      hint: 'Ej: Aplicación en Lote Bovinos #1',
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Registrar Movimiento',
                      onPressed: () async {
                        final qty = double.tryParse(qtyController.text);
                        if (qty == null || qty <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Ingrese una cantidad válida')),
                          );
                          return;
                        }
                        final messenger = ScaffoldMessenger.of(context);
                        final prov = context.read<InventoryProvider>();
                        Navigator.pop(ctx);
                        final success = await prov.recordMovement({
                          'item_id': targetItem.id,
                          'type': movementType,
                          'quantity': qty,
                          'notes': reasonController.text.trim(),
                        });
                        if (success) {
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text(
                                  'Movimiento de $movementType registrado'),
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
    final catController = TextEditingController();
    final unitController = TextEditingController(text: 'kg');
    final stockController = TextEditingController(text: '50');
    final minStockController = TextEditingController(text: '10');

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
                  'Registrar Nuevo Insumo',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombre del Insumo',
                  hint: 'Concentrado Engorde Premium',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: codeController,
                  label: 'Código o SKU',
                  hint: 'CON-ENG-01',
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
                        hint: 'kg / litro / bulto',
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
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: minStockController,
                        label: 'Stock Mínimo Alerta',
                        hint: '10',
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Insumo',
                  onPressed: () async {
                    if (nameController.text.trim().isEmpty) return;
                    final messenger = ScaffoldMessenger.of(context);
                    final prov = context.read<InventoryProvider>();
                    Navigator.pop(ctx);
                    final success = await prov.createItem({
                      'name': nameController.text.trim(),
                      'code': codeController.text.trim(),
                      'category': catController.text.trim(),
                      'unit': unitController.text.trim(),
                      'current_stock':
                          double.tryParse(stockController.text) ?? 0.0,
                      'min_stock':
                          double.tryParse(minStockController.text) ?? 5.0,
                    });
                    if (success) {
                      messenger.showSnackBar(
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

  void _showEditItemDialog(InventoryItemModel item) {
    final nameController = TextEditingController(text: item.name);
    final codeController = TextEditingController(text: item.code ?? '');
    final catController = TextEditingController(text: item.category);
    final unitController = TextEditingController(text: item.unit);
    final stockController = TextEditingController(text: '${item.currentStock}');
    final minStockController = TextEditingController(text: '${item.minStock}');

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
                  'Editar Insumo: ${item.name}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombre del Insumo',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: codeController,
                  label: 'Código o SKU',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CustomTextField(
                        controller: catController,
                        label: 'Categoría',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: unitController,
                        label: 'Unidad de Medida',
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
                        label: 'Stock Actual',
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: CustomTextField(
                        controller: minStockController,
                        label: 'Stock Mínimo',
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Actualizar Insumo',
                  onPressed: () async {
                    if (nameController.text.trim().isEmpty) return;
                    final messenger = ScaffoldMessenger.of(context);
                    final prov = context.read<InventoryProvider>();
                    Navigator.pop(ctx);
                    final success = await prov.updateItem(item.id, {
                      'name': nameController.text.trim(),
                      'code': codeController.text.trim(),
                      'category': catController.text.trim(),
                      'unit': unitController.text.trim(),
                      'current_stock':
                          double.tryParse(stockController.text) ?? item.currentStock,
                      'min_stock':
                          double.tryParse(minStockController.text) ?? item.minStock,
                    });
                    if (success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Insumo actualizado exitosamente'),
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

  void _confirmDeleteItem(InventoryItemModel item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar Insumo'),
        content: Text('¿Está seguro de eliminar "${item.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final prov = context.read<InventoryProvider>();
              Navigator.pop(ctx);
              final ok = await prov.deleteItem(item.id);
              if (ok) {
                messenger.showSnackBar(
                  const SnackBar(content: Text('Insumo eliminado'), backgroundColor: AppColors.success),
                );
              }
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddWarehouseDialog() {
    final nameController = TextEditingController();
    final codeController = TextEditingController();
    final locController = TextEditingController();

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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Nueva Bodega o Almacén',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: nameController,
                label: 'Nombre de la Bodega',
                hint: 'Bodega Principal Sector A',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: codeController,
                label: 'Código',
                hint: 'BOD-01',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: locController,
                label: 'Ubicación / Sector',
                hint: 'Frente al establo lechero',
              ),
              const SizedBox(height: 20),
              CustomButton(
                text: 'Guardar Bodega',
                onPressed: () async {
                  if (nameController.text.trim().isEmpty) return;
                  final messenger = ScaffoldMessenger.of(context);
                  final prov = context.read<InventoryProvider>();
                  Navigator.pop(ctx);
                  final ok = await prov.createWarehouse({
                    'name': nameController.text.trim(),
                    'code': codeController.text.trim(),
                    'location': locController.text.trim(),
                  });
                  if (ok) {
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Bodega creada con éxito'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showEditWarehouseDialog(WarehouseModel w) {
    final nameController = TextEditingController(text: w.name);
    final codeController = TextEditingController(text: w.code ?? '');
    final locController = TextEditingController(text: w.location ?? '');

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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Editar Bodega: ${w.name}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: nameController,
                label: 'Nombre de la Bodega',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: codeController,
                label: 'Código',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: locController,
                label: 'Ubicación / Sector',
              ),
              const SizedBox(height: 20),
              CustomButton(
                text: 'Actualizar Bodega',
                onPressed: () async {
                  if (nameController.text.trim().isEmpty) return;
                  final messenger = ScaffoldMessenger.of(context);
                  final prov = context.read<InventoryProvider>();
                  Navigator.pop(ctx);
                  final ok = await prov.updateWarehouse(w.id, {
                    'name': nameController.text.trim(),
                    'code': codeController.text.trim(),
                    'location': locController.text.trim(),
                  });
                  if (ok) {
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Bodega actualizada'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _confirmDeleteWarehouse(WarehouseModel w) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar Bodega'),
        content: Text('¿Está seguro de eliminar "${w.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final prov = context.read<InventoryProvider>();
              Navigator.pop(ctx);
              final ok = await prov.deleteWarehouse(w.id);
              if (ok) {
                messenger.showSnackBar(
                  const SnackBar(content: Text('Bodega eliminada'), backgroundColor: AppColors.success),
                );
              }
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddSupplierDialog() {
    final nameController = TextEditingController();
    final contactController = TextEditingController();
    final phoneController = TextEditingController();
    final emailController = TextEditingController();

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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Nuevo Proveedor',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: nameController,
                label: 'Nombre Comercial / Empresa',
                hint: 'AgroInsumos del Llano C.A.',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: contactController,
                label: 'Persona de Contacto',
                hint: 'Lic. Carlos Mendoza',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: phoneController,
                label: 'Teléfono',
                hint: '+58 414 1234567',
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: emailController,
                label: 'Correo Electrónico',
                hint: 'ventas@agroinsumos.com',
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 20),
              CustomButton(
                text: 'Guardar Proveedor',
                onPressed: () async {
                  if (nameController.text.trim().isEmpty) return;
                  final messenger = ScaffoldMessenger.of(context);
                  final prov = context.read<InventoryProvider>();
                  Navigator.pop(ctx);
                  final ok = await prov.createSupplier({
                    'name': nameController.text.trim(),
                    'contact_name': contactController.text.trim(),
                    'phone': phoneController.text.trim(),
                    'email': emailController.text.trim(),
                  });
                  if (ok) {
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Proveedor guardado con éxito'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showEditSupplierDialog(SupplierModel s) {
    final nameController = TextEditingController(text: s.name);
    final contactController = TextEditingController(text: s.contactName ?? '');
    final phoneController = TextEditingController(text: s.phone ?? '');
    final emailController = TextEditingController(text: s.email ?? '');

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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Editar Proveedor: ${s.name}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: nameController,
                label: 'Nombre Comercial / Empresa',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: contactController,
                label: 'Persona de Contacto',
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: phoneController,
                label: 'Teléfono',
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              CustomTextField(
                controller: emailController,
                label: 'Correo Electrónico',
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 20),
              CustomButton(
                text: 'Actualizar Proveedor',
                onPressed: () async {
                  if (nameController.text.trim().isEmpty) return;
                  final messenger = ScaffoldMessenger.of(context);
                  final prov = context.read<InventoryProvider>();
                  Navigator.pop(ctx);
                  final ok = await prov.updateSupplier(s.id, {
                    'name': nameController.text.trim(),
                    'contact_name': contactController.text.trim(),
                    'phone': phoneController.text.trim(),
                    'email': emailController.text.trim(),
                  });
                  if (ok) {
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Proveedor actualizado'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _confirmDeleteSupplier(SupplierModel s) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar Proveedor'),
        content: Text('¿Está seguro de eliminar "${s.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final prov = context.read<InventoryProvider>();
              Navigator.pop(ctx);
              final ok = await prov.deleteSupplier(s.id);
              if (ok) {
                messenger.showSnackBar(
                  const SnackBar(content: Text('Proveedor eliminado'), backgroundColor: AppColors.success),
                );
              }
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final invProv = context.watch<InventoryProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventario Agropecuario'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(icon: Icon(Icons.inventory_2, size: 20), text: 'Insumos'),
            Tab(icon: Icon(Icons.swap_horiz, size: 20), text: 'Movimientos'),
            Tab(icon: Icon(Icons.warehouse, size: 20), text: 'Bodegas'),
            Tab(icon: Icon(Icons.local_shipping, size: 20), text: 'Proveedores'),
          ],
        ),
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
        onPressed: () {
          switch (_tabController.index) {
            case 0:
              _showAddItemDialog();
              break;
            case 1:
              _showRecordMovementDialog();
              break;
            case 2:
              _showAddWarehouseDialog();
              break;
            case 3:
              _showAddSupplierDialog();
              break;
          }
        },
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo', style: TextStyle(color: Colors.white)),
      ),
      body: invProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildItemsTab(invProv),
                _buildMovementsTab(invProv),
                _buildWarehousesTab(invProv),
                _buildSuppliersTab(invProv),
              ],
            ),
    );
  }

  Widget _buildItemsTab(InventoryProvider invProv) {
    if (invProv.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.inventory_2, size: 56, color: AppColors.textMuted),
              const SizedBox(height: 12),
              const Text(
                'No hay insumos registrados en el inventario.',
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
      );
    }

    return RefreshIndicator(
      onRefresh: () => invProv.loadItems(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: invProv.items.length,
        itemBuilder: (context, index) {
          final item = invProv.items[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
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
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert, size: 20),
                        onSelected: (val) {
                          if (val == 'edit') {
                            _showEditItemDialog(item);
                          } else if (val == 'move') {
                            _showRecordMovementDialog(item);
                          } else if (val == 'delete') {
                            _confirmDeleteItem(item);
                          }
                        },
                        itemBuilder: (ctx) => [
                          const PopupMenuItem(
                            value: 'move',
                            child: Row(
                              children: [
                                Icon(Icons.swap_horiz, size: 18, color: AppColors.primary),
                                SizedBox(width: 8),
                                Text('Registrar Movimiento'),
                              ],
                            ),
                          ),
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
                  const SizedBox(height: 6),
                  Text(
                    'Categoría: ${item.category.toUpperCase()} • SKU: ${item.code ?? 'N/A'}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
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
                          color: item.isLowStock
                              ? AppColors.error
                              : AppColors.primary,
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () => _showRecordMovementDialog(item),
                        icon: const Icon(Icons.swap_horiz, size: 16),
                        label: const Text('Mover Stock'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
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
    );
  }

  Widget _buildMovementsTab(InventoryProvider invProv) {
    if (invProv.movements.isEmpty) {
      return const Center(
        child: Text(
          'No se han registrado movimientos de inventario.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: invProv.movements.length,
      itemBuilder: (context, index) {
        final m = invProv.movements[index];
        final type = m['type']?.toString().toLowerCase() ?? 'salida';
        final isEntrada = type == 'entrada';
        final qty = m['quantity'] ?? m['cantidad'] ?? 0;
        final notes = m['notes'] ?? m['motivo'] ?? 'Sin nota';
        final date = m['created_at'] != null
            ? DateFormat('dd/MM/yyyy HH:mm')
                .format(DateTime.tryParse(m['created_at'].toString()) ?? DateTime.now())
            : 'Reciente';

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor:
                  isEntrada ? AppColors.successBg : AppColors.errorBg,
              child: Icon(
                isEntrada ? Icons.arrow_downward : Icons.arrow_upward,
                color: isEntrada ? AppColors.success : AppColors.error,
              ),
            ),
            title: Text(
              '${isEntrada ? '+' : '-'}$qty ${m['item_name'] ?? 'Insumo'}',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isEntrada ? AppColors.success : AppColors.error,
              ),
            ),
            subtitle: Text('$notes\n$date'),
            isThreeLine: true,
          ),
        );
      },
    );
  }

  Widget _buildWarehousesTab(InventoryProvider invProv) {
    if (invProv.warehouses.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.warehouse, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 12),
            const Text('No hay bodegas registradas'),
            const SizedBox(height: 16),
            CustomButton(
              text: 'Crear Bodega',
              onPressed: _showAddWarehouseDialog,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: invProv.warehouses.length,
      itemBuilder: (context, index) {
        final w = invProv.warehouses[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: AppColors.background,
              child: Icon(Icons.warehouse, color: AppColors.primary),
            ),
            title: Text(w.name, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Código: ${w.code ?? 'S/C'} • ${w.location ?? 'Sin ubicación'}'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: w.isActive ? AppColors.successBg : AppColors.errorBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    w.isActive ? 'Activo' : 'Inactivo',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: w.isActive ? AppColors.success : AppColors.error,
                    ),
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, size: 20),
                  onSelected: (val) {
                    if (val == 'edit') {
                      _showEditWarehouseDialog(w);
                    } else if (val == 'delete') {
                      _confirmDeleteWarehouse(w);
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
          ),
        );
      },
    );
  }

  Widget _buildSuppliersTab(InventoryProvider invProv) {
    if (invProv.suppliers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.local_shipping, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 12),
            const Text('No hay proveedores registrados'),
            const SizedBox(height: 16),
            CustomButton(
              text: 'Registrar Proveedor',
              onPressed: _showAddSupplierDialog,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: invProv.suppliers.length,
      itemBuilder: (context, index) {
        final s = invProv.suppliers[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: AppColors.background,
              child: Icon(Icons.business, color: AppColors.primary),
            ),
            title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Contacto: ${s.contactName ?? 'N/A'}\nTel: ${s.phone ?? 'N/A'} • ${s.email ?? ''}'),
            isThreeLine: true,
            trailing: PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20),
              onSelected: (val) {
                if (val == 'edit') {
                  _showEditSupplierDialog(s);
                } else if (val == 'delete') {
                  _confirmDeleteSupplier(s);
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
          ),
        );
      },
    );
  }
}
