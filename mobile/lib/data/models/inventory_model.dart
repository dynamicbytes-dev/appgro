class InventoryItemModel {
  final int id;
  final int farmId;
  final String name;
  final String? code;
  final String category; // 'alimento', 'medicamento', 'fertilizante', 'herramienta', 'otro'
  final String unit; // 'kg', 'litro', 'unidad', 'bulto'
  final double currentStock;
  final double minStock;
  final double? unitPrice;

  InventoryItemModel({
    required this.id,
    required this.farmId,
    required this.name,
    this.code,
    required this.category,
    required this.unit,
    required this.currentStock,
    required this.minStock,
    this.unitPrice,
  });

  bool get isLowStock => currentStock <= minStock;

  factory InventoryItemModel.fromJson(Map<String, dynamic> json) {
    return InventoryItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      name: json['name'] ?? '',
      code: json['code'],
      category: json['category'] ?? 'otro',
      unit: json['unit'] ?? 'unidad',
      currentStock: json['current_stock'] != null
          ? double.tryParse(json['current_stock'].toString()) ?? 0.0
          : 0.0,
      minStock: json['min_stock'] != null
          ? double.tryParse(json['min_stock'].toString()) ?? 0.0
          : 0.0,
      unitPrice: json['unit_price'] != null
          ? double.tryParse(json['unit_price'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'name': name,
      'code': code,
      'category': category,
      'unit': unit,
      'current_stock': currentStock,
      'min_stock': minStock,
      'unit_price': unitPrice,
    };
  }
}

