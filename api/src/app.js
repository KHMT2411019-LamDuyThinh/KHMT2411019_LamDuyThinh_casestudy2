
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import emailLogRoutes from './routes/emailLogRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// KIỂM TRA TRẠNG THÁI API
// ==========================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Task Manager API is running'
    });
});

// ==========================================
// NHÓM A: XÁC THỰC
// ==========================================

app.use('/api/auth', authRoutes);

// ==========================================
// NHÓM C: NGƯỜI DÙNG, GIAO VIỆC, CHIA SẺ
// ==========================================

app.use('/api/users', userRoutes);

// ==========================================
// NHÓM D: LỊCH SỬ EMAIL VÀ THỬ GỬI LẠI
// Phải đăng ký trước taskRoutes
// ==========================================

app.use('/api', emailLogRoutes);

// ==========================================
// NHÓM B VÀ C: QUẢN LÝ CÔNG VIỆC
// ==========================================

app.use('/api/tasks', taskRoutes);

// ==========================================
// NHÓM D: THÔNG BÁO
// ==========================================

app.use('/api/notifications', notificationRoutes);

// ==========================================
// XỬ LÝ ĐƯỜNG DẪN KHÔNG TỒN TẠI
// ==========================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API not found'
    });
});

export default app;
