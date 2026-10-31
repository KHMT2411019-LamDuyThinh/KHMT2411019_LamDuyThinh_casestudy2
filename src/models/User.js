
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        },

        avatarUrl: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

// Mã hóa mật khẩu trước khi lưu vào MongoDB
userSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) {
        return;
    }

    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

// Kiểm tra mật khẩu đăng nhập
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.passwordHash);
};

// Không trả passwordHash ra dữ liệu JSON
userSchema.set('toJSON', {
    transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);

export default User;
