class FarmModel {
  final int id;
  final String code;
  final String name;
  final String? sector;
  final String? location;
  final bool isActive;

  FarmModel({
    required this.id,
    required this.code,
    required this.name,
    this.sector,
    this.location,
    required this.isActive,
  });

  factory FarmModel.fromJson(Map<String, dynamic> json) {
    return FarmModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      sector: json['sector'],
      location: json['location'],
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'name': name,
      'sector': sector,
      'location': location,
      'is_active': isActive,
    };
  }
}

