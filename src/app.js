import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());

app.use(express.json());

// API kiểm tra trạng thái Backend
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Task Manager API is running'
    });
});

// API không tồn tại
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API not found'
    });
});

export default app;