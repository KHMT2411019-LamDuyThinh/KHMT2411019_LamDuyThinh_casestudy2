
import express from 'express';

import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus
} from '../controllers/taskController.js';

import {
    searchMembers,
    assignTask,
    createTaskShare,
    getTaskShares,
    updateTaskShare,
    deleteTaskShare
} from '../controllers/taskCollaborationController.js';

import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// NHÓM C: PHÂN CÔNG VÀ CHIA SẺ CÔNG VIỆC
// ==========================================

// Tìm kiếm thành viên
// Phải đặt trước router GET '/:id'
router.get('/members', authMiddleware, searchMembers);

// Phân công thành viên cho công việc
router.put('/:id/assignees', authMiddleware, assignTask);

// Chia sẻ công việc
router.post('/:id/shares', authMiddleware, createTaskShare);

// Lấy danh sách người được chia sẻ
router.get('/:id/shares', authMiddleware, getTaskShares);

// Thay đổi quyền chia sẻ
router.patch(
    '/:id/shares/:userId',
    authMiddleware,
    updateTaskShare
);

// Thu hồi quyền chia sẻ
router.delete(
    '/:id/shares/:userId',
    authMiddleware,
    deleteTaskShare
);

// ==========================================
// NHÓM B: QUẢN LÝ CÔNG VIỆC
// ==========================================

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
