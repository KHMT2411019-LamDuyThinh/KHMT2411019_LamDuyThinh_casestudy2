
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
    // Kiểm tra Header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access token is required'
        });
    }

    const token = authHeader.split(' ')[1];

    // Kiểm tra cấu hình JWT
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: 'JWT_SECRET is not configured'
        });
    }

    let decoded;

    // Xác minh JWT
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }

    // Kiểm tra người dùng còn tồn tại
    try {
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User account no longer exists'
            });
        }

        req.user = user;
        req.userId = user._id;

        next();

    } catch (error) {
        console.error('Authentication error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

export default authMiddleware;
