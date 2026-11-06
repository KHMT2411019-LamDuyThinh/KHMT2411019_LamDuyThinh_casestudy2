
import express from 'express';

import {
    register,
    login,
    getMe,
    updateMe,
    changePassword
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
// Cập nhật thông tin cá nhân
router.put('/me', authMiddleware, updateMe);
// Đổi mật khẩu
router.put('/change-password', authMiddleware, changePassword);

export default router;
