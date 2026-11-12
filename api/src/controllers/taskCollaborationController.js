
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import TaskShare from '../models/TaskShare.js';
import User from '../models/User.js';

// Hàm kiểm tra ID MongoDB
const isValidId = (id) => {
    return typeof id === 'string' && mongoose.isValidObjectId(id);
};

// Tìm kiếm thành viên để phân công hoặc chia sẻ
export const searchMembers = async (req, res) => {
    try {
        const search = req.query.search;

        if (typeof search !== 'string' || search.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search keyword must contain at least 2 characters'
            });
        }

        const escapedSearch = search.trim().replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const members = await User.find({
            _id: { $ne: req.userId },
            $or: [
                {
                    fullName: {
                        $regex: escapedSearch,
                        $options: 'i'
                    }
                },
                {
                    email: {
                        $regex: escapedSearch,
                        $options: 'i'
                    }
                }
            ]
        })
            .select('fullName email avatarUrl')
            .sort({ fullName: 1 })
            .limit(20);

        return res.status(200).json({
            success: true,
            total: members.length,
            members
        });

    } catch (error) {
        console.error('Search members error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Phân công thành viên cho công việc
export const assignTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { assigneeIds, primaryAssigneeId = null } = req.body;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Danh sách người được giao phải là một mảng
        if (
            !Array.isArray(assigneeIds) ||
            assigneeIds.some(id => !isValidId(id))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignee list'
            });
        }

        // Kiểm tra người phụ trách chính
        if (
            primaryAssigneeId !== null &&
            !isValidId(primaryAssigneeId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid primary assignee ID'
            });
        }

        // Loại bỏ ID trùng lặp
        const uniqueAssigneeIds = [...new Set(assigneeIds)];

        // Người phụ trách chính phải nằm trong danh sách được giao
        if (
            primaryAssigneeId !== null &&
            !uniqueAssigneeIds.includes(primaryAssigneeId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Primary assignee must be in the assignee list'
            });
        }

        // Tìm công việc và xác nhận người thực hiện là Owner
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

        // Không cho phép giao công việc cho chính người tạo
        if (uniqueAssigneeIds.some(
            id => id === String(req.userId)
        )) {
            return res.status(400).json({
                success: false,
                message: 'Task owner cannot be an assignee'
            });
        }

        // Kiểm tra tất cả thành viên có tồn tại không
        const users = await User.find({
            _id: { $in: uniqueAssigneeIds }
        }).select('_id');

        if (users.length !== uniqueAssigneeIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more users do not exist'
            });
        }

        // Không cho một người vừa là Assignee vừa là người được chia sẻ
        const shareConflict = await TaskShare.findOne({
            taskId,
            userId: { $in: uniqueAssigneeIds }
        });

        if (shareConflict) {
            return res.status(409).json({
                success: false,
                message: 'Remove the existing share before assigning this user'
            });
        }

        task.assigneeIds = uniqueAssigneeIds;
        task.primaryAssigneeId = primaryAssigneeId;

        await task.save();

        await task.populate('createdBy', 'fullName email avatarUrl');
        await task.populate('assigneeIds', 'fullName email avatarUrl');
        await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Task assigned successfully',
            task
        });

    } catch (error) {
        console.error('Assign task error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Chia sẻ công việc cho thành viên
export const createTaskShare = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { userId, role } = req.body;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        if (!isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sharing role'
            });
        }

        // Chỉ Owner mới có thể chia sẻ
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

        // Kiểm tra người nhận có tồn tại không
        const user = await User.findById(userId).select('_id');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Không chia sẻ cho chính Owner
        if (String(userId) === String(req.userId)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot share a task with its owner'
            });
        }

        // Người đã được giao không cần thêm quyền chia sẻ
        if (
            task.assigneeIds.some(
                id => String(id) === String(userId)
            )
        ) {
            return res.status(409).json({
                success: false,
                message: 'This user is already assigned to the task'
            });
        }

        // Kiểm tra chia sẻ trùng lặp
        const existingShare = await TaskShare.findOne({
            taskId,
            userId
        });

        if (existingShare) {
            return res.status(409).json({
                success: false,
                message: 'This task has already been shared with this user'
            });
        }

        const share = await TaskShare.create({
            taskId,
            userId,
            role,
            sharedBy: req.userId
        });

        await share.populate('userId', 'fullName email avatarUrl');
        await share.populate('sharedBy', 'fullName email avatarUrl');

        return res.status(201).json({
            success: true,
            message: 'Task shared successfully',
            share
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This task has already been shared with this user'
            });
        }

        console.error('Create task share error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Lấy danh sách người được chia sẻ
export const getTaskShares = async (req, res) => {
    try {
        const taskId = req.params.id;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

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

        const shares = await TaskShare.find({ taskId })
            .populate('userId', 'fullName email avatarUrl')
            .populate('sharedBy', 'fullName email avatarUrl')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: shares.length,
            shares
        });

    } catch (error) {
        console.error('Get task shares error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Thay đổi quyền chia sẻ
export const updateTaskShare = async (req, res) => {
    try {
        const { id: taskId, userId } = req.params;
        const { role } = req.body;

        if (!isValidId(taskId) || !isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or user ID'
            });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sharing role'
            });
        }

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

        const share = await TaskShare.findOne({
            taskId,
            userId
        });

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Share not found'
            });
        }

        share.role = role;
        await share.save();

        await share.populate('userId', 'fullName email avatarUrl');
        await share.populate('sharedBy', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Sharing role updated successfully',
            share
        });

    } catch (error) {
        console.error('Update task share error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Thu hồi quyền chia sẻ
export const deleteTaskShare = async (req, res) => {
    try {
        const { id: taskId, userId } = req.params;

        if (!isValidId(taskId) || !isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or user ID'
            });
        }

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

        const share = await TaskShare.findOneAndDelete({
            taskId,
            userId
        });

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Share not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Task sharing revoked successfully'
        });

    } catch (error) {
        console.error('Delete task share error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
