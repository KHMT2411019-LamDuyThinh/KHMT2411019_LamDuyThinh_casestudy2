
import 'dotenv/config';
import app from './app.js';
import connectDB from './config/database.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server dang chay tai http://localhost:${PORT}`);
    });
};

startServer();
