
import '../models/task.dart';
import 'api_client.dart';

class TaskService {
  final ApiClient _apiClient;

  TaskService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  // Lấy danh sách công việc
  Future<List<Task>> getTasks({
    String? status,
    String? priority,
  }) async {
    // Tạo tham số lọc
    final queryParameters = <String, String>{};

    if (status != null && status.isNotEmpty) {
      queryParameters['status'] = status;
    }

    if (priority != null && priority.isNotEmpty) {
      queryParameters['priority'] = priority;
    }

    // Tạo đường dẫn API
    String endpoint = '/tasks';

    if (queryParameters.isNotEmpty) {
      endpoint += '?${Uri(queryParameters: queryParameters).query}';
    }

    // Gửi GET Request đến Backend
    final response = await _apiClient.get(endpoint);

    // Lấy danh sách công việc từ JSON
    final rawTasks = response['tasks'];

    if (rawTasks is! List) {
      throw Exception('Dữ liệu danh sách công việc không hợp lệ');
    }

    // Chuyển JSON thành danh sách Task
    return rawTasks.map((item) {
      if (item is! Map) {
        throw Exception('Dữ liệu công việc không hợp lệ');
      }

      return Task.fromJson(
        Map<String, dynamic>.from(item),
      );
    }).toList();
  }

  // Lấy chi tiết một công việc theo ID
  Future<Task> getTaskById(String id) async {
    if (id.trim().isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    // Gửi GET Request đến Backend
    final response = await _apiClient.get('/tasks/$id');

    // Lấy dữ liệu công việc
    final rawTask = response['task'];

    if (rawTask is! Map) {
      throw Exception('Dữ liệu chi tiết công việc không hợp lệ');
    }

    // Chuyển JSON thành đối tượng Task
    return Task.fromJson(
      Map<String, dynamic>.from(rawTask),
    );
  }
}
