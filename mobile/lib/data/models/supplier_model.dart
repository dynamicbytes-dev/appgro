class SupplierModel {
  final int id;
  final int farmId;
  final String name;
  final String? contactName;
  final String? phone;
  final String? email;
  final String? address;
  final String? taxId;
  final bool isActive;

  SupplierModel({
    required this.id,
    required this.farmId,
    required this.name,
    this.contactName,
    this.phone,
    this.email,
    this.address,
    this.taxId,
    required this.isActive,
  });

  factory SupplierModel.fromJson(Map<String, dynamic> json) {
    return SupplierModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      name: json['name'] ?? '',
      contactName: json['contact_name'],
      phone: json['phone'],
      email: json['email'],
      address: json['address'],
      taxId: json['tax_id'] ?? json['identification'],
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'name': name,
      'contact_name': contactName,
      'phone': phone,
      'email': email,
      'address': address,
      'tax_id': taxId,
      'is_active': isActive,
    };
  }
}

