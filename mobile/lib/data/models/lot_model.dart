class LotModel {
  final int id;
  final int farmId;
  final String code;
  final int? speciesId;
  final String? speciesName;
  final String? sector;
  final String? purpose;
  final int quantity;
  final double? initialWeight;
  final double? currentWeight;
  final String status; // 'activo', 'inactivo'
  final int? galponId;
  final int? potreroId;

  LotModel({
    required this.id,
    required this.farmId,
    required this.code,
    this.speciesId,
    this.speciesName,
    this.sector,
    this.purpose,
    required this.quantity,
    this.initialWeight,
    this.currentWeight,
    required this.status,
    this.galponId,
    this.potreroId,
  });

  bool get isActive => status == 'activo';

  factory LotModel.fromJson(Map<String, dynamic> json) {
    return LotModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      code: json['code'] ?? '',
      speciesId: json['species_id'] != null ? int.tryParse(json['species_id'].toString()) : null,
      speciesName: json['species'] != null && json['species'] is Map<String, dynamic>
          ? json['species']['name']
          : json['species_name'],
      sector: json['sector'],
      purpose: json['purpose'],
      quantity: json['quantity'] != null ? int.tryParse(json['quantity'].toString()) ?? 0 : 0,
      initialWeight: json['initial_weight'] != null
          ? double.tryParse(json['initial_weight'].toString())
          : null,
      currentWeight: json['current_weight'] != null
          ? double.tryParse(json['current_weight'].toString())
          : null,
      status: json['status'] ?? 'activo',
      galponId: json['galpon_id'] != null ? int.tryParse(json['galpon_id'].toString()) : null,
      potreroId: json['potrero_id'] != null ? int.tryParse(json['potrero_id'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'code': code,
      'species_id': speciesId,
      'sector': sector,
      'purpose': purpose,
      'quantity': quantity,
      'status': status,
      'galpon_id': galponId,
      'potrero_id': potreroId,
    };
  }
}

