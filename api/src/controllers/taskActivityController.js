
import mongoose from 'mongoose';

import Task from '../models/Task.js';
import TaskActivity from '../models/TaskActivity.js';
import { getTaskAccess } from '../services/taskAccessService.js';

// ==========================================
// GET /tasks/:id/activities
// LẤY LỊCH SỬ HOẠT ĐỘNG CÔNG VIỆC
// ==========================================

export const getTaskActivities = async (req, res) => {
    try {
        const { id } = req.params;

        // Kiểm tra Task ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Kiểm tra công việc tồn tại
        const task = await Task.findById(id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Kiểm tra quyền truy cập
        const access = await getTaskAccess(task, req.userId);

        if (!access.canView) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        // Phân trang
        const page = Number.parseInt(req.query.page || '1', 10);
        const requestedLimit = Number.parseInt(
            req.query.limit || '20',
            10
        );

        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(requestedLimit) ||
            requestedLimit < 1
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pagination parameters'
            });
        }

        const limit = Math.min(requestedLimit, 100);
        const skip = (page - 1) * limit;

        const filter = {
            taskId: task._id
        };

        const [total, activities] = await Promise.all([
            TaskActivity.countDocuments(filter),

            TaskActivity.find(filter)
                .populate(
                    'userId',
                    'fullName email avatarUrl'
                )
                .sort({
                    createdAt: -1,
                    _id: -1
                })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            message: 'Get task activities successfully',
            data: {
                taskId: task._id,
                taskTitle: task.title,
                activities,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get task activities error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve task activities'
        });
    }
};
