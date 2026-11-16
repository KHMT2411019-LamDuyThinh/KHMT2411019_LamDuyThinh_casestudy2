import 'task.dart';

int _readInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

Map<String, dynamic> _readMap(dynamic value) {
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return {};
}

List<Task> _readTasks(dynamic value) {
  if (value is! List) return [];

  return value
      .whereType<Map>()
      .map((item) => Task.fromJson(Map<String, dynamic>.from(item)))
      .toList();
}

class TaskStatusStatistics {
  final int totalTasks;
  final Map<String, int> statusCounts;

  const TaskStatusStatistics({
    required this.totalTasks,
    required this.statusCounts,
  });

  factory TaskStatusStatistics.fromJson(Map<String, dynamic> json) {
    final counts = _readMap(json['statusCounts']);

    return TaskStatusStatistics(
      totalTasks: _readInt(json['totalTasks']),
      statusCounts: {
        'todo': _readInt(counts['todo']),
        'in_progress': _readInt(counts['in_progress']),
        'completed': _readInt(counts['completed']),
      },
    );
  }
}

class TaskAssignmentStatistics {
  final int totalCreatedByMe;
  final int totalAssignedToMe;
  final int totalPrimaryResponsible;
  final int totalSharedWithMe;

  const TaskAssignmentStatistics({
    required this.totalCreatedByMe,
    required this.totalAssignedToMe,
    required this.totalPrimaryResponsible,
    required this.totalSharedWithMe,
  });

  factory TaskAssignmentStatistics.fromJson(Map<String, dynamic> json) {
    return TaskAssignmentStatistics(
      totalCreatedByMe: _readInt(json['totalCreatedByMe']),
      totalAssignedToMe: _readInt(json['totalAssignedToMe']),
      totalPrimaryResponsible: _readInt(json['totalPrimaryResponsible']),
      totalSharedWithMe: _readInt(json['totalSharedWithMe']),
    );
  }
}

class TaskDeadlineStatistics {
  final int days;
  final int overdueCount;
  final int upcomingCount;
  final List<Task> overdueTasks;
  final List<Task> upcomingTasks;

  const TaskDeadlineStatistics({
    required this.days,
    required this.overdueCount,
    required this.upcomingCount,
    required this.overdueTasks,
    required this.upcomingTasks,
  });

  factory TaskDeadlineStatistics.fromJson(Map<String, dynamic> json) {
    return TaskDeadlineStatistics(
      days: _readInt(json['days']),
      overdueCount: _readInt(json['overdueCount']),
      upcomingCount: _readInt(json['upcomingCount']),
      overdueTasks: _readTasks(json['overdueTasks']),
      upcomingTasks: _readTasks(json['upcomingTasks']),
    );
  }
}
