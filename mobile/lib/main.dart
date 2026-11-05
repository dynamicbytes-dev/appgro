import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'providers/activity_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/barn_provider.dart';
import 'providers/farm_provider.dart';
import 'providers/inventory_provider.dart';
import 'providers/lot_provider.dart';
import 'providers/potrero_provider.dart';
import 'providers/root_provider.dart';
import 'routing/app_router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AppGroMobileApp());
}

class AppGroMobileApp extends StatelessWidget {
  const AppGroMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider(),
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
      ],
      child: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          final router = AppRouter.createRouter(authProvider);
          return MaterialApp.router(
            title: 'AppGro Móvil',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            routerConfig: router,
          );
        },
      ),
    );
  }
}
