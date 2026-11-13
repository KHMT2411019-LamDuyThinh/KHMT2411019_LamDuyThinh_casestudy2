
import mongoose from 'mongoose';

const taskShareSchema = new mongoose.Schema(
    {
        // Công việc được chia sẻ
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            required: true
        },

        // Người nhận quyền chia sẻ
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Quyền được cấp
        role: {
            type: String,
            enum: ['viewer', 'editor'],
            default: 'viewer',
            required: true
        },

        // Người thực hiện chia sẻ
        sharedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true,
        collection: 'task_shares'
    }
);

// Mỗi người chỉ có một bản ghi chia sẻ trên một công việc
taskShareSchema.index(
    { taskId: 1, userId: 1 },
    { unique: true }
);

const TaskShare = mongoose.model('TaskShare', taskShareSchema);

export default TaskShare;
