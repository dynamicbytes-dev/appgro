import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/species_model.dart';
import '../../../providers/species_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class SpeciesScreen extends StatefulWidget {
  const SpeciesScreen({super.key});

  @override
  State<SpeciesScreen> createState() => _SpeciesScreenState();
}

class _SpeciesScreenState extends State<SpeciesScreen> {
  static const List<String> canonicalCategories = [
    'avícola',
    'porcina',
    'bovina',
    'ovina',
    'caprina',
    'cunícola',
    'piscícola',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SpeciesProvider>().loadSpecies();
    });
  }

  void _showAddSpeciesDialog() {
    final nameController = TextEditingController();
    String selectedCat = 'avícola';
    final purposeController = TextEditingController(text: 'Carne');

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
                      'Registrar Especie Zootécnica',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre de la Especie',
                      hint: 'Pollo de Engorde / Cerdo Blanco / Bovino Brahman',
                    ),
                    const SizedBox(height: 14),
                    const Text('Categoría / Sector:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedCat,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      items: canonicalCategories.map((c) {
                        return DropdownMenuItem(
                          value: c,
                          child: Text(c.toUpperCase()),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedCat = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    CustomTextField(
                      controller: purposeController,
                      label: 'Propósito',
                      hint: 'Carne / Leche / Huevos / Reproducción',
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Guardar Especie',
                      onPressed: () async {
                        if (nameController.text.trim().isEmpty) return;
                        final messenger = ScaffoldMessenger.of(context);
                        final speciesProv = context.read<SpeciesProvider>();
                        Navigator.pop(ctx);
                        final success = await speciesProv.createSpecies({
                          'name': nameController.text.trim(),
                          'category': selectedCat,
                          'purpose': purposeController.text.trim(),
                          'is_active': true,
                        });
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Especie registrada exitosamente'),
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

  void _showEditSpeciesDialog(SpeciesModel s) {
    final nameController = TextEditingController(text: s.name);
    String selectedCat = canonicalCategories.contains(s.category?.toLowerCase())
        ? s.category!.toLowerCase()
        : canonicalCategories.first;
    final purposeController = TextEditingController(text: s.purpose ?? '');

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
                      'Editar Especie: ${s.name}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre de la Especie',
                    ),
                    const SizedBox(height: 14),
                    const Text('Categoría / Sector:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedCat,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      items: canonicalCategories.map((c) {
                        return DropdownMenuItem(
                          value: c,
                          child: Text(c.toUpperCase()),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedCat = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    CustomTextField(
                      controller: purposeController,
                      label: 'Propósito',
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Actualizar Especie',
                      onPressed: () async {
                        if (nameController.text.trim().isEmpty) return;
                        final messenger = ScaffoldMessenger.of(context);
                        final speciesProv = context.read<SpeciesProvider>();
                        Navigator.pop(ctx);
                        final success = await speciesProv.updateSpecies(s.id, {
                          'name': nameController.text.trim(),
                          'category': selectedCat,
                          'purpose': purposeController.text.trim(),
                        });
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Especie actualizada exitosamente'),
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

  void _confirmDeleteSpecies(SpeciesModel s) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Eliminar Especie'),
          content: Text('¿Está seguro de eliminar "${s.name}"? Si está asignada a galpones o lotes activos no podrá eliminarse.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final speciesProv = context.read<SpeciesProvider>();
                Navigator.pop(ctx);
                final success = await speciesProv.deleteSpecies(s.id);
                if (success) {
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text('Especie eliminada'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                } else {
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(speciesProv.errorMessage ?? 'No se pudo eliminar la especie'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              },
              child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final speciesProv = context.watch<SpeciesProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Especies Pecuarias'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => speciesProv.loadSpecies(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddSpeciesDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nueva Especie', style: TextStyle(color: Colors.white)),
      ),
      body: speciesProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : speciesProv.species.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.pets, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay especies registradas.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primera Especie',
                          onPressed: _showAddSpeciesDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => speciesProv.loadSpecies(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: speciesProv.species.length,
                    itemBuilder: (context, index) {
                      final s = speciesProv.species[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: AppColors.primarySoft,
                            child: Icon(Icons.pets, color: AppColors.primary, size: 20),
                          ),
                          title: Text(
                            s.name,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text('Sector: ${(s.category ?? 'General').toUpperCase()} • Propósito: ${s.purpose ?? 'N/A'}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Switch(
                                value: s.isActive,
                                activeColor: AppColors.primary,
                                onChanged: (_) => speciesProv.toggleStatus(s.id),
                              ),
                              PopupMenuButton<String>(
                                icon: const Icon(Icons.more_vert, size: 20),
                                onSelected: (val) {
                                  switch (val) {
                                    case 'edit':
                                      _showEditSpeciesDialog(s);
                                      break;
                                    case 'delete':
                                      _confirmDeleteSpecies(s);
                                      break;
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
                  ),
                ),
    );
  }
}
