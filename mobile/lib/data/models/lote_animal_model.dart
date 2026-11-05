class LoteAnimalModel {
  final int id;
  final int lotId;
  final String? code;
  final String? name;
  final String? color;
  final double? weight;
  final String? birthDate;
  final String? reproductiveStatus; // 'activo', 'gestacion', 'lactancia', 'destetado', 'vendido', 'muerto'
  final bool isActive;

  LoteAnimalModel({
    required this.id,
    required this.lotId,
    this.code,
    this.name,
    this.color,
    this.weight,
    this.birthDate,
    this.reproductiveStatus,
    required this.isActive,
  });

  factory LoteAnimalModel.fromJson(Map<String, dynamic> json) {
    return LoteAnimalModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      lotId: json['lot_id'] is int ? json['lot_id'] : int.tryParse(json['lot_id'].toString()) ?? 0,
      code: json['code'] ?? json['identifier'],
      name: json['name'],
      color: json['color'],
      weight: json['weight'] != null ? double.tryParse(json['weight'].toString()) : null,
      birthDate: json['birth_date'],
      reproductiveStatus: json['reproductive_status'] ?? json['status'] ?? 'activo',
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'lot_id': lotId,
      'code': code,
      'name': name,
      'color': color,
      'weight': weight,
      'birth_date': birthDate,
      'reproductive_status': reproductiveStatus,
      'is_active': isActive,
    };
  }
}

