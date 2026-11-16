
class AppNotification {
  final String id;
  final String? actorId;
  final String? actorName;
  final String? actorAvatarUrl;
  final String? taskId;
  final String? taskTitle;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? readAt;
  final DateTime? createdAt;

  const AppNotification({
    required this.id,
    this.actorId,
    this.actorName,
    this.actorAvatarUrl,
    this.taskId,
    this.taskTitle,
    required this.type,
    required this.title,
    required this.message,
    this.isRead = false,
    this.readAt,
    this.createdAt,
  });

  // Chuyển ID từ ObjectId hoặc object đã populate
  static String? _parseId(dynamic value) {
    if (value == null) return null;

    if (value is Map) {
      final id = value['_id'] ?? value['id'];
      return id?.toString();
    }

    return value.toString();
  }

  // Chuyển dữ liệu ngày tháng
  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;

    return DateTime.tryParse(value.toString());
  }

  // Chuyển JSON thành đối tượng AppNotification
  factory AppNotification.fromJson(
      Map<String, dynamic> json,
      ) {
    final actor = json['actorId'];
    final task = json['taskId'];

    return AppNotification(
      id: (json['_id'] ?? json['id'] ?? '').toString(),

      actorId: _parseId(actor),

      actorName: actor is Map
          ? actor['fullName']?.toString()
          : null,

      actorAvatarUrl: actor is Map
          ? actor['avatarUrl']?.toString()
          : null,

      taskId: _parseId(task),

      taskTitle: task is Map
          ? task['title']?.toString()
          : null,

      type: (json['type'] ?? '').toString(),

      title: (json['title'] ?? '').toString(),

      message: (json['message'] ?? '').toString(),

      isRead: json['isRead'] == true,

      readAt: _parseDate(json['readAt']),

      createdAt: _parseDate(json['createdAt']),
    );
  }
}

// Kết quả phân trang thông báo từ Backend
class NotificationPage {
  final List<AppNotification> notifications;
  final int total;
  final int unreadCount;
  final int page;
  final int limit;
  final int totalPages;

  const NotificationPage({
    required this.notifications,
    required this.total,
    required this.unreadCount,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory NotificationPage.fromJson(
      Map<String, dynamic> json,
      ) {
    final rawNotifications = json['notifications'];

    if (rawNotifications is! List) {
      throw Exception('Danh sách thông báo không hợp lệ');
    }

    return NotificationPage(
      notifications: rawNotifications.map((item) {
        if (item is! Map) {
          throw Exception('Dữ liệu thông báo không hợp lệ');
        }

        return AppNotification.fromJson(
          Map<String, dynamic>.from(item),
        );
      }).toList(),

      total: (json['total'] as num?)?.toInt() ?? 0,

      unreadCount:
      (json['unreadCount'] as num?)?.toInt() ?? 0,

      page: (json['page'] as num?)?.toInt() ?? 1,

      limit: (json['limit'] as num?)?.toInt() ?? 20,

      totalPages:
      (json['totalPages'] as num?)?.toInt() ?? 0,
    );
  }
}
