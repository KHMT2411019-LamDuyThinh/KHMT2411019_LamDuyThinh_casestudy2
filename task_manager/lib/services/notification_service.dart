
import '../models/notification.dart';
import 'api_client.dart';

class NotificationService {
  final ApiClient _apiClient;

  NotificationService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

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

  // Lấy danh sách thông báo có phân trang
  Future<NotificationPage> getNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    if (page < 1) {
      throw Exception('Số trang không hợp lệ');
    }

    if (limit < 1 || limit > 50) {
      throw Exception('Số lượng thông báo mỗi trang không hợp lệ');
    }

    final query = Uri(
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
      },
    ).query;

    final response = await _apiClient.get(
      '/notifications?$query',
    );

    final rawData = _parseMap(
      response['data'],
      'Dữ liệu thông báo không hợp lệ',
    );

    return NotificationPage.fromJson(rawData);
  }

  // Lấy số lượng thông báo chưa đọc
  Future<int> getUnreadCount() async {
    final response = await _apiClient.get(
      '/notifications/unread-count',
    );

    final rawData = _parseMap(
      response['data'],
      'Dữ liệu thông báo chưa đọc không hợp lệ',
    );

    final unreadCount = rawData['unreadCount'];

    if (unreadCount is num) {
      return unreadCount.toInt();
    }

    return 0;
  }

  // Đánh dấu một thông báo đã đọc
  Future<AppNotification> markAsRead(String id) async {
    final notificationId = id.trim();

    if (notificationId.isEmpty) {
      throw Exception('Notification ID không được để trống');
    }

    final response = await _apiClient.patch(
      '/notifications/$notificationId/read',
      {},
    );

    final rawData = _parseMap(
      response['data'],
      'Dữ liệu thông báo sau khi cập nhật không hợp lệ',
    );

    return AppNotification.fromJson(rawData);
  }

  // Đánh dấu tất cả thông báo đã đọc
  Future<int> markAllAsRead() async {
    final response = await _apiClient.patch(
      '/notifications/read-all',
      {},
    );

    final rawData = _parseMap(
      response['data'],
      'Dữ liệu cập nhật thông báo không hợp lệ',
    );

    return (rawData['modifiedCount'] as num?)?.toInt() ?? 0;
  }
}
