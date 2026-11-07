
import 'package:flutter/material.dart';

import '../../models/task.dart';
import '../../services/task_service.dart';

class TaskFormScreen extends StatefulWidget {
  final Task? task;

  const TaskFormScreen({
    super.key,
    this.task,
  });

  bool get isEditing => task != null;

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final TaskService _taskService = TaskService();

  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;

  DateTime? _startDate;
  DateTime? _dueDate;

  String _priority = 'medium';

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();

    final task = widget.task;

    _titleController = TextEditingController(
      text: task?.title ?? '',
    );

    _descriptionController = TextEditingController(
      text: task?.description ?? '',
    );

    _startDate = task?.startDate;
    _dueDate = task?.dueDate;
    _priority = task?.priority ?? 'medium';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  // Định dạng ngày tháng
  String _formatDate(DateTime? date) {
    if (date == null) {
      return 'Chưa thiết lập';
    }

    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');

    return '$day/$month/${date.year}';
  }

  // Chọn ngày bắt đầu hoặc ngày hết hạn
  Future<void> _selectDate({
    required bool isStartDate,
  }) async {
    DateTime? selectedDate = isStartDate
        ? _startDate
        : _dueDate;

    final firstDate = DateTime(2000);
    final lastDate = DateTime(2100);

    selectedDate ??= DateTime.now();

    if (selectedDate.isBefore(firstDate)) {
      selectedDate = firstDate;
    }

    if (selectedDate.isAfter(lastDate)) {
      selectedDate = lastDate;
    }

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: selectedDate,
      firstDate: firstDate,
      lastDate: lastDate,
      helpText: isStartDate
          ? 'Chọn ngày bắt đầu'
          : 'Chọn hạn hoàn thành',
      cancelText: 'Hủy',
      confirmText: 'Xác nhận',
    );

    if (pickedDate == null || !mounted) return;

    setState(() {
      if (isStartDate) {
        _startDate = pickedDate;
      } else {
        _dueDate = pickedDate;
      }
    });
  }

  // Hiển thị trường chọn ngày
  Widget _buildDateField({
    required String label,
    required DateTime? date,
    required bool isStartDate,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
          ),
        ),

        const SizedBox(height: 8),

        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _selectDate(
                  isStartDate: isStartDate,
                ),
                icon: const Icon(
                  Icons.calendar_month_outlined,
                ),
                label: Text(_formatDate(date)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 16,
                  ),
                  alignment: Alignment.centerLeft,
                ),
              ),
            ),

            if (date != null)
              IconButton(
                onPressed: () {
                  setState(() {
                    if (isStartDate) {
                      _startDate = null;
                    } else {
                      _dueDate = null;
                    }
                  });
                },
                icon: const Icon(
                  Icons.close,
                  color: Colors.red,
                ),
                tooltip: 'Xóa ngày',
              ),
          ],
        ),
      ],
    );
  }

  // Lưu công việc
  Future<void> _saveTask() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Kiểm tra ngày bắt đầu và ngày hết hạn
    if (_startDate != null &&
        _dueDate != null &&
        _dueDate!.isBefore(_startDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Hạn hoàn thành không được trước ngày bắt đầu',
          ),
          backgroundColor: Colors.red,
        ),
      );

      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      if (widget.isEditing) {
        // Cập nhật công việc
        await _taskService.updateTask(
          id: widget.task!.id,
          title: _titleController.text,
          description: _descriptionController.text,
          startDate: _startDate,
          dueDate: _dueDate,
          priority: _priority,
        );
      } else {
        // Tạo công việc mới
        await _taskService.createTask(
          title: _titleController.text,
          description: _descriptionController.text,
          startDate: _startDate,
          dueDate: _dueDate,
          priority: _priority,
        );
      }

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.isEditing
                ? 'Cập nhật công việc thành công!'
                : 'Tạo công việc thành công!',
          ),
          backgroundColor: Colors.green,
        ),
      );

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

    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),

      appBar: AppBar(
        title: Text(
          widget.isEditing
              ? 'Chỉnh sửa công việc'
              : 'Tạo công việc mới',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),

      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Tiêu đề công việc
              const Text(
                'Tên công việc',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 8),

              TextFormField(
                controller: _titleController,
                textCapitalization: TextCapitalization.sentences,
                maxLength: 150,
                decoration: InputDecoration(
                  hintText: 'Nhập tên công việc',
                  prefixIcon: const Icon(
                    Icons.task_alt,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null ||
                      value.trim().isEmpty) {
                    return 'Vui lòng nhập tên công việc';
                  }

                  return null;
                },
              ),

              const SizedBox(height: 12),

              // Mô tả
              const Text(
                'Mô tả công việc',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 8),

              TextFormField(
                controller: _descriptionController,
                maxLines: 4,
                maxLength: 1000,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Nhập mô tả công việc...',
                  alignLabelWithHint: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Mức độ ưu tiên
              const Text(
                'Mức độ ưu tiên',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 8),

              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: InputDecoration(
                  prefixIcon: const Icon(
                    Icons.flag_outlined,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: const [
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
                onChanged: _isSaving
                    ? null
                    : (value) {
                  if (value != null) {
                    setState(() {
                      _priority = value;
                    });
                  }
                },
              ),

              const SizedBox(height: 20),

              // Ngày bắt đầu
              _buildDateField(
                label: 'Ngày bắt đầu',
                date: _startDate,
                isStartDate: true,
              ),

              const SizedBox(height: 20),

              // Hạn hoàn thành
              _buildDateField(
                label: 'Hạn hoàn thành',
                date: _dueDate,
                isStartDate: false,
              ),

              const SizedBox(height: 32),

              // Nút lưu
              SizedBox(
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _saveTask,
                  icon: _isSaving
                      ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                      : const Icon(Icons.save_outlined),
                  label: Text(
                    widget.isEditing
                        ? 'LƯU THAY ĐỔI'
                        : 'TẠO CÔNG VIỆC',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
