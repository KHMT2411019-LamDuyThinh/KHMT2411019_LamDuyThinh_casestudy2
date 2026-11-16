
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

import {
    getTaskActivities
} from '../controllers/taskActivityController.js';

import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// TÌM KIẾM THÀNH VIÊN
// ==========================================

router.get('/members', authMiddleware, searchMembers);

// ==========================================
// NHÓM E: LỊCH SỬ HOẠT ĐỘNG
// ==========================================

router.get(
    '/:id/activities',
    authMiddleware,
    getTaskActivities
);

// ==========================================
// NHÓM C: GIAO VIỆC
// ==========================================

router.get(
    '/:id/assignees',
    authMiddleware,
    getTaskAssignees
);

router.post(
    '/:id/assignees',
    authMiddleware,
    addTaskAssignees
);

router.patch(
    '/:id/assignees/:userId',
    authMiddleware,
    updateTaskAssignee
);

router.delete(
    '/:id/assignees/:userId',
    authMiddleware,
    removeTaskAssignee
);

router.put(
    '/:id/assignees',
    authMiddleware,
    assignTask
);

// ==========================================
// NHÓM C: CHIA SẺ VÀ PHÂN QUYỀN
// ==========================================

router.get(
    '/:id/shares',
    authMiddleware,
    getTaskShares
);

router.post(
    '/:id/shares',
    authMiddleware,
    createTaskShare
);

router.patch(
    '/:id/shares/:shareId',
    authMiddleware,
    updateTaskShare
);

router.delete(
    '/:id/shares/:shareId',
    authMiddleware,
    deleteTaskShare
);

// ==========================================
// NHÓM B: QUẢN LÝ CÔNG VIỆC
// ==========================================

router.get('/', authMiddleware, getTasks);

router.post('/', authMiddleware, createTask);

router.patch(
    '/:id/status',
    authMiddleware,
    updateTaskStatus
);

router.put('/:id', authMiddleware, updateTask);

router.delete('/:id', authMiddleware, deleteTask);

// Luôn đặt route động tổng quát ở cuối
router.get('/:id', authMiddleware, getTaskById);

export default router;
