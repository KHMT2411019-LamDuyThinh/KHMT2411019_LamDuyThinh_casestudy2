
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import EmailLog from '../models/EmailLog.js';

// Thời gian khóa tối đa: 5 phút
const DELIVERY_LOCK_MS = 5 * 60 * 1000;

// Tạo cấu hình SMTP
const createTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error('SMTP configuration is incomplete');
    }

    if (!Number.isInteger(port) || port <= 0) {
        throw new Error('Invalid SMTP port');
    }

    const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE.toLowerCase() === 'true'
        : port === 465;

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 120000
    });
};

// Thực hiện gửi Email từ một bản ghi lịch sử
const deliverEmailLog = async (
    emailLogId,
    expectedStatus
) => {
    const lockId = new mongoose.Types.ObjectId().toString();

    const now = new Date();

    const lockExpiredBefore = new Date(
        now.getTime() - DELIVERY_LOCK_MS
    );

    // Khóa bản ghi bằng thao tác cập nhật nguyên tử.
    // Chỉ tiến trình lấy được khóa mới được phép gửi Email.
    const emailLog = await EmailLog.findOneAndUpdate(
        {
            _id: emailLogId,
            status: expectedStatus,
            $or: [
                { deliveryLockedAt: null },
                { deliveryLockedAt: { $exists: false } },
                { deliveryLockedAt: { $lt: lockExpiredBefore } }
            ]
        },
        {
            $set: {
                deliveryLockId: lockId,
                deliveryLockedAt: now,
                errorMessage: ''
            },
            $inc: {
                attempts: 1
            }
        },
        {
            new: true
        }
    );

    if (!emailLog) {
        return {
            success: false,
            reason: 'not_available',
            errorMessage:
                'Email is being processed or is not eligible for sending',
            emailLogId
        };
    }

    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: emailLog.recipientEmail,
            subject: emailLog.subject
        };

        if (emailLog.textContent) {
            mailOptions.text = emailLog.textContent;
        }

        if (emailLog.htmlContent) {
            mailOptions.html = emailLog.htmlContent;
        }

        const info = await transporter.sendMail(mailOptions);

        // Chỉ cập nhật kết quả nếu tiến trình vẫn giữ khóa
        const updatedLog = await EmailLog.findOneAndUpdate(
            {
                _id: emailLog._id,
                deliveryLockId: lockId
            },
            {
                $set: {
                    status: 'sent',
                    messageId: info.messageId || '',
                    sentAt: new Date(),
                    errorMessage: '',
                    deliveryLockId: '',
                    deliveryLockedAt: null
                }
            },
            {
                new: true
            }
        );

        if (!updatedLog) {
            console.error(
                'Email was sent, but its delivery lock is no longer owned:',
                emailLog._id
            );

            return {
                success: true,
                messageId: info.messageId || '',
                emailLogId: emailLog._id,
                attempts: emailLog.attempts
            };
        }

        return {
            success: true,
            messageId: info.messageId || '',
            emailLogId: updatedLog._id,
            attempts: updatedLog.attempts
        };

    } catch (error) {
        const errorMessage = String(
            error.message || 'Unknown email sending error'
        ).slice(0, 2000);

        try {
            await EmailLog.findOneAndUpdate(
                {
                    _id: emailLog._id,
                    deliveryLockId: lockId
                },
                {
                    $set: {
                        status: 'failed',
                        errorMessage,
                        deliveryLockId: '',
                        deliveryLockedAt: null
                    }
                }
            );
        } catch (saveError) {
            console.error(
                'Save email failure log error:',
                saveError.message
            );
        }

        console.error(
            'Send notification email error:',
            errorMessage
        );

        return {
            success: false,
            errorMessage,
            emailLogId: emailLog._id,
            attempts: emailLog.attempts
        };
    }
};

// Gửi Email thông báo và lưu lịch sử
export const sendNotificationEmail = async ({
    recipientEmail,
    recipientUserId = null,
    taskId = null,
    eventType,
    subject,
    text,
    html,
    reminderForDueDate = null
}) => {
    try {
        if (
            typeof recipientEmail !== 'string' ||
            !recipientEmail.trim()
        ) {
            throw new Error('Recipient email is required');
        }

        if (
            !eventType ||
            typeof subject !== 'string' ||
            !subject.trim() ||
            (!text && !html)
        ) {
            throw new Error('Email information is incomplete');
        }

        // Lưu nội dung Email để hỗ trợ gửi lại
        const emailLog = await EmailLog.create({
            recipientEmail: recipientEmail.trim(),
            recipientUserId,
            taskId,
            eventType,
            subject: subject.trim(),
            textContent: text || '',
            htmlContent: html || '',
            reminderForDueDate,
            status: 'pending',
            attempts: 0,
            deliveryLockId: '',
            deliveryLockedAt: null
        });

        return await deliverEmailLog(
            emailLog._id,
            'pending'
        );

    } catch (error) {
        // Bản ghi nhắc hạn đã tồn tại:
        // Không gửi trùng email cho cùng người và cùng hạn
        if (
            eventType === 'task_due_reminder' &&
            error.code === 11000
        ) {
            return {
                success: false,
                duplicate: true,
                errorMessage: 'Reminder already exists'
            };
        }

        console.error(
            'Create notification email error:',
            error.message
        );

        return {
            success: false,
            errorMessage: error.message,
            emailLogId: null
        };
    }
};

// Gửi lại Email đã thất bại
export const retryNotificationEmail = async (emailLogId) => {
    try {
        if (!mongoose.isValidObjectId(emailLogId)) {
            return {
                success: false,
                reason: 'invalid_id',
                errorMessage: 'Invalid email log ID'
            };
        }

        const emailLog = await EmailLog.findById(emailLogId);

        if (!emailLog) {
            return {
                success: false,
                reason: 'not_found',
                errorMessage: 'Email log not found'
            };
        }

        if (emailLog.status !== 'failed') {
            return {
                success: false,
                reason: 'not_failed',
                errorMessage: 'Only failed emails can be retried',
                emailLogId
            };
        }

        if (!emailLog.textContent && !emailLog.htmlContent) {
            return {
                success: false,
                reason: 'missing_content',
                errorMessage:
                    'This email log does not contain retryable email content',
                emailLogId
            };
        }

        return await deliverEmailLog(
            emailLogId,
            'failed'
        );

    } catch (error) {
        console.error(
            'Retry notification email error:',
            error.message
        );

        return {
            success: false,
            errorMessage: error.message,
            emailLogId
        };
    }
};
