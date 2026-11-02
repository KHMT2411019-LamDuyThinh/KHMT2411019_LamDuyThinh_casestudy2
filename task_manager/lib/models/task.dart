
import 'user.dart';

class Task {
  final String id;
  final String title;
  final String description;
  final User? createdBy;
  final List<User> assignees;
  final User? primaryAssignee;
  final DateTime? startDate;
  final DateTime? dueDate;
  final String priority;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Task({
    required this.id,
    required this.title,
    this.description = '',
    this.createdBy,
    this.assignees = const [],
    this.primaryAssignee,
    this.startDate,
    this.dueDate,
    this.priority = 'medium',
    this.status = 'todo',
    this.createdAt,
    this.updatedAt,
  });

  // Chuyển dữ liệu người dùng từ JSON
  // Backend có thể trả về ObjectId hoặc object đã populate
  static User? _parseUser(dynamic value) {
    if (value == null) return null;

    if (value is Map) {
      return User.fromJson(
        Map<String, dynamic>.from(value),
      );
    }

    if (value is String) {
      return User(
        id: value,
        fullName: '',
        email: '',
      );
    }

    return null;
  }

  // Chuyển dữ liệu JSON thành đối tượng Task
  factory Task.fromJson(Map<String, dynamic> json) {
    final rawAssignees = json['assigneeIds'];

    final assignees = rawAssignees is List
        ? rawAssignees
        .map((item) => _parseUser(item))
        .whereType<User>()
        .toList()
        : <User>[];

    return Task(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      createdBy: _parseUser(json['createdBy']),
      assignees: assignees,
      primaryAssignee: _parseUser(json['primaryAssigneeId']),
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'].toString())
          : null,
      dueDate: json['dueDate'] != null
          ? DateTime.tryParse(json['dueDate'].toString())
          : null,
      priority: json['priority'] ?? 'medium',
      status: json['status'] ?? 'todo',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  // Chuyển đối tượng Task thành JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'createdBy': createdBy?.id,
      'assigneeIds': assignees.map((user) => user.id).toList(),
      'primaryAssigneeId': primaryAssignee?.id,
      'startDate': startDate?.toIso8601String(),
      'dueDate': dueDate?.toIso8601String(),
      'priority': priority,
      'status': status,
    };
  }
}
