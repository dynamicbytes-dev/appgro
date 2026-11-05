class HistoryLogModel {
  final int id;
  final int? farmId;
  final int? userId;
  final String? userName;
  final String module;
  final String action; // 'CREAR', 'ACTUALIZAR', 'ELIMINAR'
  final String description;
  final String? createdAt;

  HistoryLogModel({
    required this.id,
    this.farmId,
    this.userId,
    this.userName,
    required this.module,
    required this.action,
    required this.description,
    this.createdAt,
  });

  factory HistoryLogModel.fromJson(Map<String, dynamic> json) {
    return HistoryLogModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] != null ? int.tryParse(json['farm_id'].toString()) : null,
      userId: json['user_id'] != null ? int.tryParse(json['user_id'].toString()) : null,
      userName: json['user'] != null && json['user'] is Map<String, dynamic>
          ? json['user']['name']
          : json['user_name'],
      module: json['module'] ?? 'General',
      action: json['action'] ?? 'OPERACIÓN',
      description: json['description'] ?? '',
      createdAt: json['created_at'],
    );
  }
}

