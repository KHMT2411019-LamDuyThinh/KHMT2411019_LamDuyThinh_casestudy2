
import '../models/task.dart';
import 'api_client.dart';

class TaskService {
  final ApiClient _apiClient;

  TaskService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  // Chuyển JSON thành đối tượng Task
  Task _parseTask(dynamic rawTask) {
    if (rawTask is! Map) {
      throw Exception('Dữ liệu công việc không hợp lệ');
    }

    return Task.fromJson(
      Map<String, dynamic>.from(rawTask),
    );
  }

  // Lấy danh sách công việc
  // Hỗ trợ tìm kiếm, lọc và sắp xếp
  Future<List<Task>> getTasks({
    String? status,
    String? priority,
    String? search,
    String? sortBy,
    String? sortOrder,
  }) async {
    final queryParameters = <String, String>{};

    if (status != null && status.isNotEmpty) {
      queryParameters['status'] = status;
    }

    if (priority != null && priority.isNotEmpty) {
      queryParameters['priority'] = priority;
    }

    if (search != null && search.trim().isNotEmpty) {
      queryParameters['search'] = search.trim();
    }

    if (sortBy != null && sortBy.isNotEmpty) {
      queryParameters['sortBy'] = sortBy;
    }

    if (sortOrder != null && sortOrder.isNotEmpty) {
      queryParameters['sortOrder'] = sortOrder;
    }

    String endpoint = '/tasks';

    if (queryParameters.isNotEmpty) {
      endpoint += '?${Uri(queryParameters: queryParameters).query}';
    }

    final response = await _apiClient.get(endpoint);

    final rawTasks = response['tasks'];

    if (rawTasks is! List) {
      throw Exception('Dữ liệu danh sách công việc không hợp lệ');
    }

    return rawTasks.map((item) => _parseTask(item)).toList();
  }

  // Lấy chi tiết một công việc
  Future<Task> getTaskById(String id) async {
    if (id.trim().isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    final response = await _apiClient.get(
      '/tasks/${id.trim()}',
    );

    return _parseTask(response['task']);
  }

  // Tạo công việc mới
  Future<Task> createTask({
    required String title,
    String description = '',
    DateTime? startDate,
    DateTime? dueDate,
    String priority = 'medium',
  }) async {
    final response = await _apiClient.post(
      '/tasks',
      {
        'title': title.trim(),
        'description': description.trim(),
        'startDate': startDate?.toIso8601String(),
        'dueDate': dueDate?.toIso8601String(),
        'priority': priority,
      },
      requireAuth: true,
    );

    return _parseTask(response['task']);
  }

  // Chỉnh sửa công việc
  Future<Task> updateTask({
    required String id,
    required String title,
    String description = '',
    DateTime? startDate,
    DateTime? dueDate,
    String priority = 'medium',
  }) async {
    if (id.trim().isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    final response = await _apiClient.put(
      '/tasks/${id.trim()}',
      {
        'title': title.trim(),
        'description': description.trim(),
        'startDate': startDate?.toIso8601String(),
        'dueDate': dueDate?.toIso8601String(),
        'priority': priority,
      },
    );

    return _parseTask(response['task']);
  }

  // Xóa công việc
  Future<void> deleteTask(String id) async {
    if (id.trim().isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    await _apiClient.delete(
      '/tasks/${id.trim()}',
    );
  }

  // Cập nhật trạng thái công việc
  Future<Task> updateTaskStatus({
    required String id,
    required String status,
  }) async {
    if (id.trim().isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    const allowedStatus = [
      'todo',
      'in_progress',
      'completed',
    ];

    if (!allowedStatus.contains(status)) {
      throw Exception('Trạng thái công việc không hợp lệ');
    }

    final response = await _apiClient.patch(
      '/tasks/${id.trim()}/status',
      {
        'status': status,
      },
    );

    return _parseTask(response['task']);
  }
}
