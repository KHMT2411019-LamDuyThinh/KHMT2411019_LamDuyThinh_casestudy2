
import mongoose from 'mongoose';

const taskActivitySchema = new mongoose.Schema(
    {
        // Công việc liên quan đến hoạt động
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            required: true
        },

        // Người thực hiện hoạt động
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Loại hoạt động
        action: {
            type: String,
            enum: [
                'task_created',
                'task_updated',
                'task_deleted',
                'task_status_changed',
                'assignees_added',
                'assignees_removed',
                'primary_assignee_changed',
                'task_shared',
                'task_share_role_updated',
                'task_share_removed'
            ],
            required: true
        },

        // Tên công việc tại thời điểm ghi nhận
        taskTitle: {
            type: String,
            default: '',
            trim: true
        },

        // Chi tiết hoạt động, tùy theo từng loại sự kiện
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({})
        }
    },
    {
        timestamps: true,
        collection: 'task_activities'
    }
);

// Truy vấn lịch sử của một công việc theo thời gian
taskActivitySchema.index({
    taskId: 1,
    createdAt: -1
});

// Truy vấn lịch sử theo người thực hiện
taskActivitySchema.index({
    userId: 1,
    createdAt: -1
});

const TaskActivity = mongoose.model(
    'TaskActivity',
    taskActivitySchema
);

export default TaskActivity;
