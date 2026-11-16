
import express from 'express';

import authMiddleware from '../middleware/authMiddleware.js';

import {
    getTaskEmailLogs,
    retryEmailLog
} from '../controllers/emailLogController.js';

const router = express.Router();

// Lấy lịch sử gửi Email của công việc
router.get(
    '/tasks/:id/email-logs',
    authMiddleware,
    getTaskEmailLogs
);

// Thử gửi lại Email thất bại
router.post(
    '/email-logs/:id/retry',
    authMiddleware,
    retryEmailLog
);

export default router;
