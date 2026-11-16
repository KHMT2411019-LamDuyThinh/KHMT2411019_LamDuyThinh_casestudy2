
import 'dotenv/config';

import app from './app.js';
import connectDB from './config/database.js';

import {
    startTaskReminderScheduler,
    stopTaskReminderScheduler
} from './services/taskReminderService.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Kết nối MongoDB trước
        await connectDB();

        // Khởi động hệ thống nhắc hạn
        await startTaskReminderScheduler();

        // Khởi động Express
        const server = app.listen(PORT, () => {
            console.log(
                `Server dang chay tai http://localhost:${PORT}`
            );
        });

        // Dừng scheduler khi server tắt
        const shutdown = () => {
            console.log('Server is shutting down...');

            stopTaskReminderScheduler();

            server.close(() => {
                process.exit(0);
            });
        };

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);

    } catch (error) {
        console.error(
            'Start server error:',
            error.message
        );

        process.exit(1);
    }
};

startServer();
