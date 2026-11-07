
import express from 'express';

import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus
} from '../controllers/taskController.js';

import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Lấy danh sách công việc
// Hỗ trợ tìm kiếm, lọc và sắp xếp
router.get('/', authMiddleware, getTasks);

// Tạo công việc mới
router.post('/', authMiddleware, createTask);

// Cập nhật trạng thái công việc
router.patch('/:id/status', authMiddleware, updateTaskStatus);

// Chỉnh sửa thông tin công việc
router.put('/:id', authMiddleware, updateTask);

// Xóa công việc
router.delete('/:id', authMiddleware, deleteTask);

// Xem chi tiết công việc
router.get('/:id', authMiddleware, getTaskById);

export default router;
