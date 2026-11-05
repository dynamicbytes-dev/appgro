class GalponModel {
  final int id;
  final int farmId;
  final String name;
  final String? category;
  final String? sector;
  final String? purpose;
  final int maxCapacity;
  final bool isActive;

  GalponModel({
    required this.id,
    required this.farmId,
    required this.name,
    this.category,
    this.sector,
    this.purpose,
    required this.maxCapacity,
    required this.isActive,
  });

  factory GalponModel.fromJson(Map<String, dynamic> json) {
    return GalponModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      name: json['name'] ?? '',
      category: json['category'],
      sector: json['sector'],
      purpose: json['purpose'],
      maxCapacity: json['max_capacity'] != null
          ? int.tryParse(json['max_capacity'].toString()) ?? 0
          : 0,
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'name': name,
      'category': category,
      'sector': sector,
      'purpose': purpose,
      'max_capacity': maxCapacity,
      'is_active': isActive,
    };
  }
}

