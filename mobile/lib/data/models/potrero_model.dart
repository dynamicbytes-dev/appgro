class PotreroModel {
  final int id;
  final int farmId;
  final String name;
  final String? code;
  final String? sector;
  final double superficieHa;
  final int maxCapacity;
  final String operationalStatus; // 'disponible', 'descanso', 'mantenimiento', 'ocupado'
  final String? tipoPastura;
  final String? notes;
  final bool isActive;

  PotreroModel({
    required this.id,
    required this.farmId,
    required this.name,
    this.code,
    this.sector,
    required this.superficieHa,
    required this.maxCapacity,
    required this.operationalStatus,
    this.tipoPastura,
    this.notes,
    required this.isActive,
  });

  factory PotreroModel.fromJson(Map<String, dynamic> json) {
    return PotreroModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      name: json['name'] ?? '',
      code: json['code'],
      sector: json['sector'],
      superficieHa: json['superficie_ha'] != null
          ? double.tryParse(json['superficie_ha'].toString()) ?? 0.0
          : 0.0,
      maxCapacity: json['max_capacity'] != null
          ? int.tryParse(json['max_capacity'].toString()) ?? 0
          : 0,
      operationalStatus: json['operational_status'] ?? 'disponible',
      tipoPastura: json['tipo_pastura'],
      notes: json['notes'],
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'name': name,
      'code': code,
      'sector': sector,
      'superficie_ha': superficieHa,
      'max_capacity': maxCapacity,
      'operational_status': operationalStatus,
      'tipo_pastura': tipoPastura,
      'notes': notes,
      'is_active': isActive,
    };
  }
}

