import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/constants/api_endpoints.dart';
import 'core/theme/app_theme.dart';
import 'providers/activity_provider.dart';
import 'providers/analytics_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/barn_provider.dart';
import 'providers/farm_provider.dart';
import 'providers/history_provider.dart';
import 'providers/inventory_provider.dart';
import 'providers/lot_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/potrero_provider.dart';
import 'providers/root_provider.dart';
import 'providers/species_provider.dart';
import 'routing/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiEndpoints.init();
  runApp(const ZootikaApp());
}

class ZootikaApp extends StatefulWidget {
  const ZootikaApp({super.key});

  @override
  State<ZootikaApp> createState() => _ZootikaAppState();
}

class _ZootikaAppState extends State<ZootikaApp> {
  late final AuthProvider _authProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider();
    _router = AppRouter.createRouter(_authProvider);
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(
          value: _authProvider,
        ),
        ChangeNotifierProvider<RootProvider>(
          create: (_) => RootProvider(),
        ),
        ChangeNotifierProvider<FarmProvider>(
          create: (_) => FarmProvider(),
        ),
        ChangeNotifierProvider<ActivityProvider>(
          create: (_) => ActivityProvider(),
        ),
        ChangeNotifierProvider<PotreroProvider>(
          create: (_) => PotreroProvider(),
        ),
        ChangeNotifierProvider<LotProvider>(
          create: (_) => LotProvider(),
        ),
        ChangeNotifierProvider<BarnProvider>(
          create: (_) => BarnProvider(),
        ),
        ChangeNotifierProvider<InventoryProvider>(
          create: (_) => InventoryProvider(),
        ),
        ChangeNotifierProvider<SpeciesProvider>(
          create: (_) => SpeciesProvider(),
        ),
        ChangeNotifierProvider<AnalyticsProvider>(
          create: (_) => AnalyticsProvider(),
        ),
        ChangeNotifierProvider<HistoryProvider>(
          create: (_) => HistoryProvider(),
        ),
        ChangeNotifierProvider<NotificationProvider>(
          create: (_) => NotificationProvider(),
        ),
      ],
      child: MaterialApp.router(
        title: 'Zootika',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        routerConfig: _router,
      ),
    );
  }
}
