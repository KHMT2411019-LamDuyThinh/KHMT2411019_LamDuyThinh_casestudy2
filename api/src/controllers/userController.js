
import mongoose from 'mongoose';
import User from '../models/User.js';

// ==========================================
// GET /users/:id
// XEM THÔNG TIN CÔNG KHAI CỦA NGƯỜI DÙNG
// ==========================================

export const getPublicUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Chỉ lấy các trường được phép công khai
        const user = await User.findById(id)
            .select('fullName email avatarUrl createdAt');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get public user error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve user'
        });
    }
};
