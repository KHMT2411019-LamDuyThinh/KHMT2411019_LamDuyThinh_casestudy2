
import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';
import Task from '../models/Task.js';
import { getTaskAccess } from '../services/taskAccessService.js';
import { retryNotificationEmail } from '../services/emailService.js';

// Loại bỏ nội dung Email khi trả dữ liệu ra API
const sanitizeEmailLog = (emailLog) => {
    const data = emailLog.toObject
        ? emailLog.toObject()
        : { ...emailLog };

    delete data.textContent;
    delete data.htmlContent;

    return data;
};

// Lấy lịch sử gửi Email của một công việc
export const getTaskEmailLogs = async (req, res) => {
    try {
        const taskId = req.params.id;

        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Chỉ Owner được xem lịch sử Email
        const access = await getTaskAccess(task, req.userId);

        if (!access.canManageCollaboration) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view email logs'
            });
        }

        const page = Math.max(
            1,
            Number.parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            50,
            Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
        );

        const skip = (page - 1) * limit;

        const filter = {
            taskId: task._id
        };

        const [emailLogs, total] = await Promise.all([
            EmailLog.find(filter)
                .select('-textContent -htmlContent')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),

            EmailLog.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Get email logs successfully',
            data: {
                emailLogs: emailLogs.map(sanitizeEmailLog),
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get task email logs error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve email logs'
        });
    }
};

// Thử gửi lại Email thất bại
export const retryEmailLog = async (req, res) => {
    try {
        const emailLogId = req.params.id;

        if (!mongoose.isValidObjectId(emailLogId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email log ID'
            });
        }

        const emailLog = await EmailLog.findById(emailLogId);

        if (!emailLog) {
            return res.status(404).json({
                success: false,
                message: 'Email log not found'
            });
        }

        if (!emailLog.taskId) {
            return res.status(400).json({
                success: false,
                message: 'This email is not linked to a task'
            });
        }

        const task = await Task.findById(emailLog.taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Related task not found'
            });
        }

        // Chỉ Owner được thử gửi lại Email
        const access = await getTaskAccess(task, req.userId);

        if (!access.canManageCollaboration) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to retry this email'
            });
        }

        if (emailLog.status !== 'failed') {
            return res.status(409).json({
                success: false,
                message: 'Only failed emails can be retried'
            });
        }

        const result = await retryNotificationEmail(emailLogId);

        const updatedLog = await EmailLog.findById(emailLogId);

        if (!result.success) {
            const statusCode = result.reason === 'not_available'
                ? 409
                : result.reason === 'missing_content'
                    ? 409
                    : 502;

            return res.status(statusCode).json({
                success: false,
                message: result.errorMessage || 'Email retry failed',
                data: updatedLog
                    ? sanitizeEmailLog(updatedLog)
                    : null
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            data: updatedLog
                ? sanitizeEmailLog(updatedLog)
                : null
        });

    } catch (error) {
        console.error('Retry email log error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retry email'
        });
    }
};
