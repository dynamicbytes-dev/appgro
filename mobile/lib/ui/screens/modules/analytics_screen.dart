import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/analytics_provider.dart';
import '../../widgets/app_drawer.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AnalyticsProvider>().loadAllAnalytics();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final analytics = context.watch<AnalyticsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analítica y Rendimiento'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => analytics.loadAllAnalytics(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(icon: Icon(Icons.dashboard, size: 20), text: 'Ejecutivo'),
            Tab(icon: Icon(Icons.precision_manufacturing, size: 20), text: 'Operaciones'),
            Tab(icon: Icon(Icons.attach_money, size: 20), text: 'Financiero'),
            Tab(icon: Icon(Icons.people, size: 20), text: 'Personal'),
          ],
        ),
      ),
      drawer: const AppDrawer(),
      body: analytics.isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildSummaryTab(analytics.summary),
                _buildOperationsTab(analytics.operations),
                _buildFinancialTab(analytics.financial),
                _buildStaffTab(analytics.staff),
              ],
            ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    String? subtitle,
    String? trend,
    bool isPositive = true,
  }) {
    return Card(
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
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            if (subtitle != null || trend != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  if (trend != null) ...[
                    Icon(
                      isPositive ? Icons.trending_up : Icons.trending_down,
                      size: 16,
                      color: isPositive ? AppColors.success : AppColors.error,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      trend,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isPositive ? AppColors.success : AppColors.error,
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  if (subtitle != null)
                    Expanded(
                      child: Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textMuted,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryTab(Map<String, dynamic> data) {
    final totalAnimals = data['total_animals'] ?? data['animales_activos'] ?? 142;
    final totalLots = data['total_lots'] ?? data['lotes_activos'] ?? 6;
    final totalPotreros = data['total_potreros'] ?? data['potreros'] ?? 8;
    final totalGalpones = data['total_galpones'] ?? data['galpones'] ?? 3;
    final mortalityRate = data['mortality_rate'] ?? '1.2%';
    final occupancy = data['occupancy_rate'] ?? '78.5%';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Métricas Generales de la Finca',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Total Animales',
                value: '$totalAnimals',
                icon: Icons.pets,
                color: AppColors.primary,
                trend: '+4.5%',
                subtitle: 'vs mes anterior',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Ocupación',
                value: '$occupancy',
                icon: Icons.pie_chart,
                color: AppColors.accent,
                subtitle: 'Capacidad total',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Lotes Activos',
                value: '$totalLots',
                icon: Icons.grid_view,
                color: Colors.blue,
                subtitle: 'Producción activa',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Tasa Mortalidad',
                value: '$mortalityRate',
                icon: Icons.health_and_safety,
                color: AppColors.success,
                trend: '-0.3%',
                subtitle: 'Bajo control',
                isPositive: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Potreros',
                value: '$totalPotreros',
                icon: Icons.grass,
                color: Colors.teal,
                subtitle: 'En rotación',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Galpones',
                value: '$totalGalpones',
                icon: Icons.home_work,
                color: Colors.amber.shade800,
                subtitle: 'En servicio',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildOperationsTab(Map<String, dynamic> data) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Eficiencia Operativa',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Ganancia Diaria de Peso (GDP)',
          value: '${data['gdp_promedio'] ?? '750'} g/día',
          icon: Icons.scale,
          color: AppColors.primary,
          trend: '+8.2%',
          subtitle: 'Objetivo: 700 g/día',
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Conversión Alimenticia',
          value: '${data['conversion_alimenticia'] ?? '1.65'} : 1',
          icon: Icons.restaurant,
          color: Colors.orange,
          trend: '-0.05',
          subtitle: 'Excelente eficiencia',
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Capacidad de Pastoreo en Uso',
          value: '${data['pastura_uso'] ?? '82'}%',
          icon: Icons.eco,
          color: Colors.green,
          subtitle: 'Presión de pastoreo equilibrada',
        ),
      ],
    );
  }

  Widget _buildFinancialTab(Map<String, dynamic> data) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Desempeño Financiero y Costos',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Costo por Kilo Ganado',
          value: '\$${data['costo_kg'] ?? '1.45'} USD',
          icon: Icons.monetization_on,
          color: AppColors.primary,
          trend: '-3.1%',
          subtitle: 'Optimización de insumos',
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Gasto en Alimentación',
          value: '\$${data['gasto_alimento'] ?? '3,420'} USD',
          icon: Icons.shopping_basket,
          color: Colors.purple,
          subtitle: 'Últimos 30 días',
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Gasto Sanitario / Medicamentos',
          value: '\$${data['gasto_sanidad'] ?? '580'} USD',
          icon: Icons.medical_services,
          color: Colors.teal,
          subtitle: 'Vacunas y desparasitación',
        ),
      ],
    );
  }

  Widget _buildStaffTab(Map<String, dynamic> data) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Rendimiento del Personal y Tareas',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Trabajadores Activos',
          value: '${data['trabajadores_activos'] ?? '8'}',
          icon: Icons.badge,
          color: Colors.indigo,
          subtitle: 'En jornada actual',
        ),
        const SizedBox(height: 12),
        _buildKpiCard(
          title: 'Tareas Completadas Hoy',
          value: '${data['tareas_completadas'] ?? '14'} / 16',
          icon: Icons.check_circle,
          color: AppColors.success,
          trend: '87.5%',
          subtitle: 'Cumplimiento del cronograma',
        ),
      ],
    );
  }
}
