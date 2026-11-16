
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

// Lấy danh sách thông báo của người dùng hiện tại
export const getNotifications = async (req, res) => {
    try {
        const userId = req.userId;

        const page = Math.max(
            1,
            Number.parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            50,
            Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
        );

        const skip = (page - 1) * limit;

        const filter = { userId };

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .populate('actorId', 'fullName avatarUrl')
                .populate('taskId', 'title')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),

            Notification.countDocuments(filter),

            Notification.countDocuments({
                userId,
                isRead: false
            })
        ]);

        return res.status(200).json({
            success: true,
            data: {
                notifications,
                total,
                unreadCount,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve notifications'
        });
    }
};

// Lấy số lượng thông báo chưa đọc của người dùng hiện tại
export const getUnreadNotificationCount = async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({
            userId: req.userId,
            isRead: false
        });

        return res.status(200).json({
            success: true,
            data: {
                unreadCount
            }
        });
    } catch (error) {
        console.error('Get unread notification count error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve unread notification count'
        });
    }
};

// Đánh dấu một thông báo đã đọc
export const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
        }

        const notification = await Notification.findOne({
            _id: id,
            userId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (!notification.isRead) {
            notification.isRead = true;
            notification.readAt = new Date();

            await notification.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: notification
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update notification'
        });
    }
};

// Đánh dấu tất cả thông báo đã đọc
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.userId;

        const result = await Notification.updateMany(
            {
                userId,
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
            data: {
                modifiedCount: result.modifiedCount
            }
        });
    } catch (error) {
        console.error('Mark all notifications as read error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update notifications'
        });
    }
};
