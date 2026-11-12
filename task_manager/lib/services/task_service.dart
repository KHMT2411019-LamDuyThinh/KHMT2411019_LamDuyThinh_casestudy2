
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

  // Chuyển JSON thành Map
  Map<String, dynamic> _parseMap(
      dynamic rawData,
      String errorMessage,
      ) {
    if (rawData is! Map) {
      throw Exception(errorMessage);
    }

    return Map<String, dynamic>.from(rawData);
  }

  // Chuyển danh sách JSON thành danh sách Map
  List<Map<String, dynamic>> _parseMapList(
      dynamic rawData,
      String errorMessage,
      ) {
    if (rawData is! List) {
      throw Exception(errorMessage);
    }

    return rawData.map((item) {
      if (item is! Map) {
        throw Exception(errorMessage);
      }

      return Map<String, dynamic>.from(item);
    }).toList();
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


  // Lấy chi tiết công việc kèm vai trò truy cập
  Future<Task> getTaskById(String id) async {
    if (id.trim().isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    final response = await _apiClient.get(
      '/tasks/${id.trim()}',
    );

    final rawTask = _parseMap(
      response['task'],
      'Dữ liệu công việc không hợp lệ',
    );

    // Gắn vai trò truy cập do Backend trả về
    rawTask['accessRole'] = response['accessRole'];

    return _parseTask(rawTask);
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

    final rawTask = _parseMap(
      response['task'],
      'Dữ liệu công việc sau khi cập nhật không hợp lệ',
    );

    rawTask['accessRole'] = response['accessRole'];

    return _parseTask(rawTask);
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

    final rawTask = _parseMap(
      response['task'],
      'Dữ liệu công việc sau khi cập nhật trạng thái không hợp lệ',
    );

    rawTask['accessRole'] = response['accessRole'];

    return _parseTask(rawTask);
  }
  // ==========================================
  // NHÓM C: PHÂN CÔNG VÀ CHIA SẺ CÔNG VIỆC
  // ==========================================

  // Tìm kiếm thành viên theo tên hoặc email
  Future<List<Map<String, dynamic>>> searchMembers(
      String search,
      ) async {
    final keyword = search.trim();

    if (keyword.length < 2) {
      throw Exception('Từ khóa tìm kiếm phải có ít nhất 2 ký tự');
    }

    final query = Uri(
      queryParameters: {'search': keyword},
    ).query;

    final response = await _apiClient.get(
      '/tasks/members?$query',
    );

    return _parseMapList(
      response['members'],
      'Dữ liệu thành viên không hợp lệ',
    );
  }

  // Phân công thành viên cho công việc
  Future<Task> assignTask({
    required String taskId,
    required List<String> assigneeIds,
    String? primaryAssigneeId,
  }) async {
    final id = taskId.trim();

    if (id.isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    final response = await _apiClient.put(
      '/tasks/$id/assignees',
      {
        'assigneeIds': assigneeIds,
        'primaryAssigneeId': primaryAssigneeId,
      },
    );

    return _parseTask(response['task']);
  }

  // Chia sẻ công việc với thành viên
  // role: viewer hoặc editor
  Future<Map<String, dynamic>> shareTask({
    required String taskId,
    required String userId,
    required String role,
  }) async {
    final id = taskId.trim();
    final memberId = userId.trim();

    if (id.isEmpty || memberId.isEmpty) {
      throw Exception('Task ID và User ID không được để trống');
    }

    if (!['viewer', 'editor'].contains(role)) {
      throw Exception('Quyền chia sẻ không hợp lệ');
    }


    final response = await _apiClient.post(
      '/tasks/$id/shares',
      {
        'userId': memberId,
        'role': role,
      },
      requireAuth: true,
    );

    return _parseMap(
      response['share'],
      'Dữ liệu chia sẻ không hợp lệ',
    );
  }

  // Lấy danh sách người được chia sẻ công việc
  Future<List<Map<String, dynamic>>> getTaskShares(
      String taskId,
      ) async {
    final id = taskId.trim();

    if (id.isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    final response = await _apiClient.get(
      '/tasks/$id/shares',
    );

    return _parseMapList(
      response['shares'],
      'Danh sách chia sẻ không hợp lệ',
    );
  }

  // Thay đổi quyền chia sẻ Viewer / Editor
  Future<Map<String, dynamic>> updateTaskShareRole({
    required String taskId,
    required String userId,
    required String role,
  }) async {
    final id = taskId.trim();
    final memberId = userId.trim();

    if (id.isEmpty || memberId.isEmpty) {
      throw Exception('Task ID và User ID không được để trống');
    }

    if (!['viewer', 'editor'].contains(role)) {
      throw Exception('Quyền chia sẻ không hợp lệ');
    }

    final response = await _apiClient.patch(
      '/tasks/$id/shares/$memberId',
      {
        'role': role,
      },
    );

    return _parseMap(
      response['share'],
      'Dữ liệu chia sẻ không hợp lệ',
    );
  }

  // Thu hồi quyền chia sẻ công việc
  Future<void> removeTaskShare({
    required String taskId,
    required String userId,
  }) async {
    final id = taskId.trim();
    final memberId = userId.trim();

    if (id.isEmpty || memberId.isEmpty) {
      throw Exception('Task ID và User ID không được để trống');
    }

    await _apiClient.delete(
      '/tasks/$id/shares/$memberId',
    );
  }

  // Lấy thông tin công việc kèm vai trò truy cập
  Future<Map<String, dynamic>> getTaskDetailWithAccess(
      String id,
      ) async {
    final taskId = id.trim();

    if (taskId.isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    final task = await getTaskById(taskId);

    return {
      'task': task,
      'accessRole': task.accessRole,
    };
  }
}
