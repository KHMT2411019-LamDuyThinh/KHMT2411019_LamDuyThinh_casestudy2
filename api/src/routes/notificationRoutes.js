
import express from 'express';

import authMiddleware from '../middleware/authMiddleware.js';

import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

// Lấy danh sách thông báo
router.get('/', authMiddleware, getNotifications);

// Đánh dấu tất cả thông báo đã đọc
router.patch('/read-all', authMiddleware, markAllNotificationsAsRead);

// Đánh dấu một thông báo đã đọc
router.patch('/:id/read', authMiddleware, markNotificationAsRead);

export default router;
