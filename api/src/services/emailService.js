
import nodemailer from 'nodemailer';
import EmailLog from '../models/EmailLog.js';

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
        }
    });
};

// Gửi Email thông báo và lưu lịch sử
export const sendNotificationEmail = async ({
    recipientEmail,
    recipientUserId = null,
    taskId = null,
    eventType,
    subject,
    text,
    html
}) => {
    let emailLog = null;

    try {
        // Kiểm tra dữ liệu đầu vào
        if (!recipientEmail || !recipientEmail.trim()) {
            throw new Error('Recipient email is required');
        }

        if (!eventType || !subject || (!text && !html)) {
            throw new Error('Email information is incomplete');
        }

        // Lưu lịch sử trước khi gửi
        emailLog = await EmailLog.create({
            recipientEmail,
            recipientUserId,
            taskId,
            eventType,
            subject,
            status: 'pending'
        });

        // Tạo SMTP transporter
        const transporter = createTransporter();

        // Gửi Email
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipientEmail,
            subject,
            text,
            html
        });

        // Cập nhật lịch sử gửi thành công
        emailLog.status = 'sent';
        emailLog.messageId = info.messageId || '';
        emailLog.sentAt = new Date();
        emailLog.errorMessage = '';

        await emailLog.save();

        return {
            success: true,
            messageId: info.messageId || '',
            emailLogId: emailLog._id
        };

    } catch (error) {
        // Ghi nhận lỗi gửi Email
        if (emailLog) {
            emailLog.status = 'failed';
            emailLog.errorMessage = String(error.message).slice(0, 2000);

            try {
                await emailLog.save();
            } catch (saveError) {
                console.error(
                    'Save email log error:',
                    saveError.message
                );
            }
        }

        console.error(
            'Send notification email error:',
            error.message
        );

        return {
            success: false,
            errorMessage: error.message,
            emailLogId: emailLog?._id || null
        };
    }
};
