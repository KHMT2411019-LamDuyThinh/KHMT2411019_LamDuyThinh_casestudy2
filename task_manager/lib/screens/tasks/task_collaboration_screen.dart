import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../services/task_service.dart';

class TaskCollaborationScreen extends StatefulWidget {
  final String taskId;

  const TaskCollaborationScreen({
    super.key,
    required this.taskId,
  });

  @override
  State<TaskCollaborationScreen> createState() =>
      _TaskCollaborationScreenState();
}

class _TaskCollaborationScreenState
    extends State<TaskCollaborationScreen> {
  final TaskService _service = TaskService();
  final TextEditingController _searchController =
  TextEditingController();

  final TextEditingController _assignmentSearchController =
  TextEditingController();

  List<Map<String, dynamic>> _assignmentMembers = [];

  final Map<String, Map<String, dynamic>> _assignmentCandidates = {};

  bool _isSearchingAssignments = false;

  Task? _task;

  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _shares = [];

  final Set<String> _selectedAssigneeIds = {};

  String? _primaryAssigneeId;
  Map<String, dynamic>? _selectedShareMember;
  String _shareRole = 'viewer';

  bool _isLoading = true;
  bool _isSearching = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _assignmentSearchController.dispose();
    super.dispose();
  }

  String _memberId(dynamic value) {
    if (value is Map) {
      return (value['_id'] ?? value['id'] ?? '').toString();
    }

    return value?.toString() ?? '';
  }

  String _memberName(Map<String, dynamic> member) {
    final name = member['fullName']?.toString() ?? '';
    final email = member['email']?.toString() ?? '';

    if (name.isNotEmpty) return name;
    if (email.isNotEmpty) return email;

    return 'Thành viên';
  }

  void _showMessage(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Colors.red : Colors.green,
      ),
    );
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final task = await _service.getTaskById(widget.taskId);
      final shares = await _service.getTaskShares(widget.taskId);

      if (!mounted) return;

      setState(() {
        _task = task;
        _shares = shares;

        // Lưu thông tin những thành viên đã được phân công.
        _assignmentCandidates
          ..clear()
          ..addEntries(
            task.assignees.map(
                  (user) => MapEntry(
                user.id,
                <String, dynamic>{
                  'id': user.id,
                  'fullName': user.fullName,
                  'email': user.email,
                },
              ),
            ),
          );

        // Khôi phục danh sách người được phân công.
        _selectedAssigneeIds
          ..clear()
          ..addAll(task.assignees.map((user) => user.id));

        _primaryAssigneeId = task.primaryAssignee?.id;

        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _isLoading = false;
      });

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    }
  }

  // Tìm kiếm thành viên
  Future<void> _searchMembers() async {
    final keyword = _searchController.text.trim();

    if (keyword.length < 2) {
      _showMessage('Nhập ít nhất 2 ký tự để tìm kiếm');
      return;
    }

    setState(() {
      _isSearching = true;
      _members = [];
    });

    try {
      final members = await _service.searchMembers(keyword);

      if (!mounted) return;

      setState(() {
        _members = members;
        _isSearching = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _isSearching = false;
      });

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    }
  }
  // Tìm kiếm thành viên để phân công.
  Future<void> _searchAssignmentMembers() async {
    final keyword = _assignmentSearchController.text.trim();

    if (keyword.length < 2) {
      _showMessage('Nhập ít nhất 2 ký tự để tìm kiếm');
      return;
    }

    setState(() {
      _isSearchingAssignments = true;
      _assignmentMembers = [];
    });

    try {
      final members = await _service.searchMembers(keyword);

      if (!mounted) return;

      setState(() {
        _assignmentMembers = members;
        _isSearchingAssignments = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _isSearchingAssignments = false;
      });

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    }
  }
  // Phân công thành viên
  Future<void> _saveAssignments() async {
    if (_primaryAssigneeId != null &&
        !_selectedAssigneeIds.contains(_primaryAssigneeId)) {
      _showMessage(
        'Người phụ trách chính phải nằm trong danh sách được giao',
        error: true,
      );
      return;
    }

    // Không cho lưu nếu thành viên được chọn phân công đang có quyền chia sẻ.
    final sharedUserIds = _shares
        .map((share) => _memberId(share['userId']))
        .where((id) => id.isNotEmpty)
        .toSet();

    if (_selectedAssigneeIds.any(sharedUserIds.contains)) {
      _showMessage(
        'Một thành viên đang có quyền chia sẻ. Hãy thu hồi quyền chia sẻ trước khi phân công.',
        error: true,
      );
      return;
    }

    // Không lưu phân công cho người đang được chọn ở phần chia sẻ.
    if (_selectedShareMember != null &&
        _selectedAssigneeIds.contains(_memberId(_selectedShareMember))) {
      _showMessage(
        'Một thành viên không thể vừa được phân công vừa được chia sẻ.',
        error: true,
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      await _service.assignTask(
        taskId: widget.taskId,
        assigneeIds: _selectedAssigneeIds.toList(),
        primaryAssigneeId: _primaryAssigneeId,
      );

      if (!mounted) return;

      _showMessage('Lưu phân công thành công');
      await _loadData();
    } catch (error) {
      if (!mounted) return;

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  // Chia sẻ công việc
  Future<void> _shareTask() async {
    if (_selectedShareMember == null) {
      _showMessage('Vui lòng chọn thành viên cần chia sẻ');
      return;
    }

    final userId = _memberId(_selectedShareMember);

    final isAssigned =
        _task?.assignees.any((user) => user.id == userId) ?? false;
    final isSelectedForAssignment = _selectedAssigneeIds.contains(userId);
    final isAlreadyShared = _shares.any(
          (share) => _memberId(share['userId']) == userId,
    );

    if (isAssigned || isSelectedForAssignment) {
      _showMessage(
        'Thành viên này đang được phân công. Hãy gỡ phân công và lưu trước khi chia sẻ.',
        error: true,
      );
      return;
    }

    if (isAlreadyShared) {
      _showMessage('Thành viên này đã được chia sẻ công việc.', error: true);
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      await _service.shareTask(
        taskId: widget.taskId,
        userId: userId,
        role: _shareRole,
      );

      if (!mounted) return;

      setState(() {
        _selectedShareMember = null;
      });

      _showMessage('Chia sẻ công việc thành công');
      await _loadData();
    } catch (error) {
      if (!mounted) return;

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  // Thay đổi quyền chia sẻ
  Future<void> _changeShareRole(
      Map<String, dynamic> share,
      String role,
      ) async {
    final userId = _memberId(share['userId']);

    try {
      await _service.updateTaskShareRole(
        taskId: widget.taskId,
        userId: userId,
        role: role,
      );

      if (!mounted) return;

      _showMessage('Đã cập nhật quyền chia sẻ');
      await _loadData();
    } catch (error) {
      if (!mounted) return;

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    }
  }

  // Thu hồi quyền chia sẻ
  Future<void> _removeShare(
      Map<String, dynamic> share,
      ) async {
    final userId = _memberId(share['userId']);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Thu hồi quyền chia sẻ'),
        content: const Text(
          'Bạn có chắc chắn muốn thu hồi quyền truy cập của thành viên này?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Thu hồi',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _service.removeTaskShare(
        taskId: widget.taskId,
        userId: userId,
      );

      if (!mounted) return;

      _showMessage('Đã thu hồi quyền chia sẻ');
      await _loadData();
    } catch (error) {
      if (!mounted) return;

      _showMessage(
        error.toString().replaceFirst('Exception: ', ''),
        error: true,
      );
    }
  }

  Widget _buildMemberSearch() {
    return Column(
      children: [
        TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Nhập tên hoặc email thành viên',
            prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            suffixIcon: IconButton(
              onPressed: _searchMembers,
              icon: const Icon(Icons.arrow_forward),
            ),
          ),
          onSubmitted: (_) => _searchMembers(),
        ),
        if (_isSearching)
          const Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(),
          ),
        if (!_isSearching && _members.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.black12),
            ),
            child: Column(
              children: _members.map((member) {
                final id = _memberId(member);
                final isSelected =
                    _selectedShareMember != null &&
                        _memberId(_selectedShareMember) == id;

                final isAssigned =
                    (_task?.assignees.any((user) => user.id == id) ?? false) ||
                        _selectedAssigneeIds.contains(id);

                final isAlreadyShared = _shares.any(
                      (share) => _memberId(share['userId']) == id,
                );

                final cannotShare = isAssigned || isAlreadyShared;

                return ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.person_outline),
                  ),
                  title: Text(_memberName(member)),
                  subtitle: Text(
                    isAssigned
                        ? 'Thành viên đã được phân công'
                        : isAlreadyShared
                        ? 'Thành viên đã được chia sẻ'
                        : member['email']?.toString() ?? '',
                  ),
                  trailing: isSelected
                      ? const Icon(
                    Icons.check_circle,
                    color: Colors.green,
                  )
                      : const Icon(Icons.add_circle_outline),
                  onTap: cannotShare
                      ? null
                      : () {
                    setState(() {
                      _selectedShareMember = member;
                    });
                  },
                );
              }).toList(),
            ),
          ),
        if (!_isSearching &&
            _searchController.text.trim().length >= 2 &&
            _members.isEmpty)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text('Không tìm thấy thành viên'),
          ),
      ],
    );
  }

  Widget _buildAssignments() {
    final selectedUsers = _selectedAssigneeIds
        .map((id) => _assignmentCandidates[id])
        .whereType<Map<String, dynamic>>()
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Tìm kiếm thành viên mới.
        TextField(
          controller: _assignmentSearchController,
          decoration: InputDecoration(
            hintText: 'Tìm thành viên bằng tên hoặc email',
            prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            suffixIcon: IconButton(
              onPressed: _isSearchingAssignments
                  ? null
                  : _searchAssignmentMembers,
              icon: const Icon(Icons.arrow_forward),
            ),
          ),
          onSubmitted: (_) => _searchAssignmentMembers(),
        ),

        const SizedBox(height: 12),

        if (_isSearchingAssignments)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(12),
              child: CircularProgressIndicator(),
            ),
          ),

        // Kết quả tìm kiếm.
        if (!_isSearchingAssignments && _assignmentMembers.isNotEmpty)
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.black12),
            ),
            child: Column(
              children: _assignmentMembers.map((member) {
                final id = _memberId(member);

                final isSelected =
                _selectedAssigneeIds.contains(id);

                // Không cho phân công người đang được chia sẻ.
                final isAlreadyShared = _shares.any(
                      (share) => _memberId(share['userId']) == id,
                );
                final isSelectedForSharing =
                    _selectedShareMember != null &&
                        _memberId(_selectedShareMember) == id;
                final cannotAssign = isAlreadyShared || isSelectedForSharing;

                return CheckboxListTile(
                  value: cannotAssign ? false : isSelected,
                  controlAffinity: ListTileControlAffinity.leading,
                  secondary: const CircleAvatar(
                    child: Icon(Icons.person_outline),
                  ),
                  title: Text(_memberName(member)),
                  subtitle: Text(
                    isAlreadyShared
                        ? 'Thành viên đang có quyền chia sẻ'
                        : isSelectedForSharing
                        ? 'Thành viên đang được chọn để chia sẻ'
                        : member['email']?.toString() ?? '',
                  ),
                  onChanged: cannotAssign
                      ? null
                      : (value) {
                    setState(() {
                      if (value == true) {
                        _assignmentCandidates[id] = member;
                        _selectedAssigneeIds.add(id);
                      } else {
                        _selectedAssigneeIds.remove(id);

                        if (_primaryAssigneeId == id) {
                          _primaryAssigneeId = null;
                        }
                      }
                    });
                  },
                );
              }).toList(),
            ),
          ),

        if (!_isSearchingAssignments &&
            _assignmentSearchController.text.trim().length >= 2 &&
            _assignmentMembers.isEmpty)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text('Không tìm thấy thành viên'),
          ),

        const SizedBox(height: 20),

        // Danh sách thành viên đã chọn.
        const Text(
          'THÀNH VIÊN ĐƯỢC PHÂN CÔNG',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.blueGrey,
          ),
        ),

        const SizedBox(height: 8),

        if (selectedUsers.isEmpty)
          const Text(
            'Chưa có thành viên nào được phân công.',
            style: TextStyle(color: Colors.grey),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: selectedUsers.map((member) {
              final id = _memberId(member);

              return FilterChip(
                avatar: const Icon(Icons.person, size: 18),
                label: Text(_memberName(member)),
                selected: true,
                onSelected: (_) {
                  setState(() {
                    _selectedAssigneeIds.remove(id);

                    if (_primaryAssigneeId == id) {
                      _primaryAssigneeId = null;
                    }
                  });
                },
              );
            }).toList(),
          ),

        const SizedBox(height: 20),

        // Chọn người phụ trách chính.
        if (selectedUsers.isNotEmpty)
          DropdownButtonFormField<String>(
            initialValue: _selectedAssigneeIds.contains(_primaryAssigneeId)
                ? _primaryAssigneeId
                : null,
            decoration: const InputDecoration(
              labelText: 'Người phụ trách chính',
              border: OutlineInputBorder(),
            ),
            items: selectedUsers.map((member) {
              final id = _memberId(member);

              return DropdownMenuItem<String>(
                value: id,
                child: Text(_memberName(member)),
              );
            }).toList(),
            onChanged: (value) {
              setState(() {
                _primaryAssigneeId = value;
              });
            },
          ),

        const SizedBox(height: 16),

        // Lưu phân công.
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _isSaving ? null : _saveAssignments,
            icon: const Icon(Icons.save_outlined),
            label: Text(
              _isSaving ? 'Đang lưu...' : 'Lưu phân công',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildShares() {
    if (_shares.isEmpty) {
      return const Text('Chưa chia sẻ công việc cho ai.');
    }

    return Column(
      children: _shares.map((share) {
        final user = share['userId'];
        final userMap = user is Map
            ? Map<String, dynamic>.from(user)
            : <String, dynamic>{};

        final name = _memberName(userMap);
        final role = share['role']?.toString() ?? 'viewer';

        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    const CircleAvatar(
                      child: Icon(Icons.person_outline),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            userMap['email']?.toString() ?? '',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Thu hồi quyền',
                      onPressed: () => _removeShare(share),
                      icon: const Icon(
                        Icons.person_remove_outlined,
                        color: Colors.red,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: role,
                  decoration: const InputDecoration(
                    labelText: 'Quyền truy cập',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'viewer',
                      child: Text('Viewer - Chỉ xem'),
                    ),
                    DropdownMenuItem(
                      value: 'editor',
                      child: Text('Editor - Được chỉnh sửa'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null && value != role) {
                      _changeShareRole(share, value);
                    }
                  },
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        title: const Text('Phân công và chia sẻ'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _task == null
          ? const Center(
        child: Text('Không thể tải thông tin công việc'),
      )
          : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _task!.title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),

            // Phân công
            const Text(
              'PHÂN CÔNG THÀNH VIÊN',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.blueGrey,
              ),
            ),
            const SizedBox(height: 12),
            _buildAssignments(),

            const SizedBox(height: 32),

            // Chia sẻ
            const Text(
              'CHIA SẺ CÔNG VIỆC',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.blueGrey,
              ),
            ),
            const SizedBox(height: 12),
            _buildMemberSearch(),

            if (_selectedShareMember != null) ...[
              const SizedBox(height: 12),
              ListTile(
                tileColor: Colors.white,
                leading: const Icon(Icons.person),
                title: Text(
                  _memberName(_selectedShareMember!),
                ),
                subtitle: const Text('Thành viên được chọn'),
              ),
              DropdownButtonFormField<String>(
                initialValue: _shareRole,
                decoration: const InputDecoration(
                  labelText: 'Chọn quyền chia sẻ',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'viewer',
                    child: Text('Viewer - Chỉ xem'),
                  ),
                  DropdownMenuItem(
                    value: 'editor',
                    child: Text('Editor - Được chỉnh sửa'),
                  ),
                ],
                onChanged: (value) {
                  if (value != null) {
                    setState(() {
                      _shareRole = value;
                    });
                  }
                },
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _shareTask,
                  icon: const Icon(Icons.share_outlined),
                  label: const Text('Chia sẻ công việc'),
                ),
              ),
            ],

            const SizedBox(height: 24),

            const Text(
              'DANH SÁCH ĐÃ CHIA SẺ',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.blueGrey,
              ),
            ),
            const SizedBox(height: 12),
            _buildShares(),
          ],
        ),
      ),
    );
  }
}
