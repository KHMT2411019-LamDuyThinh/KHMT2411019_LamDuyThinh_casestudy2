import '../models/task_activity.dart';
import 'api_client.dart';

class TaskActivityService {
  final ApiClient _apiClient;

  TaskActivityService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  Future<TaskActivityPage> getTaskActivities({
    required String taskId,
    int page = 1,
    int limit = 20,
  }) async {
    final id = taskId.trim();

    if (id.isEmpty) {
      throw Exception('Task ID không được để trống');
    }

    if (page < 1 || limit < 1 || limit > 100) {
      throw Exception('Thông số phân trang không hợp lệ');
    }

    final response = await _apiClient.get(
      '/tasks/$id/activities?page=$page&limit=$limit',
    );

    final rawData = response['data'];

    if (rawData is! Map) {
      throw Exception('Dữ liệu lịch sử hoạt động không hợp lệ');
    }

    return TaskActivityPage.fromJson(Map<String, dynamic>.from(rawData));
  }
}
