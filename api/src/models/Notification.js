
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        // Người nhận thông báo
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Người thực hiện hành động
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        // Công việc liên quan đến thông báo
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null
        },

        // Loại thông báo
        type: {
            type: String,
            enum: [
                'task_assigned',
                'task_unassigned',
                'task_shared',
                'task_share_removed',
                'task_share_role_updated',
                'task_updated',
                'task_status_changed'
            ],
            required: true
        },

        // Tiêu đề thông báo
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },

        // Nội dung thông báo
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500
        },

        // Trạng thái đã đọc
        isRead: {
            type: Boolean,
            default: false
        },

        // Thời điểm đọc thông báo
        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'notifications'
    }
);

// Tối ưu truy vấn thông báo theo người nhận,
// trạng thái đọc và thời gian tạo
notificationSchema.index({
    userId: 1,
    isRead: 1,
    createdAt: -1
});

const Notification = mongoose.model(
    'Notification',
    notificationSchema
);

export default Notification;
