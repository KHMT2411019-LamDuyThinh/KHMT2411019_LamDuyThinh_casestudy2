class ActivityUser {
  final String id;
  final String fullName;
  final String email;
  final String avatarUrl;

  const ActivityUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.avatarUrl,
  });

  factory ActivityUser.fromJson(dynamic value) {
    if (value is Map) {
      final json = Map<String, dynamic>.from(value);

      return ActivityUser(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        fullName: (json['fullName'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        avatarUrl: (json['avatarUrl'] ?? '').toString(),
      );
    }

    return ActivityUser(
      id: value?.toString() ?? '',
      fullName: '',
      email: '',
      avatarUrl: '',
    );
  }
}

class TaskActivity {
  final String id;
  final String taskId;
  final String taskTitle;
  final ActivityUser user;
  final String action;
  final Map<String, dynamic> details;
  final DateTime? createdAt;

  const TaskActivity({
    required this.id,
    required this.taskId,
    required this.taskTitle,
    required this.user,
    required this.action,
    required this.details,
    this.createdAt,
  });

  factory TaskActivity.fromJson(Map<String, dynamic> json) {
    final rawDetails = json['details'];

    return TaskActivity(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      taskId: (json['taskId'] ?? '').toString(),
      taskTitle: (json['taskTitle'] ?? '').toString(),
      user: ActivityUser.fromJson(json['userId']),
      action: (json['action'] ?? '').toString(),
      details: rawDetails is Map ? Map<String, dynamic>.from(rawDetails) : {},
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
    );
  }
}

class TaskActivityPage {
  final String taskId;
  final String taskTitle;
  final List<TaskActivity> activities;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const TaskActivityPage({
    required this.taskId,
    required this.taskTitle,
    required this.activities,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory TaskActivityPage.fromJson(Map<String, dynamic> json) {
    final rawActivities = json['activities'];
    final rawPagination = json['pagination'];

    final activities = rawActivities is List
        ? rawActivities
              .whereType<Map>()
              .map(
                (item) =>
                    TaskActivity.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList()
        : <TaskActivity>[];

    final pagination = rawPagination is Map
        ? Map<String, dynamic>.from(rawPagination)
        : <String, dynamic>{};

    int readInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? 0;
    }

    return TaskActivityPage(
      taskId: (json['taskId'] ?? '').toString(),
      taskTitle: (json['taskTitle'] ?? '').toString(),
      activities: activities,
      page: readInt(pagination['page']),
      limit: readInt(pagination['limit']),
      total: readInt(pagination['total']),
      totalPages: readInt(pagination['totalPages']),
    );
  }
}
