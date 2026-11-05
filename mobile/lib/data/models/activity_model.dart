import 'user_model.dart';

class ActivityModel {
  final int id;
  final int farmId;
  final int createdBy;
  final int? assignedTo;
  final String title;
  final String? description;
  final String? dueDate;
  final String status; // 'pendiente', 'en_proceso', 'terminada'
  final String? completedAt;
  final String? createdAt;
  final UserModel? assignee;
  final UserModel? creator;

  ActivityModel({
    required this.id,
    required this.farmId,
    required this.createdBy,
    this.assignedTo,
    required this.title,
    this.description,
    this.dueDate,
    required this.status,
    this.completedAt,
    this.createdAt,
    this.assignee,
    this.creator,
  });

  bool get isPending => status == 'pendiente';
  bool get isInProgress => status == 'en_proceso';
  bool get isCompleted => status == 'terminada';

  String get statusLabel {
    switch (status) {
      case 'pendiente':
        return 'Pendiente';
      case 'en_proceso':
        return 'En proceso';
      case 'terminada':
        return 'Terminada';
      default:
        return status;
    }
  }

  factory ActivityModel.fromJson(Map<String, dynamic> json) {
    return ActivityModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      farmId: json['farm_id'] is int ? json['farm_id'] : int.tryParse(json['farm_id'].toString()) ?? 0,
      createdBy: json['created_by'] is int ? json['created_by'] : int.tryParse(json['created_by'].toString()) ?? 0,
      assignedTo: json['assigned_to'] != null ? int.tryParse(json['assigned_to'].toString()) : null,
      title: json['title'] ?? '',
      description: json['description'],
      dueDate: json['due_date'],
      status: json['status'] ?? 'pendiente',
      completedAt: json['completed_at'],
      createdAt: json['created_at'],
      assignee: json['assignee'] != null && json['assignee'] is Map<String, dynamic>
          ? UserModel.fromJson(json['assignee'])
          : null,
      creator: json['creator'] != null && json['creator'] is Map<String, dynamic>
          ? UserModel.fromJson(json['creator'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farm_id': farmId,
      'created_by': createdBy,
      'assigned_to': assignedTo,
      'title': title,
      'description': description,
      'due_date': dueDate,
      'status': status,
    };
  }
}

