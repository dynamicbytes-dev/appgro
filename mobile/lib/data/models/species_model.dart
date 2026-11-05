class SpeciesModel {
  final int id;
  final String name;
  final String? category;
  final String? purpose;
  final bool isActive;

  SpeciesModel({
    required this.id,
    required this.name,
    this.category,
    this.purpose,
    required this.isActive,
  });

  factory SpeciesModel.fromJson(Map<String, dynamic> json) {
    return SpeciesModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? '',
      category: json['category'],
      purpose: json['purpose'],
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'purpose': purpose,
      'is_active': isActive,
    };
  }
}

