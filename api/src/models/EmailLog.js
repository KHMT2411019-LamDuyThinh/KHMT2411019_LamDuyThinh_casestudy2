
import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
    {
        // Email của người nhận
        recipientEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        // Tài khoản người nhận
        recipientUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        // Công việc liên quan
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null
        },

        // Loại sự kiện gửi Email
        eventType: {
            type: String,
            enum: [
                'task_assigned',
                'task_unassigned',
                'task_shared',
                'task_share_removed',
                'task_share_role_updated',
                'task_status_changed'
            ],
            required: true
        },

        // Tiêu đề Email
        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },

        // Trạng thái gửi Email
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending'
        },

        // Mã Email do SMTP trả về
        messageId: {
            type: String,
            default: ''
        },

        // Nội dung lỗi nếu gửi thất bại
        errorMessage: {
            type: String,
            default: ''
        },

        // Thời điểm gửi thành công
        sentAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'email_logs'
    }
);

// Tối ưu truy vấn lịch sử Email theo người nhận
emailLogSchema.index({
    recipientUserId: 1,
    createdAt: -1
});

// Tối ưu truy vấn lịch sử Email theo công việc
emailLogSchema.index({
    taskId: 1,
    createdAt: -1
});

// Tối ưu truy vấn theo trạng thái gửi
emailLogSchema.index({
    status: 1,
    createdAt: -1
});

const EmailLog = mongoose.model('EmailLog', emailLogSchema);

export default EmailLog;
