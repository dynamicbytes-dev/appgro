import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/history_provider.dart';
import '../../widgets/app_drawer.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  String _selectedFilter = 'TODOS';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HistoryProvider>().loadLogs();
    });
  }

  Color _getActionColor(String action) {
    switch (action.toUpperCase()) {
      case 'CREAR':
      case 'CREATE':
        return AppColors.success;
      case 'ACTUALIZAR':
      case 'UPDATE':
        return AppColors.primary;
      case 'ELIMINAR':
      case 'DELETE':
        return AppColors.error;
      default:
        return AppColors.accent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final historyProv = context.watch<HistoryProvider>();

    final allLogs = historyProv.logs;
    final filteredLogs = _selectedFilter == 'TODOS'
        ? allLogs
        : allLogs.where((l) => l.module.toUpperCase() == _selectedFilter).toList();

    final modules = ['TODOS', ...allLogs.map((e) => e.module.toUpperCase()).toSet()];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Auditoría e Historial'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => historyProv.loadLogs(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: historyProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (modules.length > 1)
                  SizedBox(
                    height: 50,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      scrollDirection: Axis.horizontal,
                      itemCount: modules.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final mod = modules[index];
                        final isSelected = mod == _selectedFilter;
                        return ChoiceChip(
                          label: Text(
                            mod,
                            style: TextStyle(
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: AppColors.primary,
                          onSelected: (val) {
                            if (val) {
                              setState(() {
                                _selectedFilter = mod;
                              });
                            }
                          },
                        );
                      },
                    ),
                  ),
                Expanded(
                  child: filteredLogs.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.history_toggle_off, size: 56, color: AppColors.textMuted),
                              SizedBox(height: 12),
                              Text(
                                'No hay registros de auditoría.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => historyProv.loadLogs(),
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: filteredLogs.length,
                            itemBuilder: (context, index) {
                              final log = filteredLogs[index];
                              final actionColor = _getActionColor(log.action);
                              final dateStr = log.createdAt != null
                                  ? DateFormat('dd/MM/yyyy HH:mm').format(
                                      DateTime.tryParse(log.createdAt!) ?? DateTime.now())
                                  : 'Reciente';

                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: actionColor.withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(8),
                                              border: Border.all(
                                                  color: actionColor.withOpacity(0.3)),
                                            ),
                                            child: Text(
                                              log.action.toUpperCase(),
                                              style: TextStyle(
                                                color: actionColor,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 11,
                                              ),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: AppColors.background,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              log.module,
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w600,
                                                color: AppColors.textSecondary,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        log.description,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.person,
                                                  size: 14, color: AppColors.textMuted),
                                              const SizedBox(width: 4),
                                              Text(
                                                log.userName ?? 'Sistema',
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  color: AppColors.textSecondary,
                                                ),
                                              ),
                                            ],
                                          ),
                                          Text(
                                            dateStr,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.textMuted,
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
                ),
              ],
            ),
    );
  }
}
