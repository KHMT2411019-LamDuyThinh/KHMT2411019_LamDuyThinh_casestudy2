
import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
    {
        recipientEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        recipientUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null
        },

        eventType: {
            type: String,
            enum: [
                'task_assigned',
                'task_unassigned',
                'task_shared',
                'task_share_removed',
                'task_share_role_updated',
                'task_status_changed',
                'task_updated',
                'task_due_reminder'
            ],
            required: true
        },

        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },

        // Nội dung văn bản để hỗ trợ gửi lại Email
        textContent: {
            type: String,
            default: ''
        },

        // Nội dung HTML để hỗ trợ gửi lại Email
        htmlContent: {
            type: String,
            default: ''
        },

        // Hạn công việc tương ứng với lần nhắc
        reminderForDueDate: {
            type: Date,
            default: null
        },

        // Tổng số lần thử gửi Email
        attempts: {
            type: Number,
            default: 0,
            min: 0
        },

        // Mã khóa khi một tiến trình đang gửi Email
        deliveryLockId: {
            type: String,
            default: ''
        },

        // Thời điểm bắt đầu khóa gửi Email
        deliveryLockedAt: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending'
        },

        messageId: {
            type: String,
            default: ''
        },

        errorMessage: {
            type: String,
            default: ''
        },

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

// Truy vấn lịch sử theo người nhận
emailLogSchema.index({
    recipientUserId: 1,
    createdAt: -1
});

// Truy vấn lịch sử theo công việc
emailLogSchema.index({
    taskId: 1,
    createdAt: -1
});

// Truy vấn theo trạng thái
emailLogSchema.index({
    status: 1,
    createdAt: -1
});

// Chống gửi nhắc hạn trùng:
// mỗi người chỉ có một bản ghi cho một công việc và một hạn cụ thể
emailLogSchema.index(
    {
        taskId: 1,
        recipientUserId: 1,
        reminderForDueDate: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            eventType: 'task_due_reminder'
        },
        name: 'unique_task_due_reminder_per_recipient'
    }
);

const EmailLog = mongoose.model(
    'EmailLog',
    emailLogSchema
);

export default EmailLog;
