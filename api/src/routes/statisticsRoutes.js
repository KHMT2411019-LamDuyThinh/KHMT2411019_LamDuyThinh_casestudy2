
import express from 'express';

import authMiddleware from '../middleware/authMiddleware.js';

import {
    getTaskStatistics,
    getAssignmentStatistics,
    getDeadlineStatistics
} from '../controllers/statisticsController.js';

const router = express.Router();

// Thống kê công việc theo trạng thái
router.get(
    '/tasks',
    authMiddleware,
    getTaskStatistics
);

// Thống kê giao việc và người phụ trách
router.get(
    '/assignments',
    authMiddleware,
    getAssignmentStatistics
);

// Thống kê công việc sắp đến hạn và quá hạn
router.get(
    '/deadlines',
    authMiddleware,
    getDeadlineStatistics
);

export default router;
