import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/root_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class RootFarmsScreen extends StatefulWidget {
  const RootFarmsScreen({super.key});

  @override
  State<RootFarmsScreen> createState() => _RootFarmsScreenState();
}

class _RootFarmsScreenState extends State<RootFarmsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RootProvider>().loadRootData();
    });
  }

  void _showAddFarmDialog() {
    final codeController = TextEditingController();
    final nameController = TextEditingController();
    final sectorController = TextEditingController();
    final locationController = TextEditingController();

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
                  'Registrar Nueva Granja',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: codeController,
                  label: 'Código de Finca (Único)',
                  hint: 'FINCA-01',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombre de la Granja',
                  hint: 'Hacienda La Esperanza',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: sectorController,
                  label: 'Sector',
                  hint: 'Valle Central',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: locationController,
                  label: 'Ubicación / Coordenadas',
                  hint: 'Km 15 Vía Principal',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Granja',
                  onPressed: () async {
                    if (codeController.text.isEmpty || nameController.text.isEmpty) return;
                    Navigator.pop(ctx);
                    final success = await context.read<RootProvider>().createFarm({
                      'code': codeController.text.trim().toUpperCase(),
                      'name': nameController.text.trim(),
                      'sector': sectorController.text.trim(),
                      'location': locationController.text.trim(),
                      'is_active': true,
                    });
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Granja registrada exitosamente'),
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
    final rootProv = context.watch<RootProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Granjas Registradas'),
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddFarmDialog,
        icon: const Icon(Icons.add_business, color: Colors.white),
        label: const Text('Nueva Granja', style: TextStyle(color: Colors.white)),
      ),
      body: rootProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : rootProv.farms.isEmpty
              ? const Center(child: Text('No hay granjas registradas'))
              : RefreshIndicator(
                  onRefresh: () => rootProv.loadRootData(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: rootProv.farms.length,
                    itemBuilder: (context, index) {
                      final farm = rootProv.farms[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppColors.primarySoft,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.agriculture, color: AppColors.primary),
                          ),
                          title: Text(
                            farm.name,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text('Código: ${farm.code} • ${farm.sector ?? 'General'}'),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: farm.isActive ? AppColors.successBg : AppColors.errorBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              farm.isActive ? 'ACTIVA' : 'INACTIVA',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: farm.isActive ? AppColors.success : AppColors.error,
                              ),
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

