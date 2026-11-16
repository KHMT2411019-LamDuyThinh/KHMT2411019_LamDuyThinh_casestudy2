import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../models/task_statistics.dart';
import '../../services/statistics_service.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  final StatisticsService _service = StatisticsService();

  TaskStatusStatistics? _taskStats;
  TaskAssignmentStatistics? _assignmentStats;
  TaskDeadlineStatistics? _deadlineStats;

  bool _isLoading = true;
  String? _errorMessage;
  int _days = 7;

  @override
  void initState() {
    super.initState();
    _loadStatistics();
  }

  Future<void> _loadStatistics() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        _service.getTaskStatistics(),
        _service.getAssignmentStatistics(),
        _service.getDeadlineStatistics(days: _days),
      ]);

      if (!mounted) return;

      setState(() {
        _taskStats = results[0] as TaskStatusStatistics;
        _assignmentStats = results[1] as TaskAssignmentStatistics;
        _deadlineStats = results[2] as TaskDeadlineStatistics;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'todo':
        return 'Chưa thực hiện';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Hoàn thành';
      default:
        return status;
    }
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Chưa thiết lập';

    final local = date.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');

    return '$day/$month/${local.year}';
  }

  Widget _buildMetricCard({
    required String title,
    required int value,
    required IconData icon,
    required Color color,
  }) {
    return Card(
      elevation: 1,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(height: 12),
            Text(
              value.toString(),
              style: TextStyle(
                fontSize: 27,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 10),
      child: Text(
        title,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildAssignmentRow(String title, int value, IconData icon) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: Colors.blueGrey),
      title: Text(title),
      trailing: Text(
        value.toString(),
        style: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.bold,
          color: Colors.blue,
        ),
      ),
    );
  }

  Widget _buildDeadlineTask(Task task, bool overdue) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(
          overdue ? Icons.warning_amber_rounded : Icons.event,
          color: overdue ? Colors.red : Colors.orange,
        ),
        title: Text(
          task.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          'Hạn: ${_formatDate(task.dueDate)}'
          ' · ${_statusLabel(task.status)}',
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.pushNamed(context, '/task-detail', arguments: task.id);
        },
      ),
    );
  }

  Widget _buildDeadlineSection({
    required String title,
    required List<Task> tasks,
    required int count,
    required bool overdue,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
            Text(
              '$count công việc',
              style: TextStyle(
                color: overdue ? Colors.red : Colors.orange,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (tasks.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'Không có công việc nào.',
              style: TextStyle(color: Colors.grey),
            ),
          )
        else
          ...tasks.map((task) => _buildDeadlineTask(task, overdue)),
      ],
    );
  }

  Widget _buildContent() {
    final taskStats = _taskStats!;
    final assignmentStats = _assignmentStats!;
    final deadlineStats = _deadlineStats!;

    return RefreshIndicator(
      onRefresh: _loadStatistics,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Tổng quan công việc',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.35,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            children: [
              _buildMetricCard(
                title: 'Tổng công việc',
                value: taskStats.totalTasks,
                icon: Icons.assignment_outlined,
                color: Colors.blue,
              ),
              _buildMetricCard(
                title: 'Chưa thực hiện',
                value: taskStats.statusCounts['todo'] ?? 0,
                icon: Icons.pending_actions,
                color: Colors.orange,
              ),
              _buildMetricCard(
                title: 'Đang thực hiện',
                value: taskStats.statusCounts['in_progress'] ?? 0,
                icon: Icons.autorenew,
                color: Colors.blueAccent,
              ),
              _buildMetricCard(
                title: 'Đã hoàn thành',
                value: taskStats.statusCounts['completed'] ?? 0,
                icon: Icons.task_alt,
                color: Colors.green,
              ),
            ],
          ),

          _buildSectionTitle('Thống kê phân công'),

          Card(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Column(
                children: [
                  _buildAssignmentRow(
                    'Công việc do tôi tạo',
                    assignmentStats.totalCreatedByMe,
                    Icons.create_outlined,
                  ),
                  const Divider(height: 1),
                  _buildAssignmentRow(
                    'Công việc được giao cho tôi',
                    assignmentStats.totalAssignedToMe,
                    Icons.assignment_ind_outlined,
                  ),
                  const Divider(height: 1),
                  _buildAssignmentRow(
                    'Công việc tôi phụ trách chính',
                    assignmentStats.totalPrimaryResponsible,
                    Icons.person_pin_outlined,
                  ),
                  const Divider(height: 1),
                  _buildAssignmentRow(
                    'Công việc được chia sẻ với tôi',
                    assignmentStats.totalSharedWithMe,
                    Icons.people_outline,
                  ),
                ],
              ),
            ),
          ),

          _buildSectionTitle('Theo dõi thời hạn'),

          Card(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: DropdownButtonFormField<int>(
                initialValue: _days,
                decoration: const InputDecoration(
                  labelText: 'Khoảng thời gian theo dõi',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 7, child: Text('7 ngày tới')),
                  DropdownMenuItem(value: 14, child: Text('14 ngày tới')),
                  DropdownMenuItem(value: 30, child: Text('30 ngày tới')),
                ],
                onChanged: (value) {
                  if (value == null) return;

                  setState(() {
                    _days = value;
                  });

                  _loadStatistics();
                },
              ),
            ),
          ),

          _buildDeadlineSection(
            title: 'Công việc quá hạn',
            tasks: deadlineStats.overdueTasks,
            count: deadlineStats.overdueCount,
            overdue: true,
          ),

          const SizedBox(height: 18),

          _buildDeadlineSection(
            title: 'Công việc sắp đến hạn',
            tasks: deadlineStats.upcomingTasks,
            count: deadlineStats.upcomingCount,
            overdue: false,
          ),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        title: const Text('Thống kê công việc'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _loadStatistics,
            icon: const Icon(Icons.refresh),
            tooltip: 'Tải lại thống kê',
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
                      color: Colors.red,
                      size: 55,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Không thể tải thống kê',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(_errorMessage!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _loadStatistics,
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
