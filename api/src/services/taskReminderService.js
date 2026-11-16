
import Task from '../models/Task.js';
import TaskShare from '../models/TaskShare.js';
import User from '../models/User.js';
import EmailLog from '../models/EmailLog.js';
import { sendNotificationEmail } from './emailService.js';

let schedulerTimer = null;
let isCheckingReminders = false;

// Chuyển ObjectId thành chuỗi
const normalizeId = (value) => {
    if (!value) return null;

    return String(value._id ?? value);
};

// Định dạng hạn hoàn thành theo giờ Việt Nam
const formatDueDate = (date) => {
    return new Date(date).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short'
    });
};

// Kiểm tra và gửi email nhắc hạn
export const checkUpcomingTaskDeadlines = async () => {
    if (isCheckingReminders) {
        return;
    }

    isCheckingReminders = true;

    try {
        const reminderHours = Number(
            process.env.TASK_REMINDER_HOURS_BEFORE || 24
        );

        if (
            !Number.isFinite(reminderHours) ||
            reminderHours <= 0
        ) {
            throw new Error('Invalid task reminder hours');
        }

        const now = new Date();

        const reminderLimit = new Date(
            now.getTime() + reminderHours * 60 * 60 * 1000
        );

        // Lấy công việc chưa hoàn thành, có hạn trong khoảng nhắc
        const tasks = await Task.find({
            dueDate: {
                $gt: now,
                $lte: reminderLimit
            },
            status: {
                $ne: 'completed'
            }
        }).select(
            '_id title dueDate createdBy assigneeIds status'
        );

        if (tasks.length === 0) {
            return;
        }

        for (const task of tasks) {
            try {
                // Lấy danh sách người được chia sẻ
                const shares = await TaskShare.find({
                    taskId: task._id
                }).select('userId');

                // Gộp người tạo, người được giao và người được chia sẻ
                const recipientIds = [
                    task.createdBy,
                    ...(task.assigneeIds || []),
                    ...shares.map(share => share.userId)
                ]
                    .map(normalizeId)
                    .filter(Boolean);

                // Loại bỏ người bị trùng vai trò
                const uniqueRecipientIds = [
                    ...new Set(recipientIds)
                ];

                if (uniqueRecipientIds.length === 0) {
                    continue;
                }

                // Lấy thông tin Email của người nhận
                const recipients = await User.find({
                    _id: {
                        $in: uniqueRecipientIds
                    }
                }).select('_id fullName email');

                for (const recipient of recipients) {
                    if (!recipient.email) {
                        continue;
                    }

                    try {
                        const recipientName =
                            recipient.fullName || 'bạn';

                        const subject =
                            `Nhắc hạn công việc: ${task.title}`;

                        const text = `Xin chào ${recipientName},

Đây là thông báo nhắc hạn tự động từ Task Manager.

Công việc: ${task.title}
Hạn hoàn thành: ${formatDueDate(task.dueDate)}
Trạng thái: ${task.status}

Công việc đang đến gần thời hạn hoàn thành.
Vui lòng đăng nhập vào Task Manager để kiểm tra và cập nhật tiến độ.

Trân trọng,
Task Manager`;

                        const result = await sendNotificationEmail({
                            recipientEmail: recipient.email,
                            recipientUserId: recipient._id,
                            taskId: task._id,
                            eventType: 'task_due_reminder',
                            subject,
                            text,
                            reminderForDueDate: task.dueDate
                        });

                        if (result.duplicate) {
                            // Đã có bản ghi cho cùng người và cùng hạn
                            continue;
                        }

                        if (!result.success) {
                            console.error(
                                `Task reminder failed for ${recipient.email}:`,
                                result.errorMessage
                            );
                        } else {
                            console.log(
                                `Task reminder sent: ${recipient.email} - ${task.title}`
                            );
                        }

                    } catch (emailError) {
                        console.error(
                            `Task reminder error for ${recipient.email}:`,
                            emailError.message
                        );
                    }
                }
            } catch (taskError) {
                console.error(
                    `Process reminder for task ${task._id} error:`,
                    taskError.message
                );
            }
        }

    } catch (error) {
        console.error(
            'Check upcoming task deadlines error:',
            error.message
        );
    } finally {
        isCheckingReminders = false;
    }
};

// Khởi động bộ lập lịch nhắc hạn
export const startTaskReminderScheduler = async () => {
    if (schedulerTimer) {
        return schedulerTimer;
    }

    const intervalMs = Number(
        process.env.TASK_REMINDER_INTERVAL_MS || 60000
    );

    if (
        !Number.isInteger(intervalMs) ||
        intervalMs < 10000
    ) {
        throw new Error(
            'TASK_REMINDER_INTERVAL_MS must be an integer of at least 10000'
        );
    }

    // Đảm bảo unique index chống gửi nhắc hạn trùng đã được tạo
    await EmailLog.init();

    console.log(
        `Task reminder scheduler started. Interval: ${intervalMs}ms`
    );

    // Kiểm tra ngay khi server khởi động
    void checkUpcomingTaskDeadlines();

    // Sau đó kiểm tra định kỳ
    schedulerTimer = setInterval(() => {
        void checkUpcomingTaskDeadlines();
    }, intervalMs);

    return schedulerTimer;
};

// Dừng bộ lập lịch khi cần
export const stopTaskReminderScheduler = () => {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;

        console.log('Task reminder scheduler stopped');
    }
};
