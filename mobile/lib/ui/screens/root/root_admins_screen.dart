import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/root_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class RootAdminsScreen extends StatefulWidget {
  const RootAdminsScreen({super.key});

  @override
  State<RootAdminsScreen> createState() => _RootAdminsScreenState();
}

class _RootAdminsScreenState extends State<RootAdminsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RootProvider>().loadRootData();
    });
  }

  void _showAddAdminDialog() {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    final rootProv = context.read<RootProvider>();
    int? selectedFarmId = rootProv.farms.isNotEmpty ? rootProv.farms.first.id : null;

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
                    const Text(
                      'Crear Nuevo Administrador',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre Completo',
                      hint: 'Juan Pérez',
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: emailController,
                      label: 'Correo Electrónico',
                      hint: 'admin@granja.com',
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      controller: passwordController,
                      label: 'Contraseña Temporal',
                      hint: '••••••••',
                      obscureText: true,
                    ),
                    const SizedBox(height: 12),
                    if (rootProv.farms.isNotEmpty) ...[
                      const Text(
                        'Asignar a Finca:',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<int>(
                        value: selectedFarmId,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        items: rootProv.farms.map((f) {
                          return DropdownMenuItem<int>(
                            value: f.id,
                            child: Text(f.name),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setModalState(() {
                            selectedFarmId = val;
                          });
                        },
                      ),
                    ],
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Registrar Administrador',
                      onPressed: () async {
                        if (nameController.text.trim().isEmpty ||
                            emailController.text.trim().isEmpty ||
                            passwordController.text.isEmpty) {
                          return;
                        }
                        final messenger = ScaffoldMessenger.of(context);
                        final rootP = context.read<RootProvider>();
                        Navigator.pop(ctx);
                        final success = await rootP.createAdmin({
                          'name': nameController.text.trim(),
                          'email': emailController.text.trim(),
                          'password': passwordController.text,
                          'password_confirmation': passwordController.text,
                          'role': 'admin',
                          'farm_id': selectedFarmId,
                        });
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Administrador creado exitosamente'),
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

  @override
  Widget build(BuildContext context) {
    final rootProv = context.watch<RootProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Administradores del Sistema'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => rootProv.loadRootData(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddAdminDialog,
        icon: const Icon(Icons.person_add, color: Colors.white),
        label: const Text('Nuevo Admin', style: TextStyle(color: Colors.white)),
      ),
      body: rootProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : rootProv.admins.isEmpty
              ? const Center(
                  child: Text(
                    'No hay administradores registrados.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => rootProv.loadRootData(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: rootProv.admins.length,
                    itemBuilder: (context, index) {
                      final admin = rootProv.admins[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: admin.isActive ? AppColors.primary : AppColors.textMuted,
                            child: Text(
                              admin.name.isNotEmpty ? admin.name[0].toUpperCase() : 'A',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(
                            admin.name,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text(
                            '${admin.email}\nRol: ${admin.role.toUpperCase()}',
                          ),
                          isThreeLine: true,
                          trailing: Switch(
                            value: admin.isActive,
                            activeColor: AppColors.primary,
                            onChanged: (val) {
                              rootProv.toggleAdminStatus(admin.id);
                            },
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
