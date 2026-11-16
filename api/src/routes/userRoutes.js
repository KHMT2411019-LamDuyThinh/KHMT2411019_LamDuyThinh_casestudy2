
import express from 'express';

import authMiddleware from '../middleware/authMiddleware.js';

import {
    searchMembers
} from '../controllers/taskCollaborationController.js';

import {
    getPublicUser
} from '../controllers/userController.js';

const router = express.Router();

// Tìm người dùng theo tên hoặc email
// Ví dụ: GET /api/users/search?q=Nguyen
// Phải đặt trước /:id
router.get(
    '/search',
    authMiddleware,
    searchMembers
);

// Xem thông tin công khai của người dùng
router.get(
    '/:id',
    authMiddleware,
    getPublicUser
);

export default router;
