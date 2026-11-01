
import mongoose from 'mongoose';
import Task from '../models/Task.js';

// Lấy danh sách công việc
export const getTasks = async (req, res) => {
    try {
        const userId = req.userId;

        // Mặc định chỉ lấy công việc do mình tạo
        // hoặc được giao cho mình
        const filter = {
            $or: [
                { createdBy: userId },
                { assigneeIds: userId }
            ]
        };

        // Lọc theo trạng thái
        if (req.query.status) {
            const allowedStatus = [
                'todo',
                'in_progress',
                'completed'
            ];

            if (!allowedStatus.includes(req.query.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task status'
                });
            }

            filter.status = req.query.status;
        }

        // Lọc theo mức độ ưu tiên
        if (req.query.priority) {
            const allowedPriority = [
                'low',
                'medium',
                'high'
            ];

            if (!allowedPriority.includes(req.query.priority)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task priority'
                });
            }

            filter.priority = req.query.priority;
        }

        const tasks = await Task.find(filter)
            .populate('createdBy', 'fullName email avatarUrl')
            .populate('assigneeIds', 'fullName email avatarUrl')
            .populate('primaryAssigneeId', 'fullName email avatarUrl')
            .sort({ createdAt: -1 });

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
