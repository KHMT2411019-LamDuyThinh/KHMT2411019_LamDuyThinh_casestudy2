
import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../models/task.dart';
import '../../services/task_service.dart';
import 'task_form_screen.dart';

class TaskListScreen extends StatefulWidget {
  const TaskListScreen({super.key});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen> {
  final TaskService _taskService = TaskService();
  final AuthService _authService = AuthService();

  List<Task> _tasks = [];

  bool _isLoading = true;
  String? _errorMessage;

// Tìm kiếm công việc
  final TextEditingController _searchController =
  TextEditingController();

// Bộ lọc trạng thái
  String _selectedStatus = '';

// Bộ lọc mức ưu tiên
  String _selectedPriority = '';

// Sắp xếp
  String _sortBy = 'createdAt';
  String _sortOrder = 'desc';

  @override
  void initState() {
    super.initState();
    _loadTasks();
  }
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Tải danh sách công việc từ Backend
  Future<void> _loadTasks() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final tasks = await _taskService.getTasks(
        status: _selectedStatus.isEmpty
            ? null
            : _selectedStatus,
        priority: _selectedPriority.isEmpty
            ? null
            : _selectedPriority,
        search: _searchController.text,
        sortBy: _sortBy,
        sortOrder: _sortOrder,
      );

      if (!mounted) return;

      setState(() {
        _tasks = tasks;
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
// Xóa toàn bộ điều kiện tìm kiếm và lọc
  void _clearFilters() {
    setState(() {
      _searchController.clear();
      _selectedStatus = '';
      _selectedPriority = '';
      _sortBy = 'createdAt';
      _sortOrder = 'desc';
    });

    _loadTasks();
  }

// Giao diện tìm kiếm, lọc và sắp xếp
  Widget _buildSearchAndFilters() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Tìm kiếm
          TextField(
            controller: _searchController,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _loadTasks(),
            decoration: InputDecoration(
              hintText: 'Tìm kiếm công việc...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                onPressed: () {
                  _searchController.clear();
                  _loadTasks();
                },
                icon: const Icon(Icons.close),
                tooltip: 'Xóa nội dung tìm kiếm',
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Lọc trạng thái và mức ưu tiên
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedStatus,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Trạng thái',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: '',
                      child: Text('Tất cả'),
                    ),
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
                      child: Text('Hoàn thành'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;

                    setState(() {
                      _selectedStatus = value;
                    });
                  },
                ),
              ),

              const SizedBox(width: 10),

              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedPriority,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Ưu tiên',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: '',
                      child: Text('Tất cả'),
                    ),
                    DropdownMenuItem(
                      value: 'low',
                      child: Text('Thấp'),
                    ),
                    DropdownMenuItem(
                      value: 'medium',
                      child: Text('Trung bình'),
                    ),
                    DropdownMenuItem(
                      value: 'high',
                      child: Text('Cao'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;

                    setState(() {
                      _selectedPriority = value;
                    });
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Sắp xếp
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _sortBy,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Sắp xếp theo',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'createdAt',
                      child: Text('Ngày tạo'),
                    ),
                    DropdownMenuItem(
                      value: 'updatedAt',
                      child: Text('Ngày cập nhật'),
                    ),
                    DropdownMenuItem(
                      value: 'title',
                      child: Text('Tên công việc'),
                    ),
                    DropdownMenuItem(
                      value: 'startDate',
                      child: Text('Ngày bắt đầu'),
                    ),
                    DropdownMenuItem(
                      value: 'dueDate',
                      child: Text('Hạn hoàn thành'),
                    ),
                    DropdownMenuItem(
                      value: 'priority',
                      child: Text('Mức ưu tiên'),
                    ),
                    DropdownMenuItem(
                      value: 'status',
                      child: Text('Trạng thái'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) return;

                    setState(() {
                      _sortBy = value;
                    });
                  },
                ),
              ),

              const SizedBox(width: 8),

              IconButton(
                onPressed: () {
                  setState(() {
                    _sortOrder =
                    _sortOrder == 'asc' ? 'desc' : 'asc';
                  });

                  _loadTasks();
                },
                icon: Icon(
                  _sortOrder == 'asc'
                      ? Icons.arrow_upward
                      : Icons.arrow_downward,
                ),
                tooltip: _sortOrder == 'asc'
                    ? 'Tăng dần'
                    : 'Giảm dần',
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Nút áp dụng và xóa bộ lọc
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: _clearFilters,
                child: const Text('Xóa bộ lọc'),
              ),

              const SizedBox(width: 8),

              ElevatedButton.icon(
                onPressed: _loadTasks,
                icon: const Icon(Icons.filter_alt),
                label: const Text('Áp dụng'),
              ),
            ],
          ),
        ],
      ),
    );
  }
  // Mở màn hình tạo công việc mới
  Future<void> _openCreateTask() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => const TaskFormScreen(),
      ),
    );

    if (!mounted) return;

    if (created == true) {
      await _loadTasks();
    }
  }
  // Xử lý đăng xuất
  Future<void> _logout() async {
    // Hiển thị hộp thoại xác nhận
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Xác nhận đăng xuất'),
          content: const Text(
            'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
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
                'Đăng xuất',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ],
        );
      },
    );

    // Người dùng chọn Hủy
    if (shouldLogout != true) return;

    try {
      // Xóa JWT Token đã lưu trên thiết bị
      await _authService.logout();

      if (!mounted) return;

      // Quay về Login và xóa các màn hình trước đó
      Navigator.pushNamedAndRemoveUntil(
        context,
        '/login',
            (route) => false,
      );

    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Đăng xuất thất bại: ${error.toString().replaceFirst('Exception: ', '')}',
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

  // Hiển thị màu trạng thái
  Color _getStatusColor(String status) {
    switch (status) {
      case 'todo':
        return Colors.orange;
      case 'in_progress':
        return Colors.blue;
      case 'completed':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  // Hiển thị một công việc
  Widget _buildTaskCard(Task task) {
    final statusColor = _getStatusColor(task.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: Colors.grey.shade200,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),

        title: Text(
          task.title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),

        subtitle: Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (task.description.isNotEmpty)
                Text(
                  task.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

              const SizedBox(height: 10),

              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildInfoChip(
                    label: _getStatusLabel(task.status),
                    color: statusColor,
                  ),

                  _buildInfoChip(
                    label: 'Ưu tiên: ${_getPriorityLabel(task.priority)}',
                    color: task.priority == 'high'
                        ? Colors.red
                        : Colors.grey,
                  ),
                ],
              ),

              const SizedBox(height: 10),

              Row(
                children: [
                  const Icon(
                    Icons.calendar_today_outlined,
                    size: 15,
                    color: Colors.grey,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Hạn: ${_formatDate(task.dueDate)}',
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

        trailing: const Icon(
          Icons.chevron_right,
          color: Colors.grey,
        ),

        onTap: () async {
          await Navigator.pushNamed(
            context,
            '/task-detail',
            arguments: task.id,
          );

          if (!mounted) return;

          await _loadTasks();
        },
      ),
    );
  }

  // Tạo nhãn thông tin
  Widget _buildInfoChip({
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }

  // Màn hình khi chưa có công việc
  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.assignment_outlined,
            size: 75,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          const Text(
            'Chưa có công việc nào',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Các công việc của bạn sẽ xuất hiện ở đây.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey),
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
        title: const Text(
          'Công việc của tôi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          // Nút tải lại danh sách công việc
          IconButton(
            onPressed: _loadTasks,
            icon: const Icon(Icons.refresh),
            tooltip: 'Tải lại',
          ),

          // Nút mở thông tin cá nhân
          IconButton(
            onPressed: () {
              Navigator.pushNamed(context, '/profile');
            },
            icon: const Icon(Icons.person_outline),
            tooltip: 'Thông tin cá nhân',
          ),

          // Nút đăng xuất
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            tooltip: 'Đăng xuất',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateTask,
        icon: const Icon(Icons.add),
        label: const Text('Tạo công việc'),
      ),

      body: Column(
        children: [
          // Khu vực tìm kiếm và lọc
          _buildSearchAndFilters(),

          // Khu vực hiển thị danh sách
          Expanded(
            child: _isLoading
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
                      size: 60,
                      color: Colors.red,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Không thể tải công việc',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: _loadTasks,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            )
                : RefreshIndicator(
              onRefresh: _loadTasks,
              child: _tasks.isEmpty
                  ? ListView(
                physics:
                const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.of(context)
                        .size
                        .height *
                        0.55,
                    child: _buildEmptyView(),
                  ),
                ],
              )
                  : ListView.builder(
                padding: const EdgeInsets.all(16),
                physics:
                const AlwaysScrollableScrollPhysics(),
                itemCount: _tasks.length,
                itemBuilder: (context, index) {
                  return _buildTaskCard(
                    _tasks[index],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
