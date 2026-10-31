
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Kiểm tra trạng thái API
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Task Manager API is running'
    });
});

// API đăng ký và đăng nhập
app.use('/api/auth', authRoutes);

// Xử lý đường dẫn không tồn tại
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API not found'
    });
});

export default app;
