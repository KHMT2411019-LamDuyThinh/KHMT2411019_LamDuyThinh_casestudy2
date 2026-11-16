
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
    getTaskAssignees,
    addTaskAssignees,
    assignTask,
    updateTaskAssignee,
    removeTaskAssignee,
    createTaskShare,
    getTaskShares,
    updateTaskShare,
    deleteTaskShare
} from '../controllers/taskCollaborationController.js';

import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// TÌM KIẾM THÀNH VIÊN – TƯƠNG THÍCH API CŨ
// ==========================================

router.get('/members', authMiddleware, searchMembers);

// ==========================================
// NHÓM C: GIAO VIỆC
// ==========================================

// Lấy danh sách người được giao
router.get(
    '/:id/assignees',
    authMiddleware,
    getTaskAssignees
);

// Giao thêm một hoặc nhiều người
router.post(
    '/:id/assignees',
    authMiddleware,
    addTaskAssignees
);

// Cập nhật người phụ trách chính
router.patch(
    '/:id/assignees/:userId',
    authMiddleware,
    updateTaskAssignee
);

// Hủy giao việc cho một người
router.delete(
    '/:id/assignees/:userId',
    authMiddleware,
    removeTaskAssignee
);

// API cũ: cập nhật toàn bộ danh sách Assignee
router.put(
    '/:id/assignees',
    authMiddleware,
    assignTask
);

// ==========================================
// NHÓM C: CHIA SẺ VÀ PHÂN QUYỀN
// ==========================================

// Lấy danh sách chia sẻ
router.get(
    '/:id/shares',
    authMiddleware,
    getTaskShares
);

// Chia sẻ cho một người
router.post(
    '/:id/shares',
    authMiddleware,
    createTaskShare
);

// Thay đổi quyền viewer/editor
router.patch(
    '/:id/shares/:shareId',
    authMiddleware,
    updateTaskShare
);

// Thu hồi quyền chia sẻ
router.delete(
    '/:id/shares/:shareId',
    authMiddleware,
    deleteTaskShare
);

// ==========================================
// NHÓM B: QUẢN LÝ CÔNG VIỆC
// ==========================================

// Lấy danh sách công việc
router.get('/', authMiddleware, getTasks);

// Tạo công việc
router.post('/', authMiddleware, createTask);

// Cập nhật trạng thái
router.patch(
    '/:id/status',
    authMiddleware,
    updateTaskStatus
);

// Chỉnh sửa công việc
router.put('/:id', authMiddleware, updateTask);

// Xóa công việc
router.delete('/:id', authMiddleware, deleteTask);

// Xem chi tiết công việc
router.get('/:id', authMiddleware, getTaskById);

export default router;
