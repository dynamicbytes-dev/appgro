import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/activity_model.dart';
import 'package:mobile/data/models/galpon_model.dart';
import 'package:mobile/data/models/history_log_model.dart';
import 'package:mobile/data/models/inventory_model.dart';
import 'package:mobile/data/models/lot_model.dart';
import 'package:mobile/data/models/notification_model.dart';
import 'package:mobile/data/models/potrero_model.dart';
import 'package:mobile/data/models/species_model.dart';
import 'package:mobile/data/models/supplier_model.dart';
import 'package:mobile/data/models/user_model.dart';
import 'package:mobile/data/models/warehouse_model.dart';

void main() {
  group('Data Models Serialization & Logic Tests', () {
    test('UserModel parse and roles', () {
      final json = {
        'id': 1,
        'name': 'Rosangeles',
        'lastname': 'Rojas',
        'email': 'rosangeles@test.com',
        'role': 'root',
        'is_active': true,
      };

      final user = UserModel.fromJson(json);
      expect(user.fullName, 'Rosangeles Rojas');
      expect(user.isRoot, true);
      expect(user.isAdmin, false);
      expect(user.isEncargado, false);
      expect(user.isActive, true);
    });

    test('PotreroModel parse and attributes', () {
      final json = {
        'id': 10,
        'farm_id': 1,
        'name': 'Potrero San Juan',
        'code': 'POT-01',
        'superficie_ha': '12.50',
        'max_capacity': '40',
        'operational_status': 'disponible',
        'tipo_pastura': 'Brachiaria',
        'is_active': true,
      };

      final p = PotreroModel.fromJson(json);
      expect(p.name, 'Potrero San Juan');
      expect(p.superficieHa, 12.5);
      expect(p.maxCapacity, 40);
      expect(p.operationalStatus, 'disponible');
    });

    test('ActivityModel status checks', () {
      final json = {
        'id': 5,
        'farm_id': 1,
        'created_by': 2,
        'title': 'Aforo de biomasa',
        'status': 'en_proceso',
      };

      final act = ActivityModel.fromJson(json);
      expect(act.isInProgress, true);
      expect(act.isPending, false);
      expect(act.statusLabel, 'En proceso');
    });

    test('InventoryItemModel low stock detection', () {
      final item = InventoryItemModel(
        id: 1,
        farmId: 1,
        name: 'Concentrado Bovino',
        category: 'alimento',
        unit: 'kg',
        currentStock: 15.0,
        minStock: 20.0,
      );

      expect(item.isLowStock, true);
    });

    test('LotModel and GalponModel serialization', () {
      final lot = LotModel.fromJson({
        'id': 1,
        'farm_id': 1,
        'code': 'LOTE-A',
        'quantity': 25,
        'status': 'activo',
      });
      expect(lot.isActive, true);
      expect(lot.quantity, 25);

      final galpon = GalponModel.fromJson({
        'id': 3,
        'farm_id': 1,
        'name': 'Galpón Ponedoras',
        'max_capacity': 1200,
        'is_active': true,
      });
      expect(galpon.maxCapacity, 1200);
    });

    test('SpeciesModel serialization', () {
      final s = SpeciesModel.fromJson({
        'id': 4,
        'farm_id': 1,
        'name': 'Bovino Holstein',
        'category': 'bovinos',
        'purpose': 'Leche',
        'is_active': true,
      });
      expect(s.name, 'Bovino Holstein');
      expect(s.category, 'bovinos');
      expect(s.purpose, 'Leche');
      expect(s.isActive, true);
    });

    test('WarehouseModel and SupplierModel serialization', () {
      final w = WarehouseModel.fromJson({
        'id': 2,
        'name': 'Bodega Central',
        'code': 'BOD-01',
        'location': 'Sector Norte',
        'is_active': true,
      });
      expect(w.name, 'Bodega Central');
      expect(w.code, 'BOD-01');

      final sup = SupplierModel.fromJson({
        'id': 5,
        'name': 'AgroPecuaria Los Andes',
        'contact_name': 'Carlos Perez',
        'phone': '04141234567',
        'email': 'carlos@losandes.com',
      });
      expect(sup.name, 'AgroPecuaria Los Andes');
      expect(sup.phone, '04141234567');
    });

    test('HistoryLogModel and NotificationModel serialization', () {
      final log = HistoryLogModel.fromJson({
        'id': 12,
        'module': 'Lotes',
        'action': 'CREAR',
        'description': 'Lote creado con 30 animales',
        'user_name': 'Carlos Admin',
      });
      expect(log.module, 'Lotes');
      expect(log.action, 'CREAR');
      expect(log.userName, 'Carlos Admin');

      final notif = NotificationModel.fromJson({
        'id': 'notif-1',
        'title': 'Alerta de Stock',
        'message': 'Concentrado bajo en stock',
        'is_read': false,
      });
      expect(notif.title, 'Alerta de Stock');
      expect(notif.isRead, false);
    });
  });
}
