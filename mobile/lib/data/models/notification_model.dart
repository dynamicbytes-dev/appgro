class NotificationModel {
  final int id;
  final String title;
  final String message;
  final bool isRead;
  final String? createdAt;

  NotificationModel({
    required this.id,
    required this.title,
    required this.message,
    required this.isRead,
    this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] ?? 'Notificación',
      message: json['message'] ?? '',
      isRead: json['is_read'] == true || json['is_read'] == 1 || json['read_at'] != null,
      createdAt: json['created_at'],
    );
  }
}

