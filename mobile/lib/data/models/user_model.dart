import 'farm_model.dart';

class UserModel {
  final int id;
  final String name;
  final String? lastname;
  final String email;
  final String? phone;
  final String role; // 'root', 'admin', 'encargado'
  final int? farmId;
  final FarmModel? farm;
  final bool isActive;

  UserModel({
    required this.id,
    required this.name,
    this.lastname,
    required this.email,
    this.phone,
    required this.role,
    this.farmId,
    this.farm,
    required this.isActive,
  });

  String get fullName => lastname != null && lastname!.isNotEmpty
      ? '$name $lastname'
      : name;

  bool get isRoot => role.toLowerCase() == 'root';
  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isEncargado => role.toLowerCase() == 'encargado';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? '',
      lastname: json['lastname'],
      email: json['email'] ?? '',
      phone: json['phone'],
      role: (json['role'] ?? 'encargado').toString().toLowerCase(),
      farmId: json['farm_id'] != null ? int.tryParse(json['farm_id'].toString()) : null,
      farm: json['farm'] != null && json['farm'] is Map<String, dynamic>
          ? FarmModel.fromJson(json['farm'])
          : null,
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'lastname': lastname,
      'email': email,
      'phone': phone,
      'role': role,
      'farm_id': farmId,
      'farm': farm?.toJson(),
      'is_active': isActive,
    };
  }
}

