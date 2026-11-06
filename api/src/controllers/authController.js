
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Tạo JWT Token
const generateToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }

    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// API đăng ký tài khoản
export const register = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        // Kiểm tra dữ liệu đầu vào
        if (
            typeof fullName !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please provide full name, email and password'
            });
        }

        const cleanName = fullName.trim();
        const cleanEmail = email.trim().toLowerCase();

        // Kiểm tra họ tên và email
        if (
            cleanName.length < 2 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Full name or email is invalid'
            });
        }

        // Kiểm tra mật khẩu
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least 8 characters'
            });
        }

        // Kiểm tra cấu hình JWT trước khi tạo tài khoản
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'JWT_SECRET is not configured'
            });
        }

        // Kiểm tra email đã tồn tại
        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Tạo tài khoản mới
        // User.js sẽ tự động mã hóa passwordHash trước khi lưu
        const user = await User.create({
            fullName: cleanName,
            email: cleanEmail,
            passwordHash: password
        });

        const token = generateToken(user._id);

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatarUrl: user.avatarUrl
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        console.error('Register error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// API đăng nhập
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Kiểm tra dữ liệu đầu vào
        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Kiểm tra cấu hình JWT
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'JWT_SECRET is not configured'
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Lấy passwordHash vì trường này mặc định bị ẩn trong User.js
        const user = await User.findOne({
            email: cleanEmail
        }).select('+passwordHash');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Kiểm tra mật khẩu
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatarUrl: user.avatarUrl
            }
        });

    } catch (error) {
        console.error('Login error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// API lấy thông tin người dùng hiện tại
export const getMe = async (req, res) => {
    try {
        const user = req.user;

        return res.status(200).json({
            success: true,
            message: 'Get current user successfully',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatarUrl: user.avatarUrl
            }
        });

    } catch (error) {
        console.error('Get current user error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
// API cập nhật thông tin người dùng hiện tại
export const updateMe = async (req, res) => {
    try {
        const { fullName, avatarUrl } = req.body;
        const updates = {};

        // Kiểm tra và cập nhật họ tên
        if (fullName !== undefined) {
            if (typeof fullName !== 'string' || fullName.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name must contain at least 2 characters'
                });
            }

            updates.fullName = fullName.trim();
        }

        // Cập nhật ảnh đại diện nếu có
        if (avatarUrl !== undefined) {
            if (typeof avatarUrl !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Avatar URL is invalid'
                });
            }

            updates.avatarUrl = avatarUrl.trim();
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No profile information to update'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatarUrl: user.avatarUrl
            }
        });
    } catch (error) {
        console.error('Update profile error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
// API đổi mật khẩu
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (
            typeof currentPassword !== 'string' ||
            typeof newPassword !== 'string' ||
            !currentPassword ||
            !newPassword
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must contain at least 8 characters'
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Lấy cả passwordHash để kiểm tra mật khẩu hiện tại
        const user = await User.findById(req.userId)
            .select('+passwordHash');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Xác minh mật khẩu hiện tại
        const isPasswordValid = await user.comparePassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Gán mật khẩu mới và lưu.
        // User.js sẽ tự động băm mật khẩu trước khi lưu.
        user.passwordHash = newPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
