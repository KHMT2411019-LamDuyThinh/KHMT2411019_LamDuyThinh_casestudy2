
import express from 'express';

import {
    getTasks,
    getTaskById
} from '../controllers/taskController.js';

import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Lấy danh sách công việc
// Yêu cầu JWT hợp lệ
router.get('/', authMiddleware, getTasks);

// Xem chi tiết công việc
// Yêu cầu JWT hợp lệ
router.get('/:id', authMiddleware, getTaskById);

export default router;
