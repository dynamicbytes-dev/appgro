import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/widgets/custom_button.dart';
import 'package:mobile/ui/widgets/status_badge.dart';
import 'package:mobile/ui/widgets/stat_card.dart';

void main() {
  group('UI Widgets Tests', () {
    testWidgets('CustomButton renders text and triggers callback', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomButton(
              text: 'Guardar Registro',
              onPressed: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Guardar Registro'), findsOneWidget);
      await tester.tap(find.byType(CustomButton));
      expect(tapped, true);
    });

    testWidgets('StatusBadge displays correct text and colors', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatusBadge.forStatus('terminada'),
          ),
        ),
      );

      expect(find.text('TERMINADA'), findsOneWidget);
    });

    testWidgets('StatCard displays value and title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: StatCard(
              title: 'Total Animales',
              value: '145',
              icon: Icons.pets,
            ),
          ),
        ),
      );

      expect(find.text('Total Animales'), findsOneWidget);
      expect(find.text('145'), findsOneWidget);
    });
  });
}
