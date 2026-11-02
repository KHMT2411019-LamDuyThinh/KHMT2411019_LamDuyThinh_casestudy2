
import express from 'express';

import {
    register,
    login,
    getMe
} from '../controllers/authController.js';

import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Đăng ký
router.post('/register', register);

// Đăng nhập
router.post('/login', login);

// Lấy thông tin người dùng hiện tại
// Bắt buộc phải có JWT hợp lệ
router.get('/me', authMiddleware, getMe);

export default router;
