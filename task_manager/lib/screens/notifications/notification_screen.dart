
import 'package:flutter/material.dart';

import '../../models/notification.dart';
import '../../services/notification_service.dart';

class NotificationScreen extends StatefulWidget {
  final NotificationService? notificationService;

  const NotificationScreen({
    super.key,
    this.notificationService,
  });

  @override
  State<NotificationScreen> createState() =>
      _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  late final NotificationService _service;

  List<AppNotification> _notifications = [];

  int _unreadCount = 0;
  int _currentPage = 1;
  int _totalPages = 1;

  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _isMarkingAll = false;

  String? _error;

  final Set<String> _markingIds = {};

  @override
  void initState() {
    super.initState();

    _service = widget.notificationService ?? NotificationService();

    _loadNotifications();
  }

  // Tải danh sách thông báo
  Future<void> _loadNotifications({
    bool refresh = false,
  }) async {
    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final result = await _service.getNotifications(
        page: 1,
        limit: 20,
      );

      if (!mounted) return;

      setState(() {
        _notifications = result.notifications;
        _unreadCount = result.unreadCount;
        _currentPage = result.page;
        _totalPages = result.totalPages;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.toString();
        _isLoading = false;
      });
    }
  }

  // Tải thêm thông báo
  Future<void> _loadMoreNotifications() async {
    if (_isLoadingMore || _currentPage >= _totalPages) {
      return;
    }

    setState(() {
      _isLoadingMore = true;
    });

    try {
      final result = await _service.getNotifications(
        page: _currentPage + 1,
        limit: 20,
      );

      if (!mounted) return;

      setState(() {
        _notifications.addAll(result.notifications);
        _unreadCount = result.unreadCount;
        _currentPage = result.page;
        _totalPages = result.totalPages;
        _isLoadingMore = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _isLoadingMore = false;
      });

      _showMessage('Không thể tải thêm thông báo');
    }
  }

  // Đánh dấu một thông báo đã đọc
  Future<void> _markAsRead(AppNotification notification) async {
    if (notification.isRead ||
        _markingIds.contains(notification.id)) {
      return;
    }

    _markingIds.add(notification.id);

    try {
      final result = await _service.markAsRead(notification.id);

      if (!mounted) return;

      final index = _notifications.indexWhere(
            (item) => item.id == notification.id,
      );

      if (index == -1) return;

      setState(() {
        _notifications[index] = AppNotification(
          id: notification.id,
          actorId: notification.actorId,
          actorName: notification.actorName,
          actorAvatarUrl: notification.actorAvatarUrl,
          taskId: notification.taskId,
          taskTitle: notification.taskTitle,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: true,
          readAt: result.readAt ?? DateTime.now(),
          createdAt: notification.createdAt,
        );

        if (_unreadCount > 0) {
          _unreadCount--;
        }
      });
    } catch (error) {
      if (mounted) {
        _showMessage('Không thể đánh dấu thông báo đã đọc');
      }
    } finally {
      _markingIds.remove(notification.id);
    }
  }

  // Đánh dấu tất cả thông báo đã đọc
  Future<void> _markAllAsRead() async {
    if (_unreadCount == 0 || _isMarkingAll) {
      return;
    }

    setState(() {
      _isMarkingAll = true;
    });

    try {
      await _service.markAllAsRead();

      if (!mounted) return;

      setState(() {
        _notifications = _notifications.map((item) {
          return AppNotification(
            id: item.id,
            actorId: item.actorId,
            actorName: item.actorName,
            actorAvatarUrl: item.actorAvatarUrl,
            taskId: item.taskId,
            taskTitle: item.taskTitle,
            type: item.type,
            title: item.title,
            message: item.message,
            isRead: true,
            readAt: item.readAt ?? DateTime.now(),
            createdAt: item.createdAt,
          );
        }).toList();

        _unreadCount = 0;
        _isMarkingAll = false;
      });

      _showMessage('Đã đánh dấu tất cả thông báo đã đọc');
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _isMarkingAll = false;
      });

      _showMessage('Không thể cập nhật thông báo');
    }
  }

  // Hiển thị thông báo phản hồi
  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  // Chọn biểu tượng theo loại thông báo
  IconData _getNotificationIcon(String type) {
    switch (type) {
      case 'task_assigned':
        return Icons.assignment_ind_outlined;

      case 'task_unassigned':
        return Icons.person_remove_outlined;

      case 'task_shared':
        return Icons.share_outlined;

      case 'task_share_removed':
        return Icons.link_off_outlined;

      case 'task_share_role_updated':
        return Icons.admin_panel_settings_outlined;

      case 'task_status_changed':
        return Icons.sync_alt_outlined;

      case 'task_updated':
        return Icons.edit_note_outlined;

      default:
        return Icons.notifications_outlined;
    }
  }

  // Định dạng thời gian thông báo
  String _formatTime(DateTime? date) {
    if (date == null) return '';

    final localDate = date.toLocal();
    final difference = DateTime.now().difference(localDate);

    if (difference.inSeconds < 60) {
      return 'Vừa xong';
    }

    if (difference.inMinutes < 60) {
      return '${difference.inMinutes} phút trước';
    }

    if (difference.inHours < 24) {
      return '${difference.inHours} giờ trước';
    }

    if (difference.inDays < 2) {
      return 'Hôm qua';
    }

    final day = localDate.day.toString().padLeft(2, '0');
    final month = localDate.month.toString().padLeft(2, '0');

    return '$day/$month/${localDate.year}';
  }

  // Giao diện một thông báo
  Widget _buildNotificationItem(AppNotification notification) {
    final theme = Theme.of(context);

    final isUnread = !notification.isRead;

    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 5,
      ),
      elevation: 0,
      color: isUnread
          ? theme.colorScheme.primaryContainer.withAlpha(90)
          : theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _markAsRead(notification),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: theme.colorScheme.secondaryContainer,
                child: Icon(
                  _getNotificationIcon(notification.type),
                  color: theme.colorScheme.onSecondaryContainer,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: TextStyle(
                        fontWeight: isUnread
                            ? FontWeight.bold
                            : FontWeight.w500,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      notification.message,
                      style: theme.textTheme.bodyMedium,
                    ),
                    if (notification.actorName != null &&
                        notification.actorName!.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        'Người thực hiện: ${notification.actorName}',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      _formatTime(notification.createdAt),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              if (isUnread)
                Container(
                  width: 9,
                  height: 9,
                  margin: const EdgeInsets.only(top: 5, left: 8),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // Giao diện danh sách thông báo
  Widget _buildNotificationList() {
    if (_notifications.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 100),
          Icon(
            Icons.notifications_none_outlined,
            size: 70,
            color: Colors.grey,
          ),
          SizedBox(height: 15),
          Center(
            child: Text(
              'Bạn chưa có thông báo nào',
              style: TextStyle(fontSize: 15),
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _notifications.length +
          (_currentPage < _totalPages ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _notifications.length) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Center(
              child: _isLoadingMore
                  ? const CircularProgressIndicator()
                  : OutlinedButton(
                onPressed: _loadMoreNotifications,
                child: const Text('Tải thêm thông báo'),
              ),
            ),
          );
        }

        return _buildNotificationItem(_notifications[index]);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          IconButton(
            tooltip: 'Đánh dấu tất cả đã đọc',
            onPressed: _unreadCount > 0 && !_isMarkingAll
                ? _markAllAsRead
                : null,
            icon: _isMarkingAll
                ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
              ),
            )
                : const Icon(Icons.mark_email_read_outlined),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
        child: CircularProgressIndicator(),
      )
          : _error != null && _notifications.isEmpty
          ? Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: Colors.redAccent,
              ),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => _loadNotifications(
                  refresh: true,
                ),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      )
          : Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              16,
              12,
              16,
              6,
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.notifications_active_outlined,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text('Chưa đọc: $_unreadCount'),
                const Spacer(),
                Text(
                  'Tổng: ${_notifications.length}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall,
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _loadNotifications(
                refresh: true,
              ),
              child: _buildNotificationList(),
            ),
          ),
        ],
      ),
    );
  }
}
