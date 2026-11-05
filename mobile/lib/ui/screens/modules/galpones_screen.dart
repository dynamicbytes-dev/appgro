import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/galpon_model.dart';
import '../../../data/models/species_model.dart';
import '../../../providers/barn_provider.dart';
import '../../../providers/species_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/status_badge.dart';

class GalponesScreen extends StatefulWidget {
  const GalponesScreen({super.key});

  @override
  State<GalponesScreen> createState() => _GalponesScreenState();
}

class _GalponesScreenState extends State<GalponesScreen> {
  static const List<String> allowedCategories = ['avícola', 'porcina', 'cunícola'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BarnProvider>().loadGalpones();
      context.read<SpeciesProvider>().loadSpecies();
    });
  }

  List<String> _getPurposesForCategory(String? category) {
    final cat = (category ?? '').toLowerCase();
    if (cat.contains('av')) {
      return ['Carne', 'Huevos'];
    } else if (cat.contains('porc')) {
      return ['Carne', 'Reproducción'];
    } else if (cat.contains('cun')) {
      return ['Carne', 'Reproducción'];
    }
    return ['Carne', 'Reproducción', 'Huevos'];
  }

  void _showAddGalponDialog() {
    final speciesProv = context.read<SpeciesProvider>();
    final allowedSpecies = speciesProv.species.where((s) {
      final cat = (s.category ?? '').toLowerCase();
      return allowedCategories.any((ac) => cat.contains(ac.substring(0, 3)));
    }).toList();

    final nameController = TextEditingController();
    final capController = TextEditingController(text: '100');
    SpeciesModel? selectedSpecies = allowedSpecies.isNotEmpty ? allowedSpecies.first : null;
    String selectedPurpose = selectedSpecies != null
        ? _getPurposesForCategory(selectedSpecies.category).first
        : 'Carne';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final purposes = _getPurposesForCategory(selectedSpecies?.category);

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
                      'Registrar Nuevo Galpón / Nave',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre del Galpón',
                      hint: 'Ej: Galpón Aves #1 o Galpón Cerdos',
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Especie Alojada:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    if (allowedSpecies.isEmpty)
                      const Text(
                        'No hay especies avícolas o porcinas registradas. Cree una especie en "Especies y Razas" primero.',
                        style: TextStyle(color: AppColors.error, fontSize: 12),
                      )
                    else
                      DropdownButtonFormField<SpeciesModel>(
                        value: selectedSpecies,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        items: allowedSpecies.map((s) {
                          return DropdownMenuItem<SpeciesModel>(
                            value: s,
                            child: Text('${s.name} (${s.category?.toUpperCase() ?? 'GENERAL'})'),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setModalState(() {
                              selectedSpecies = val;
                              final newPurposes = _getPurposesForCategory(val.category);
                              if (!newPurposes.contains(selectedPurpose)) {
                                selectedPurpose = newPurposes.first;
                              }
                            });
                          }
                        },
                      ),
                    const SizedBox(height: 14),
                    const Text(
                      'Propósito Productivo:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedPurpose,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      items: purposes.map((p) {
                        return DropdownMenuItem<String>(
                          value: p,
                          child: Text(p),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedPurpose = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    CustomTextField(
                      controller: capController,
                      label: 'Capacidad Máxima de Animales',
                      hint: '100',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Guardar Galpón',
                      onPressed: () async {
                        if (nameController.text.trim().isEmpty || selectedSpecies == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Complete todos los campos obligatorios')),
                          );
                          return;
                        }
                        final messenger = ScaffoldMessenger.of(context);
                        final barnProv = context.read<BarnProvider>();
                        Navigator.pop(ctx);
                        final success = await barnProv.createGalpon({
                          'name': nameController.text.trim(),
                          'species_id': selectedSpecies!.id,
                          'sector': selectedSpecies!.category,
                          'purpose': selectedPurpose,
                          'max_capacity': int.tryParse(capController.text) ?? 100,
                          'is_active': true,
                        });
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Galpón registrado exitosamente'),
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

  void _showEditGalponDialog(GalponModel galpon) {
    final speciesProv = context.read<SpeciesProvider>();
    final allowedSpecies = speciesProv.species.where((s) {
      final cat = (s.category ?? '').toLowerCase();
      return allowedCategories.any((ac) => cat.contains(ac.substring(0, 3)));
    }).toList();

    final nameController = TextEditingController(text: galpon.name);
    final capController = TextEditingController(text: '${galpon.maxCapacity}');
    SpeciesModel? selectedSpecies = allowedSpecies.firstWhere(
      (s) => s.id == galpon.speciesId,
      orElse: () => allowedSpecies.isNotEmpty ? allowedSpecies.first : SpeciesModel(id: galpon.speciesId ?? 0, name: galpon.speciesName ?? 'Especie', isActive: true),
    );
    String selectedPurpose = galpon.purpose != null && galpon.purpose!.isNotEmpty
        ? galpon.purpose!
        : 'Carne';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final purposes = _getPurposesForCategory(selectedSpecies?.category ?? galpon.sector);

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
                      'Editar Galpón: ${galpon.name}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: nameController,
                      label: 'Nombre del Galpón',
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Especie Alojada:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<SpeciesModel>(
                      value: selectedSpecies,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      items: allowedSpecies.map((s) {
                        return DropdownMenuItem<SpeciesModel>(
                          value: s,
                          child: Text('${s.name} (${s.category?.toUpperCase() ?? 'GENERAL'})'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedSpecies = val;
                            final newPurposes = _getPurposesForCategory(val.category);
                            if (!newPurposes.contains(selectedPurpose)) {
                              selectedPurpose = newPurposes.first;
                            }
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Propósito Productivo:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: purposes.contains(selectedPurpose) ? selectedPurpose : purposes.first,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      items: purposes.map((p) {
                        return DropdownMenuItem<String>(
                          value: p,
                          child: Text(p),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedPurpose = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    CustomTextField(
                      controller: capController,
                      label: 'Capacidad Máxima',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 20),
                    CustomButton(
                      text: 'Actualizar Galpón',
                      onPressed: () async {
                        if (nameController.text.trim().isEmpty) return;
                        final messenger = ScaffoldMessenger.of(context);
                        final barnProv = context.read<BarnProvider>();
                        Navigator.pop(ctx);
                        final success = await barnProv.updateGalpon(galpon.id, {
                          'name': nameController.text.trim(),
                          'species_id': selectedSpecies?.id,
                          'purpose': selectedPurpose,
                          'max_capacity': int.tryParse(capController.text) ?? galpon.maxCapacity,
                        });
                        if (success) {
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Galpón actualizado exitosamente'),
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

  void _confirmDeleteGalpon(GalponModel galpon) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Eliminar Galpón'),
          content: Text('¿Está seguro de eliminar el galpón "${galpon.name}"? Esta acción no se puede deshacer.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                final barnProv = context.read<BarnProvider>();
                Navigator.pop(ctx);
                final success = await barnProv.deleteGalpon(galpon.id);
                if (success) {
                  messenger.showSnackBar(
                    const SnackBar(
                      content: Text('Galpón eliminado'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                } else {
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(barnProv.errorMessage ?? 'No se pudo eliminar el galpón'),
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

  void _showEggHarvestDialog(GalponModel galpon) {
    final qtyController = TextEditingController();
    final brokenController = TextEditingController();
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
                  'Registro de Postura • ${galpon.name}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: qtyController,
                  label: 'Huevos Recolectados (Unidades)',
                  hint: '350',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: brokenController,
                  label: 'Huevos Rotos / Mermas',
                  hint: '5',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                CustomTextField(
                  controller: notesController,
                  label: 'Observaciones',
                  hint: 'Novedades de la jornada...',
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Guardar Recolección',
                  onPressed: () async {
                    if (qtyController.text.trim().isEmpty) return;
                    final messenger = ScaffoldMessenger.of(context);
                    final barnProv = context.read<BarnProvider>();
                    Navigator.pop(ctx);
                    final success = await barnProv.recordEggHarvest(
                      galpon.id,
                      {
                        'quantity': int.tryParse(qtyController.text) ?? 0,
                        'broken_quantity': int.tryParse(brokenController.text) ?? 0,
                        'notes': notesController.text.trim(),
                        'harvest_date': DateTime.now().toIso8601String().substring(0, 10),
                      },
                    );
                    if (success) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('Postura registrada con éxito'),
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
    final barnProv = context.watch<BarnProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Galpones e Instalaciones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              barnProv.loadGalpones();
              context.read<SpeciesProvider>().loadSpecies();
            },
          ),
        ],
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showAddGalponDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Galpón', style: TextStyle(color: Colors.white)),
      ),
      body: barnProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : barnProv.galpones.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.warehouse, size: 56, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        const Text(
                          'No hay galpones registrados.',
                          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Crear Primer Galpón',
                          onPressed: _showAddGalponDialog,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => barnProv.loadGalpones(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: barnProv.galpones.length,
                    itemBuilder: (context, index) {
                      final g = barnProv.galpones[index];
                      final isAvicola = (g.sector ?? g.category ?? '').toLowerCase().contains('av');
                      final isPorcina = (g.sector ?? g.category ?? '').toLowerCase().contains('porc');
                      final isEggPurpose = (g.purpose ?? '').toLowerCase().contains('huevo') ||
                          (g.purpose ?? '').toLowerCase().contains('postura');

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
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  CircleAvatar(
                                    backgroundColor: isAvicola
                                        ? Colors.amber.shade100
                                        : isPorcina
                                            ? Colors.pink.shade100
                                            : AppColors.primarySoft,
                                    child: Icon(
                                      isAvicola
                                          ? Icons.flutter_dash
                                          : isPorcina
                                              ? Icons.pets
                                              : Icons.home_work,
                                      color: isAvicola
                                          ? Colors.amber.shade900
                                          : isPorcina
                                              ? Colors.pink.shade800
                                              : AppColors.primary,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          g.name,
                                          style: const TextStyle(
                                            fontSize: 17,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Especie: ${g.speciesName ?? 'N/A'} • Sector: ${(g.sector ?? g.category ?? 'General').toUpperCase()}',
                                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                        ),
                                      ],
                                    ),
                                  ),
                                  StatusBadge.forStatus(g.isActive ? 'activo' : 'inactivo'),
                                  PopupMenuButton<String>(
                                    icon: const Icon(Icons.more_vert, size: 20),
                                    onSelected: (val) {
                                      switch (val) {
                                        case 'edit':
                                          _showEditGalponDialog(g);
                                          break;
                                        case 'toggle':
                                          barnProv.toggleStatus(g.id);
                                          break;
                                        case 'delete':
                                          _confirmDeleteGalpon(g);
                                          break;
                                        case 'eggs':
                                          _showEggHarvestDialog(g);
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
                                      PopupMenuItem(
                                        value: 'toggle',
                                        child: Row(
                                          children: [
                                            Icon(
                                              g.isActive ? Icons.toggle_off : Icons.toggle_on,
                                              size: 18,
                                              color: g.isActive ? AppColors.warning : AppColors.success,
                                            ),
                                            const SizedBox(width: 8),
                                            Text(g.isActive ? 'Desactivar' : 'Activar'),
                                          ],
                                        ),
                                      ),
                                      if (isEggPurpose || isAvicola)
                                        const PopupMenuItem(
                                          value: 'eggs',
                                          child: Row(
                                            children: [
                                              Icon(Icons.egg, size: 18, color: Colors.orange),
                                              SizedBox(width: 8),
                                              Text('Registrar Postura'),
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
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.primarySoft,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'Propósito: ${g.purpose ?? 'Carne'}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    'Capacidad: ${g.maxCapacity} plazas',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              if (g.occupiedCapacity > 0 || g.availableCapacity > 0) ...[
                                const SizedBox(height: 8),
                                LinearProgressIndicator(
                                  value: g.maxCapacity > 0 ? (g.occupiedCapacity / g.maxCapacity).clamp(0.0, 1.0) : 0.0,
                                  backgroundColor: AppColors.cardBorder,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Ocupados: ${g.occupiedCapacity}',
                                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                    Text(
                                      'Disponibles: ${g.availableCapacity}',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.success),
                                    ),
                                  ],
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
