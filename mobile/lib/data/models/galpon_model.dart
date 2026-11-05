class GalponModel {
  final int id;
  final int farmId;
  final int? speciesId;
  final String? speciesName;
  final String? speciesCategory;
  final String name;
  final String? category;
  final String? sector;
  final String? purpose;
  final int maxCapacity;
  final int occupiedCapacity;
  final int availableCapacity;
  final bool isActive;

  GalponModel({
    required this.id,
    required this.farmId,
    this.speciesId,
    this.speciesName,
    this.speciesCategory,
    required this.name,
    this.category,
    this.sector,
    this.purpose,
    required this.maxCapacity,
    this.occupiedCapacity = 0,
    this.availableCapacity = 0,
    required this.isActive,
  });

  factory GalponModel.fromJson(Map<String, dynamic> json) {
    String? sName;
    String? sCategory;
    if (json['species'] is Map<String, dynamic>) {
      sName = json['species']['name'];
      sCategory = json['species']['category'];
    }

    final cap = json['max_capacity'] != null
        ? int.tryParse(json['max_capacity'].toString()) ?? 0
        : 0;
    final occ = json['occupied_capacity'] != null
        ? int.tryParse(json['occupied_capacity'].toString()) ?? 0
        : 0;

    return GalponModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      speciesId: json['species_id'] != null
          ? int.tryParse(json['species_id'].toString())
          : null,
      speciesName: sName ?? json['species_name'],
      speciesCategory: sCategory,
      name: json['name'] ?? '',
      category: json['category'],
      sector: json['sector'] ?? sCategory,
      purpose: json['purpose'],
      maxCapacity: cap,
      occupiedCapacity: occ,
      availableCapacity: json['available_capacity'] != null
          ? int.tryParse(json['available_capacity'].toString()) ?? (cap - occ)
          : (cap - occ),
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'species_id': speciesId,
      'name': name,
      'category': category,
      'sector': sector,
      'purpose': purpose,
      'max_capacity': maxCapacity,
      'is_active': isActive,
    };
  }
}
