
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import TaskShare from '../models/TaskShare.js';

// Lấy ID người dùng đang đăng nhập
const getCurrentUserId = (req) => {
    const userId = req.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
        return null;
    }

    return new mongoose.Types.ObjectId(userId);
};

// Xác định toàn bộ công việc người dùng có quyền truy cập
const getAccessibleTaskFilter = async (userId) => {
    const sharedTaskIds = await TaskShare.distinct(
        'taskId',
        { userId }
    );

    return {
        $or: [
            { createdBy: userId },
            { assigneeIds: userId },
            { _id: { $in: sharedTaskIds } }
        ]
    };
};

// ==========================================
// 1. THỐNG KÊ CÔNG VIỆC THEO TRẠNG THÁI
// GET /api/statistics/tasks
// ==========================================

export const getTaskStatistics = async (req, res) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const taskFilter = await getAccessibleTaskFilter(userId);

        const [totalTasks, statusResults] = await Promise.all([
            Task.countDocuments(taskFilter),

            Task.aggregate([
                { $match: taskFilter },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const statusCounts = {
            todo: 0,
            in_progress: 0,
            completed: 0
        };

        statusResults.forEach((item) => {
            if (Object.prototype.hasOwnProperty.call(
                statusCounts,
                item._id
            )) {
                statusCounts[item._id] = item.count;
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                totalTasks,
                statusCounts
            }
        });

    } catch (error) {
        console.error('Get task statistics error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to get task statistics'
        });
    }
};

// ==========================================
// 2. THỐNG KÊ GIAO VIỆC VÀ PHỤ TRÁCH
// GET /api/statistics/assignments
// ==========================================

export const getAssignmentStatistics = async (req, res) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const [
            totalCreatedByMe,
            totalAssignedToMe,
            totalPrimaryResponsible,
            totalSharedWithMe
        ] = await Promise.all([
            // Công việc do tôi tạo
            Task.countDocuments({
                createdBy: userId
            }),

            // Công việc có tôi trong danh sách Assignee
            Task.countDocuments({
                assigneeIds: userId
            }),

            // Công việc tôi là người phụ trách chính
            Task.countDocuments({
                primaryAssigneeId: userId
            }),

            // Công việc được chia sẻ cho tôi
            TaskShare.countDocuments({
                userId
            })
        ]);

        return res.status(200).json({
            success: true,
            data: {
                totalCreatedByMe,
                totalAssignedToMe,
                totalPrimaryResponsible,
                totalSharedWithMe
            }
        });

    } catch (error) {
        console.error('Get assignment statistics error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to get assignment statistics'
        });
    }
};

// ==========================================
// 3. THỐNG KÊ CÔNG VIỆC THEO HẠN HOÀN THÀNH
// GET /api/statistics/deadlines?days=7
// ==========================================

export const getDeadlineStatistics = async (req, res) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Mặc định xem công việc trong 7 ngày tới.
        // Giới hạn khoảng thời gian từ 1 đến 30 ngày.
        const requestedDays = Number.parseInt(req.query.days, 10);

        const days = Number.isNaN(requestedDays)
            ? 7
            : Math.min(30, Math.max(1, requestedDays));

        const taskFilter = await getAccessibleTaskFilter(userId);

        // Đầu ngày hiện tại
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Ngày kết thúc không bao gồm (ví dụ days = 7)
        const endDate = new Date(startOfToday);
        endDate.setDate(endDate.getDate() + days);

        // Chỉ thống kê công việc chưa hoàn thành
        const activeTaskFilter = {
            $and: [
                taskFilter,
                { status: { $ne: 'completed' } },
                { dueDate: { $ne: null } }
            ]
        };

        // Công việc đã quá hạn
        const overdueFilter = {
            $and: [
                activeTaskFilter,
                { dueDate: { $lt: startOfToday } }
            ]
        };

        // Công việc sắp đến hạn trong khoảng ngày yêu cầu
        const upcomingFilter = {
            $and: [
                activeTaskFilter,
                {
                    dueDate: {
                        $gte: startOfToday,
                        $lt: endDate
                    }
                }
            ]
        };

        const populateTaskFields = (query) => query
            .select(
                'title dueDate priority status createdBy assigneeIds primaryAssigneeId'
            )
            .populate('createdBy', 'fullName')
            .populate('assigneeIds', 'fullName')
            .populate('primaryAssigneeId', 'fullName')
            .sort({ dueDate: 1 })
            .limit(100)
            .lean();

        const [
            overdueCount,
            upcomingCount,
            overdueTasks,
            upcomingTasks
        ] = await Promise.all([
            Task.countDocuments(overdueFilter),
            Task.countDocuments(upcomingFilter),
            populateTaskFields(Task.find(overdueFilter)),
            populateTaskFields(Task.find(upcomingFilter))
        ]);

        return res.status(200).json({
            success: true,
            data: {
                days,
                overdueCount,
                upcomingCount,
                overdueTasks,
                upcomingTasks
            }
        });

    } catch (error) {
        console.error('Get deadline statistics error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to get deadline statistics'
        });
    }
};
