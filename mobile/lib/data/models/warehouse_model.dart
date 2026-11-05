class WarehouseModel {
  final int id;
  final int farmId;
  final String name;
  final String? code;
  final String? location;
  final String? description;
  final bool isActive;

  WarehouseModel({
    required this.id,
    required this.farmId,
    required this.name,
    this.code,
    this.location,
    this.description,
    required this.isActive,
  });

  factory WarehouseModel.fromJson(Map<String, dynamic> json) {
    return WarehouseModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      name: json['name'] ?? '',
      code: json['code'],
      location: json['location'],
      description: json['description'],
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'name': name,
      'code': code,
      'location': location,
      'description': description,
      'is_active': isActive,
    };
  }
}

