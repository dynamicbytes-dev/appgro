import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/farm_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class AdminSubordinatesScreen extends StatefulWidget {
  const AdminSubordinatesScreen({super.key});

  @override
  State<AdminSubordinatesScreen> createState() => _AdminSubordinatesScreenState();
}

class _AdminSubordinatesScreenState extends State<AdminSubordinatesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FarmProvider>().loadDashboard();
    });
  }

  void _showAddSubordinateDialog() {
    final nameController = TextEditingController();
    final lastnameController = TextEditingController();
    final emailController = TextEditingController();
    final phoneController = TextEditingController();
    final passwordController = TextEditingController();

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
                  'Registrar Encargado / Supervisor',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: nameController,
                  label: 'Nombres',
                  hint: 'Juan',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: lastnameController,
                  label: 'Apellidos',
                  hint: 'Pérez',
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: emailController,
                  label: 'Correo Electrónico',
                  hint: 'juan.perez@finca.com',
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: phoneController,
                  label: 'Teléfono',
                  hint: '+58 412 1234567',
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: passwordController,
                  label: 'Contraseña Temporal',
                  hint: '••••••••',
                  obscureText: true,
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Encargado',
                  onPressed: () async {
                    if (nameController.text.isEmpty ||
                        emailController.text.isEmpty ||
                        passwordController.text.isEmpty) {
                      return;
                    }
                    Navigator.pop(ctx);
                    final success = await context.read<FarmProvider>().createSubordinate({
                      'name': nameController.text.trim(),
                      'lastname': lastnameController.text.trim(),
                      'email': emailController.text.trim(),
                      'phone': phoneController.text.trim(),
                      'password': passwordController.text,
                    });
                    if (mounted && success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Encargado registrado exitosamente'),
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
    final farmProv = context.watch<FarmProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Equipo de Campo'),
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddSubordinateDialog,
        icon: const Icon(Icons.person_add, color: Colors.white),
        label: const Text('Nuevo Encargado', style: TextStyle(color: Colors.white)),
      ),
      body: farmProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : farmProv.subordinates.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.people_outline, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay encargados registrados en esta finca.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primer Encargado',
                          onPressed: _showAddSubordinateDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => farmProv.loadDashboard(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: farmProv.subordinates.length,
                    itemBuilder: (context, index) {
                      final sub = farmProv.subordinates[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.primarySoft,
                            child: Text(
                              sub.name.isNotEmpty ? sub.name[0].toUpperCase() : 'E',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          title: Text(
                            sub.fullName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text('${sub.email}\n${sub.phone ?? 'Sin teléfono'}'),
                          isThreeLine: true,
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: sub.isActive ? AppColors.successBg : AppColors.errorBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              sub.isActive ? 'ACTIVO' : 'INACTIVO',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: sub.isActive ? AppColors.success : AppColors.error,
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

