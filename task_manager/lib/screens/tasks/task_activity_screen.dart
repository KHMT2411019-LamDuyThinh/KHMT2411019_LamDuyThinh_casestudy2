import 'package:flutter/material.dart';

import '../../models/task_activity.dart';
import '../../services/task_activity_service.dart';

class TaskActivityScreen extends StatefulWidget {
  final String taskId;

  const TaskActivityScreen({super.key, required this.taskId});

  @override
  State<TaskActivityScreen> createState() => _TaskActivityScreenState();
}

class _TaskActivityScreenState extends State<TaskActivityScreen> {
  final TaskActivityService _service = TaskActivityService();

  List<TaskActivity> _activities = [];

  String _taskTitle = '';
  String? _errorMessage;

  int _page = 1;
  int _totalPages = 0;
  int _total = 0;

  bool _isLoading = true;
  bool _isLoadingMore = false;

  @override
  void initState() {
    super.initState();
    _loadActivities();
  }

  Future<void> _loadActivities({bool loadMore = false}) async {
    if (loadMore && (_isLoadingMore || _isLoading)) {
      return;
    }

    if (!loadMore) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    } else {
      setState(() {
        _isLoadingMore = true;
      });
    }

    final requestedPage = loadMore ? _page + 1 : 1;

    try {
      final result = await _service.getTaskActivities(
        taskId: widget.taskId,
        page: requestedPage,
        limit: 20,
      );

      if (!mounted) return;

      setState(() {
        if (loadMore) {
          _activities.addAll(result.activities);
        } else {
          _activities = result.activities;
        }

        _taskTitle = result.taskTitle;
        _page = result.page;
        _totalPages = result.totalPages;
        _total = result.total;

        _isLoading = false;
        _isLoadingMore = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '');

        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  String _actionLabel(String action) {
    switch (action) {
      case 'task_created':
        return 'Tạo công việc';
      case 'task_updated':
        return 'Chỉnh sửa công việc';
      case 'task_deleted':
        return 'Xóa công việc';
      case 'task_status_changed':
        return 'Thay đổi trạng thái';
      case 'assignees_added':
        return 'Thêm người được giao';
      case 'assignees_removed':
        return 'Xóa người được giao';
      case 'primary_assignee_changed':
        return 'Thay đổi người phụ trách chính';
      case 'task_shared':
        return 'Chia sẻ công việc';
      case 'task_share_role_updated':
        return 'Thay đổi quyền chia sẻ';
      case 'task_share_removed':
        return 'Thu hồi quyền chia sẻ';
      default:
        return 'Hoạt động khác';
    }
  }

  IconData _actionIcon(String action) {
    switch (action) {
      case 'task_created':
        return Icons.add_circle_outline;
      case 'task_updated':
        return Icons.edit_outlined;
      case 'task_deleted':
        return Icons.delete_outline;
      case 'task_status_changed':
        return Icons.swap_horiz;
      case 'assignees_added':
        return Icons.person_add_alt;
      case 'assignees_removed':
        return Icons.person_remove_outlined;
      case 'primary_assignee_changed':
        return Icons.person_pin_outlined;
      case 'task_shared':
        return Icons.share_outlined;
      case 'task_share_role_updated':
        return Icons.manage_accounts_outlined;
      case 'task_share_removed':
        return Icons.link_off;
      default:
        return Icons.history;
    }
  }

  Color _actionColor(String action) {
    switch (action) {
      case 'task_created':
        return Colors.green;
      case 'task_deleted':
        return Colors.red;
      case 'task_status_changed':
        return Colors.blue;
      case 'task_shared':
      case 'task_share_role_updated':
      case 'task_share_removed':
        return Colors.purple;
      default:
        return Colors.blueGrey;
    }
  }

  String _statusLabel(dynamic value) {
    switch (value?.toString()) {
      case 'todo':
        return 'Chưa thực hiện';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Đã hoàn thành';
      default:
        return value?.toString() ?? 'Không xác định';
    }
  }

  String _detailsDescription(TaskActivity activity) {
    final details = activity.details;

    if (activity.action == 'task_created') {
      return 'Đã tạo công việc mới.';
    }

    if (activity.action == 'task_updated') {
      final changes = details['changes'];

      if (changes is List && changes.isNotEmpty) {
        return changes.join(', ');
      }

      return 'Đã cập nhật thông tin công việc.';
    }

    if (activity.action == 'task_status_changed') {
      final previous = _statusLabel(details['previousStatus']);
      final current = _statusLabel(details['newStatus']);

      return '$previous → $current';
    }

    if (details.isEmpty) {
      return 'Không có thông tin chi tiết.';
    }

    return details.entries
        .where((entry) => entry.value != null)
        .map((entry) => '${entry.key}: ${entry.value}')
        .join(' · ');
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Không xác định';

    final local = date.toLocal();

    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');

    return '$day/$month/${local.year} $hour:$minute';
  }

  Widget _buildActivityCard(TaskActivity activity) {
    final color = _actionColor(activity.action);

    final userName = activity.user.fullName.isNotEmpty
        ? activity.user.fullName
        : activity.user.email.isNotEmpty
        ? activity.user.email
        : 'Người dùng';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: Colors.white,
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.12),
              child: Icon(_actionIcon(activity.action), color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _actionLabel(activity.action),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _detailsDescription(activity),
                    style: const TextStyle(color: Colors.black87, height: 1.4),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.person_outline,
                        size: 15,
                        color: Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          userName,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.access_time,
                        size: 15,
                        color: Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _formatDate(activity.createdAt),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history, size: 65, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            const Text(
              'Chưa có lịch sử hoạt động',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
            const SizedBox(height: 6),
            const Text(
              'Các thao tác trên công việc sẽ được ghi lại tại đây.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    return RefreshIndicator(
      onRefresh: _loadActivities,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Công việc',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _taskTitle.isEmpty ? 'Chi tiết lịch sử' : _taskTitle,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 17,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tổng số hoạt động: $_total',
                    style: const TextStyle(color: Colors.blueGrey),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          const Text(
            'Dòng thời gian hoạt động',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),

          const SizedBox(height: 12),

          if (_activities.isEmpty)
            SizedBox(height: 300, child: _buildEmptyView())
          else
            ..._activities.map(_buildActivityCard),

          if (_page < _totalPages)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: OutlinedButton.icon(
                onPressed: _isLoadingMore
                    ? null
                    : () => _loadActivities(loadMore: true),
                icon: _isLoadingMore
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.expand_more),
                label: Text(
                  _isLoadingMore ? 'Đang tải...' : 'Xem thêm hoạt động',
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        title: const Text('Lịch sử hoạt động'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _isLoading ? null : _loadActivities,
            icon: const Icon(Icons.refresh),
            tooltip: 'Tải lại',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 55,
                      color: Colors.red,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Không thể tải lịch sử hoạt động',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(_errorMessage!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _loadActivities,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            )
          : _buildContent(),
    );
  }
}
