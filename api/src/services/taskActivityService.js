
import TaskActivity from '../models/TaskActivity.js';

// Ghi nhận một hoạt động của công việc
export const recordTaskActivity = async ({
    taskId,
    userId,
    action,
    taskTitle = '',
    details = {}
}) => {
    try {
        if (!taskId || !userId || !action) {
            throw new Error(
                'Task activity information is incomplete'
            );
        }

        const activity = await TaskActivity.create({
            taskId,
            userId,
            action,
            taskTitle,
            details
        });

        return {
            success: true,
            activity
        };

    } catch (error) {
        // Không làm gián đoạn thao tác nghiệp vụ chính
        // nếu việc ghi lịch sử gặp lỗi.
        console.error(
            'Record task activity error:',
            error.message
        );

        return {
            success: false,
            errorMessage: error.message
        };
    }
};
