import '../models/task_statistics.dart';
import 'api_client.dart';

class StatisticsService {
  final ApiClient _apiClient;

  StatisticsService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  Map<String, dynamic> _getData(Map<String, dynamic> response) {
    final data = response['data'];

    if (data is! Map) {
      throw Exception('Dữ liệu thống kê không hợp lệ');
    }

    return Map<String, dynamic>.from(data);
  }

  Future<TaskStatusStatistics> getTaskStatistics() async {
    final response = await _apiClient.get('/statistics/tasks');

    return TaskStatusStatistics.fromJson(_getData(response));
  }

  Future<TaskAssignmentStatistics> getAssignmentStatistics() async {
    final response = await _apiClient.get('/statistics/assignments');

    return TaskAssignmentStatistics.fromJson(_getData(response));
  }

  Future<TaskDeadlineStatistics> getDeadlineStatistics({int days = 7}) async {
    if (days < 1 || days > 30) {
      throw Exception('Số ngày phải nằm trong khoảng 1 đến 30');
    }

    final response = await _apiClient.get('/statistics/deadlines?days=$days');

    return TaskDeadlineStatistics.fromJson(_getData(response));
  }
}
