
import mongoose from 'mongoose';
import Task from '../models/Task.js';

// Lấy danh sách công việc

// Lấy danh sách công việc, tìm kiếm, lọc và sắp xếp
export const getTasks = async (req, res) => {
    try {
        const userId = req.userId;

        // Chỉ lấy công việc do mình tạo hoặc được giao
        const conditions = [
            {
                $or: [
                    { createdBy: userId },
                    { assigneeIds: userId }
                ]
            }
        ];

        // Tìm kiếm theo tiêu đề hoặc mô tả
        const search = req.query.search;

        if (search !== undefined) {
            if (typeof search !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid search keyword'
                });
            }

            const keyword = search.trim();

            if (keyword) {
                const escapedKeyword = keyword.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );

                conditions.push({
                    $or: [
                        {
                            title: {
                                $regex: escapedKeyword,
                                $options: 'i'
                            }
                        },
                        {
                            description: {
                                $regex: escapedKeyword,
                                $options: 'i'
                            }
                        }
                    ]
                });
            }
        }

        const filter = {
            $and: conditions
        };

        // Lọc theo trạng thái
        if (req.query.status !== undefined) {
            const allowedStatus = [
                'todo',
                'in_progress',
                'completed'
            ];

            if (
                typeof req.query.status !== 'string' ||
                !allowedStatus.includes(req.query.status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task status'
                });
            }

            filter.status = req.query.status;
        }

        // Lọc theo mức độ ưu tiên
        if (req.query.priority !== undefined) {
            const allowedPriority = [
                'low',
                'medium',
                'high'
            ];

            if (
                typeof req.query.priority !== 'string' ||
                !allowedPriority.includes(req.query.priority)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task priority'
                });
            }

            filter.priority = req.query.priority;
        }

        // Kiểm tra trường sắp xếp
        const allowedSortFields = [
            'createdAt',
            'updatedAt',
            'title',
            'startDate',
            'dueDate',
            'priority',
            'status'
        ];

        const sortBy = req.query.sortBy || 'createdAt';

        if (
            typeof sortBy !== 'string' ||
            !allowedSortFields.includes(sortBy)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sort field'
            });
        }

        // Kiểm tra chiều sắp xếp
const sortOrder = req.query.sortOrder || 'desc';

if (
    typeof sortOrder !== 'string' ||
    !['asc', 'desc'].includes(sortOrder)
) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sort order'
            });
        }

// Xác định chiều sắp xếp
const sortDirection = sortOrder === 'asc' ? 1 : -1;

// Truy vấn MongoDB
const tasks = await Task.find(filter)
    .populate('createdBy', 'fullName email avatarUrl')
    .populate('assigneeIds', 'fullName email avatarUrl')
    .populate('primaryAssigneeId', 'fullName email avatarUrl')
    .sort(
        sortBy === 'priority' || sortBy === 'status'
            ? { createdAt: -1 }
            : { [sortBy]: sortDirection }
    );

// Sắp xếp mức ưu tiên theo thứ tự nghiệp vụ
if (sortBy === 'priority') {
    const priorityOrder = {
        low: 1,
        medium: 2,
        high: 3
    };

    tasks.sort((a, b) => {
        return (
            (priorityOrder[a.priority] - priorityOrder[b.priority]) *
            sortDirection
        );
    });
}

// Sắp xếp trạng thái theo thứ tự nghiệp vụ
if (sortBy === 'status') {
    const statusOrder = {
        todo: 1,
        in_progress: 2,
        completed: 3
    };

    tasks.sort((a, b) => {
        return (
            (statusOrder[a.status] - statusOrder[b.status]) *
            sortDirection
        );
    });
}
        return res.status(200).json({
            success: true,
            message: 'Get tasks successfully',
            total: tasks.length,
            tasks
        });

    } catch (error) {
        console.error('Get tasks error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Lấy chi tiết một công việc
export const getTaskById = async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.id;

        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findOne({
            _id: taskId,
            $or: [
                { createdBy: userId },
                { assigneeIds: userId }
            ]
        })
            .populate('createdBy', 'fullName email avatarUrl')
            .populate('assigneeIds', 'fullName email avatarUrl')
            .populate('primaryAssigneeId', 'fullName email avatarUrl');

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Get task successfully',
            task
        });

    } catch (error) {
        console.error('Get task detail error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Tạo công việc mới
export const createTask = async (req, res) => {
    try {
        const {
            title,
            description = '',
            startDate,
            dueDate,
            priority = 'medium'
        } = req.body;

        // Kiểm tra tiêu đề
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Task title is required'
            });
        }

        // Kiểm tra mô tả
        if (typeof description !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Task description must be a string'
            });
        }

        // Kiểm tra mức ưu tiên
        const allowedPriority = ['low', 'medium', 'high'];

        if (!allowedPriority.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task priority'
            });
        }

        // Chuyển đổi và kiểm tra ngày tháng
        const parseDate = (value) => {
            if (value === undefined || value === null || value === '') {
                return { valid: true, date: null };
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return { valid: false, date: null };
            }

            return { valid: true, date };
        };

        const parsedStartDate = parseDate(startDate);
        const parsedDueDate = parseDate(dueDate);

        if (!parsedStartDate.valid || !parsedDueDate.valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task date'
            });
        }

        // Ngày hết hạn không được trước ngày bắt đầu
        if (
            parsedStartDate.date &&
            parsedDueDate.date &&
            parsedDueDate.date < parsedStartDate.date
        ) {
            return res.status(400).json({
                success: false,
                message: 'Due date cannot be earlier than start date'
            });
        }

        // Tạo công việc
        const task = await Task.create({
            title: title.trim(),
            description: description.trim(),
            createdBy: req.userId,
            startDate: parsedStartDate.date,
            dueDate: parsedDueDate.date,
            priority
        });

        // Lấy thông tin người tạo sau khi tạo công việc
        await task.populate('createdBy', 'fullName email avatarUrl');

        return res.status(201).json({
            success: true,
            message: 'Task created successfully',
            task
        });

    } catch (error) {
        console.error('Create task error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/* Cập nhật thông tin công việc */
export const updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        // Kiểm tra ID công việc
        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Chỉ người tạo công việc được chỉnh sửa ở giai đoạn này
        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const {
            title,
            description,
            startDate,
            dueDate,
            priority
        } = req.body;

        // Kiểm tra tiêu đề
        if (title !== undefined) {
            if (typeof title !== 'string' || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Task title is required'
                });
            }

            task.title = title.trim();
        }

        // Kiểm tra mô tả
        if (description !== undefined) {
            if (typeof description !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Task description must be a string'
                });
            }

            task.description = description.trim();
        }

        // Kiểm tra mức ưu tiên
        if (priority !== undefined) {
            const allowedPriority = ['low', 'medium', 'high'];

            if (!allowedPriority.includes(priority)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task priority'
                });
            }

            task.priority = priority;
        }

        // Kiểm tra ngày bắt đầu và ngày hết hạn
        const parseDate = (value, currentDate) => {
            if (value === undefined) {
                return { valid: true, date: currentDate };
            }

            if (value === null || value === '') {
                return { valid: true, date: null };
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return { valid: false, date: null };
            }

            return { valid: true, date };
        };

        const parsedStartDate = parseDate(
            startDate,
            task.startDate
        );

        const parsedDueDate = parseDate(
            dueDate,
            task.dueDate
        );

        if (!parsedStartDate.valid || !parsedDueDate.valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task date'
            });
        }

        // Ngày hết hạn không được trước ngày bắt đầu
        if (
            parsedStartDate.date &&
            parsedDueDate.date &&
            parsedDueDate.date < parsedStartDate.date
        ) {
            return res.status(400).json({
                success: false,
                message: 'Due date cannot be earlier than start date'
            });
        }

        task.startDate = parsedStartDate.date;
        task.dueDate = parsedDueDate.date;

        // Lưu thay đổi
        await task.save();

        await task.populate('createdBy', 'fullName email avatarUrl');
        await task.populate('assigneeIds', 'fullName email avatarUrl');
        await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            task
        });

    } catch (error) {
        console.error('Update task error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Xóa công việc
export const deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        // Kiểm tra ID công việc
        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Chỉ người tạo công việc mới được xóa
        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        // Xóa công việc
        await task.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('Delete task error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Cập nhật trạng thái công việc
export const updateTaskStatus = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { status } = req.body;

        // Kiểm tra ID công việc
        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Kiểm tra trạng thái hợp lệ
        const allowedStatus = [
            'todo',
            'in_progress',
            'completed'
        ];

        if (
            typeof status !== 'string' ||
            !allowedStatus.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task status'
            });
        }

        // Người tạo hoặc người được giao có thể cập nhật trạng thái
        const task = await Task.findOne({
            _id: taskId,
            $or: [
                { createdBy: req.userId },
                { assigneeIds: req.userId }
            ]
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        // Cập nhật trạng thái
        task.status = status;
        await task.save();

        // Lấy thông tin liên quan
        await task.populate('createdBy', 'fullName email avatarUrl');
        await task.populate('assigneeIds', 'fullName email avatarUrl');
        await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Task status updated successfully',
            task
        });

    } catch (error) {
        console.error('Update task status error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
