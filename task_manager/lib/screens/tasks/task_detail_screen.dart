
import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../models/user.dart';
import '../../services/task_service.dart';
import 'task_form_screen.dart';
import 'task_collaboration_screen.dart';

class TaskDetailScreen extends StatefulWidget {
  final String taskId;

  const TaskDetailScreen({
    super.key,
    required this.taskId,
  });

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  final TaskService _taskService = TaskService();

  Task? _task;

  bool _isLoading = true;
  String? _errorMessage;
  // Kiểm tra quyền của người dùng hiện tại.
  bool get _isOwner => _task?.accessRole == 'owner';

  bool get _canEdit =>
      _isOwner || _task?.accessRole == 'editor';

  bool get _canUpdateStatus =>
      _canEdit || _task?.accessRole == 'assignee';

  @override
  void initState() {
    super.initState();
    _loadTask();
  }

  // Lấy chi tiết công việc từ Backend
  Future<void> _loadTask() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final task = await _taskService.getTaskById(widget.taskId);

      if (!mounted) return;

      setState(() {
        _task = task;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _errorMessage = error.toString().replaceFirst(
          'Exception: ',
          '',
        );
        _isLoading = false;
      });
    }
  }
// Mở màn hình chỉnh sửa công việc
  Future<void> _editTask() async {
    if (_task == null) return;

    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => TaskFormScreen(
          task: _task!,
        ),
      ),
    );

    if (!mounted) return;

    if (updated == true) {
      await _loadTask();
    }
  }
  // Mở màn hình phân công và chia sẻ công việc.
  Future<void> _openCollaboration() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (context) => TaskCollaborationScreen(
          taskId: widget.taskId,
        ),
      ),
    );

    if (!mounted) return;

    await _loadTask();
  }
  // Xóa công việc
  Future<void> _deleteTask() async {
    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Xác nhận xóa'),
          content: const Text(
            'Bạn có chắc chắn muốn xóa công việc này không?',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(dialogContext, false);
              },
              child: const Text('Hủy'),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(dialogContext, true);
              },
              child: const Text(
                'Xóa',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ],
        );
      },
    );

    if (shouldDelete != true) return;

    try {
      await _taskService.deleteTask(widget.taskId);

      if (!mounted) return;

      // Quay về danh sách sau khi xóa
      Navigator.pop(context, true);

    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().replaceFirst('Exception: ', ''),
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  // Cập nhật trạng thái công việc
  Future<void> _updateStatus(String status) async {
    try {
      final updatedTask = await _taskService.updateTaskStatus(
        id: widget.taskId,
        status: status,
      );

      if (!mounted) return;

      setState(() {
        _task = updatedTask;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cập nhật trạng thái thành công!'),
          backgroundColor: Colors.green,
        ),
      );

    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().replaceFirst('Exception: ', ''),
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  // Chuyển trạng thái sang tiếng Việt
  String _getStatusLabel(String status) {
    switch (status) {
      case 'todo':
        return 'Chưa thực hiện';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Đã hoàn thành';
      default:
        return 'Không xác định';
    }
  }

  // Chuyển mức ưu tiên sang tiếng Việt
  String _getPriorityLabel(String priority) {
    switch (priority) {
      case 'low':
        return 'Thấp';
      case 'medium':
        return 'Trung bình';
      case 'high':
        return 'Cao';
      default:
        return 'Không xác định';
    }
  }

  // Định dạng ngày tháng
  String _formatDate(DateTime? date) {
    if (date == null) {
      return 'Chưa thiết lập';
    }

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year;

    return '$day/$month/$year';
  }

  // Lấy tên người dùng
  String _getUserName(User? user) {
    if (user == null) {
      return 'Chưa xác định';
    }

    if (user.fullName.isNotEmpty) {
      return user.fullName;
    }

    if (user.email.isNotEmpty) {
      return user.email;
    }

    return 'ID: ${user.id}';
  }

  // Hiển thị một dòng thông tin
  Widget _buildInfoRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 21,
            color: Colors.blueGrey,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.grey,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Hiển thị danh sách người được giao
  Widget _buildAssignees(List<User> users) {
    if (users.isEmpty) {
      return _buildInfoRow(
        icon: Icons.people_outline,
        title: 'Người được giao',
        value: 'Chưa có người được giao',
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.people_outline,
                color: Colors.blueGrey,
                size: 21,
              ),
              SizedBox(width: 12),
              Text(
                'Người được giao',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...users.map(
                (user) => Padding(
              padding: const EdgeInsets.only(
                left: 32,
                bottom: 8,
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.account_circle_outlined,
                    size: 20,
                    color: Colors.blue,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_getUserName(user)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Hiển thị nội dung chi tiết công việc
  Widget _buildTaskContent(Task task) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tên công việc
          Text(
            task.title,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 16),

          // Trạng thái và ưu tiên
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(
                label: Text(_getStatusLabel(task.status)),
                backgroundColor: Colors.blue.shade50,
                side: BorderSide.none,
              ),
              Chip(
                label: Text(
                  'Ưu tiên: ${_getPriorityLabel(task.priority)}',
                ),
                backgroundColor: Colors.orange.shade50,
                side: BorderSide.none,
              ),
            ],
          ),
          const SizedBox(height: 16),

// Chỉ Owner, Assignee và Editor được cập nhật trạng thái.
          if (_canUpdateStatus) ...[
            const Text(
              'Cập nhật trạng thái',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),

            const SizedBox(height: 8),

            DropdownButtonFormField<String>(
              key: ValueKey(task.status),
              initialValue: task.status,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.flag_outlined),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              items: const [
                DropdownMenuItem(
                  value: 'todo',
                  child: Text('Chưa thực hiện'),
                ),
                DropdownMenuItem(
                  value: 'in_progress',
                  child: Text('Đang thực hiện'),
                ),
                DropdownMenuItem(
                  value: 'completed',
                  child: Text('Đã hoàn thành'),
                ),
              ],
              onChanged: (value) {
                if (value != null && value != task.status) {
                  _updateStatus(value);
                }
              },
            ),

            const SizedBox(height: 24),
          ],

          // Mô tả
          const Text(
            'Mô tả công việc',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 10),

          Text(
            task.description.isEmpty
                ? 'Chưa có mô tả cho công việc này.'
                : task.description,
            style: const TextStyle(
              fontSize: 15,
              height: 1.5,
            ),
          ),

          const SizedBox(height: 24),

          // Thông tin công việc
          const Text(
            'Thông tin chi tiết',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 10),

          _buildInfoRow(
            icon: Icons.person_outline,
            title: 'Người tạo',
            value: _getUserName(task.createdBy),
          ),

          _buildInfoRow(
            icon: Icons.person_pin_outlined,
            title: 'Người phụ trách chính',
            value: _getUserName(task.primaryAssignee),
          ),

          _buildAssignees(task.assignees),

          _buildInfoRow(
            icon: Icons.calendar_month_outlined,
            title: 'Ngày bắt đầu',
            value: _formatDate(task.startDate),
          ),

          _buildInfoRow(
            icon: Icons.event_outlined,
            title: 'Hạn hoàn thành',
            value: _formatDate(task.dueDate),
          ),

          _buildInfoRow(
            icon: Icons.access_time,
            title: 'Ngày tạo',
            value: _formatDate(task.createdAt),
          ),

          _buildInfoRow(
            icon: Icons.update,
            title: 'Cập nhật lần cuối',
            value: _formatDate(task.updatedAt),
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
        title: const Text('Chi tiết công việc'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          // Tải lại chi tiết - tất cả vai trò.
          IconButton(
            onPressed: _loadTask,
            icon: const Icon(Icons.refresh),
            tooltip: 'Tải lại',
          ),

          // Phân công và chia sẻ - chỉ Owner.
          if (_isOwner)
            IconButton(
              onPressed: _openCollaboration,
              icon: const Icon(Icons.groups_outlined),
              tooltip: 'Phân công và chia sẻ',
            ),

          // Chỉnh sửa - Owner và Editor.
          if (_canEdit)
            IconButton(
              onPressed: _editTask,
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Chỉnh sửa',
            ),

          // Xóa - chỉ Owner.
          if (_isOwner)
            IconButton(
              onPressed: _deleteTask,
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Xóa công việc',
            ),
        ],
      ),
      body: _isLoading
          ? const Center(
        child: CircularProgressIndicator(),
      )
          : _errorMessage != null
          ? Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                color: Colors.red,
                size: 60,
              ),
              const SizedBox(height: 16),
              const Text(
                'Không thể tải chi tiết công việc',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _loadTask,
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      )
          : _task != null
          ? _buildTaskContent(_task!)
          : const Center(
        child: Text('Không tìm thấy công việc'),
      ),
    );
  }
}
