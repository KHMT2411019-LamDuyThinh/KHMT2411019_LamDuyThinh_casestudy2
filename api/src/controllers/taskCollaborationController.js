
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import TaskShare from '../models/TaskShare.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendNotificationEmail } from '../services/emailService.js';

// Hàm kiểm tra ID MongoDB
const isValidId = (id) => {
    return typeof id === 'string' && mongoose.isValidObjectId(id);
};

// Tìm kiếm thành viên để phân công hoặc chia sẻ
export const searchMembers = async (req, res) => {
    try {
        const search = req.query.search;

        if (typeof search !== 'string' || search.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search keyword must contain at least 2 characters'
            });
        }

        const escapedSearch = search.trim().replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const members = await User.find({
            _id: { $ne: req.userId },
            $or: [
                {
                    fullName: {
                        $regex: escapedSearch,
                        $options: 'i'
                    }
                },
                {
                    email: {
                        $regex: escapedSearch,
                        $options: 'i'
                    }
                }
            ]
        })
            .select('fullName email avatarUrl')
            .sort({ fullName: 1 })
            .limit(20);

        return res.status(200).json({
            success: true,
            total: members.length,
            members
        });

    } catch (error) {
        console.error('Search members error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Phân công thành viên cho công việc
export const assignTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { assigneeIds, primaryAssigneeId = null } = req.body;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Danh sách người được giao phải là một mảng
        if (
            !Array.isArray(assigneeIds) ||
            assigneeIds.some(id => !isValidId(id))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignee list'
            });
        }

        // Kiểm tra người phụ trách chính
        if (
            primaryAssigneeId !== null &&
            !isValidId(primaryAssigneeId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid primary assignee ID'
            });
        }

        // Loại bỏ ID trùng lặp
        const uniqueAssigneeIds = [...new Set(assigneeIds)];

        // Người phụ trách chính phải nằm trong danh sách được giao
        if (
            primaryAssigneeId !== null &&
            !uniqueAssigneeIds.includes(primaryAssigneeId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Primary assignee must be in the assignee list'
            });
        }

        // Tìm công việc và xác nhận người thực hiện là Owner
        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }
        // Lưu danh sách Assignee trước khi cập nhật
        const previousAssigneeIds = (task.assigneeIds || [])
            .map(id => String(id));

        // Không cho phép giao công việc cho chính người tạo
        if (uniqueAssigneeIds.some(
            id => id === String(req.userId)
        )) {
            return res.status(400).json({
                success: false,
                message: 'Task owner cannot be an assignee'
            });
        }

        // Kiểm tra tất cả thành viên có tồn tại không
        const users = await User.find({
            _id: { $in: uniqueAssigneeIds }
        }).select('_id');

        if (users.length !== uniqueAssigneeIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more users do not exist'
            });
        }

        // Không cho một người vừa là Assignee vừa là người được chia sẻ
        const shareConflict = await TaskShare.findOne({
            taskId,
            userId: { $in: uniqueAssigneeIds }
        });

        if (shareConflict) {
            return res.status(409).json({
                success: false,
                message: 'Remove the existing share before assigning this user'
            });
        }

        task.assigneeIds = uniqueAssigneeIds;
        task.primaryAssigneeId = primaryAssigneeId;

        await task.save();


// Xác định những người vừa được giao hoặc bị gỡ khỏi công việc
const currentAssigneeIds = uniqueAssigneeIds.map(id => String(id));

const newlyAssignedIds = currentAssigneeIds.filter(
    id => !previousAssigneeIds.includes(id)
);

const unassignedIds = previousAssigneeIds.filter(
    id => !currentAssigneeIds.includes(id)
);

// Tạo thông báo cho những người vừa được giao việc
const notificationDocs = [
    ...newlyAssignedIds.map(userId => ({
        userId,
        actorId: req.userId,
        taskId: task._id,
        type: 'task_assigned',
        title: 'Bạn được giao một công việc',
        message: `Bạn đã được giao công việc "${task.title}".`
    })),

    // Tạo thông báo cho những người vừa bị gỡ khỏi công việc
    ...unassignedIds.map(userId => ({
        userId,
        actorId: req.userId,
        taskId: task._id,
        type: 'task_unassigned',
        title: 'Bạn không còn được giao công việc',
        message: `Bạn không còn được giao công việc "${task.title}".`
    }))
];

// Lưu thông báo độc lập với thao tác giao việc
if (notificationDocs.length > 0) {
    try {
        await Notification.insertMany(notificationDocs);
    } catch (notificationError) {
        console.error(
            'Create assignment notifications error:',
            notificationError.message
        );
    }
}

// Gửi Email cho người vừa được giao hoặc bị gỡ khỏi công việc
const changedAssigneeIds = [
    ...new Set([
        ...newlyAssignedIds,
        ...unassignedIds
    ])
];

if (changedAssigneeIds.length > 0) {
    try {
        // Lấy thông tin Email của những thành viên bị thay đổi
        const changedUsers = await User.find({
            _id: { $in: changedAssigneeIds }
        }).select('_id fullName email');

        const changedUserMap = new Map(
            changedUsers.map(user => [
                String(user._id),
                user
            ])
        );

        const actorName = req.user?.fullName || 'Owner';

        // Gửi Email cho từng thành viên
        for (const changedUserId of changedAssigneeIds) {
            const recipient = changedUserMap.get(changedUserId);

            if (!recipient || !recipient.email) {
                continue;
            }

            const isNewlyAssigned = newlyAssignedIds.includes(
                changedUserId
            );

            const eventType = isNewlyAssigned
                ? 'task_assigned'
                : 'task_unassigned';

            const subject = isNewlyAssigned
                ? `Bạn được giao công việc: ${task.title}`
                : `Bạn không còn được giao công việc: ${task.title}`;

            const emailText = isNewlyAssigned
                ? `Xin chào ${recipient.fullName || 'bạn'},

${actorName} đã giao cho bạn công việc "${task.title}".

Hãy đăng nhập vào Task Manager để xem chi tiết công việc.

Trân trọng,
Task Manager`
                : `Xin chào ${recipient.fullName || 'bạn'},

${actorName} đã gỡ bạn khỏi danh sách người được giao công việc "${task.title}".

Trân trọng,
Task Manager`;

            const emailResult = await sendNotificationEmail({
                recipientEmail: recipient.email,
                recipientUserId: recipient._id,
                taskId: task._id,
                eventType,
                subject,
                text: emailText
            });

            if (!emailResult.success) {
                console.error(
                    `Assignment email failed for ${recipient.email}:`,
                    emailResult.errorMessage
                );
            }
        }
    } catch (emailError) {
        console.error(
            'Assignment email processing error:',
            emailError.message
        );
    }
}

        await task.populate('createdBy', 'fullName email avatarUrl');
        await task.populate('assigneeIds', 'fullName email avatarUrl');
        await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Task assigned successfully',
            task
        });

    } catch (error) {
        console.error('Assign task error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Chia sẻ công việc cho thành viên
export const createTaskShare = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { userId, role } = req.body;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        if (!isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sharing role'
            });
        }

        // Chỉ Owner mới có thể chia sẻ
        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        // Kiểm tra người nhận có tồn tại không
        const user = await User.findById(userId)
            .select('_id fullName email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Không chia sẻ cho chính Owner
        if (String(userId) === String(req.userId)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot share a task with its owner'
            });
        }

        // Người đã được giao không cần thêm quyền chia sẻ
        if (
            task.assigneeIds.some(
                id => String(id) === String(userId)
            )
        ) {
            return res.status(409).json({
                success: false,
                message: 'This user is already assigned to the task'
            });
        }

        // Kiểm tra chia sẻ trùng lặp
        const existingShare = await TaskShare.findOne({
            taskId,
            userId
        });

        if (existingShare) {
            return res.status(409).json({
                success: false,
                message: 'This task has already been shared with this user'
            });
        }

        const share = await TaskShare.create({
            taskId,
            userId,
            role,
            sharedBy: req.userId
        });

        // Tạo thông báo cho người được chia sẻ công việc
        try {
            await Notification.create({
                userId,
                actorId: req.userId,
                taskId: task._id,
                type: 'task_shared',
                title: 'Một công việc đã được chia sẻ với bạn',
                message: role === 'viewer'
                    ? `Bạn được cấp quyền xem công việc "${task.title}".`
                    : `Bạn được cấp quyền chỉnh sửa công việc "${task.title}".`
            });
        } catch (notificationError) {
            console.error(
                'Create task share notification error:',
                notificationError.message
            );
        }

        // Gửi Email thông báo cho thành viên được chia sẻ
        try {
            const actorName = req.user?.fullName || 'Owner';

            const roleLabel = role === 'viewer'
                ? 'Chỉ xem'
                : 'Có quyền chỉnh sửa';

            const emailResult = await sendNotificationEmail({
                recipientEmail: user.email,
                recipientUserId: user._id,
                taskId: task._id,
                eventType: 'task_shared',
                subject: `Bạn được chia sẻ công việc: ${task.title}`,

                text: `Xin chào ${user.fullName},

${actorName} vừa chia sẻ công việc "${task.title}" với bạn.

Quyền truy cập: ${roleLabel}.

Bạn có thể đăng nhập vào ứng dụng Task Manager để xem công việc được chia sẻ.

Trân trọng,
Task Manager`
            });

            if (!emailResult.success) {
                console.error(
                    'Task sharing email failed:',
                    emailResult.errorMessage
                );
            }
        } catch (emailError) {
            console.error(
                'Task sharing email error:',
                emailError.message
            );
        }

        await share.populate('userId', 'fullName email avatarUrl');
        await share.populate('sharedBy', 'fullName email avatarUrl');

        return res.status(201).json({
            success: true,
            message: 'Task shared successfully',
            share
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This task has already been shared with this user'
            });
        }

        console.error('Create task share error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Lấy danh sách người được chia sẻ
export const getTaskShares = async (req, res) => {
    try {
        const taskId = req.params.id;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const shares = await TaskShare.find({ taskId })
            .populate('userId', 'fullName email avatarUrl')
            .populate('sharedBy', 'fullName email avatarUrl')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: shares.length,
            shares
        });

    } catch (error) {
        console.error('Get task shares error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Thay đổi quyền chia sẻ
export const updateTaskShare = async (req, res) => {
    try {
        const { id: taskId, userId } = req.params;
        const { role } = req.body;

        if (!isValidId(taskId) || !isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or user ID'
            });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sharing role'
            });
        }

        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const share = await TaskShare.findOne({
            taskId,
            userId
        });

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Share not found'
            });
        }
        // Lưu quyền chia sẻ trước khi thay đổi
        const previousRole = share.role;

// Cập nhật quyền chia sẻ
share.role = role;
await share.save();

// Chỉ thông báo khi quyền thực sự thay đổi
if (previousRole !== role) {
    const previousRoleLabel = previousRole === 'viewer'
        ? 'Viewer'
        : 'Editor';

    const newRoleLabel = role === 'viewer'
        ? 'Viewer'
        : 'Editor';

    try {
        await Notification.create({
            userId,
            actorId: req.userId,
            taskId: task._id,
            type: 'task_share_role_updated',
            title: 'Quyền truy cập công việc đã thay đổi',
            message: `Quyền của bạn đối với công việc "${task.title}" đã được thay đổi từ ${previousRoleLabel} sang ${newRoleLabel}.`
        });
    } catch (notificationError) {
        console.error(
            'Update task share notification error:',
            notificationError.message
        );
    }
}

        await share.populate('userId', 'fullName email avatarUrl');
        await share.populate('sharedBy', 'fullName email avatarUrl');


        // Gửi Email khi quyền Viewer / Editor thực sự thay đổi
        if (previousRole !== role) {
            try {
                const recipient = share.userId;

                if (recipient?.email) {
                    const actorName = req.user?.fullName || 'Owner';

                    const previousRoleLabel = previousRole === 'viewer'
                        ? 'Chỉ xem'
                        : 'Có quyền chỉnh sửa';

                    const newRoleLabel = role === 'viewer'
                        ? 'Chỉ xem'
                        : 'Có quyền chỉnh sửa';

                    const emailResult = await sendNotificationEmail({
                        recipientEmail: recipient.email,
                        recipientUserId: recipient._id,
                        taskId: task._id,
                        eventType: 'task_share_role_updated',
                        subject: `Quyền truy cập công việc đã thay đổi: ${task.title}`,

                        text: `Xin chào ${recipient.fullName || 'bạn'},

${actorName} vừa thay đổi quyền truy cập của bạn đối với công việc "${task.title}".

Quyền trước đó: ${previousRoleLabel}.
Quyền hiện tại: ${newRoleLabel}.

Hãy đăng nhập vào Task Manager để tiếp tục sử dụng công việc.

Trân trọng,
Task Manager`
                    });

                    if (!emailResult.success) {
                        console.error(
                            'Share role update email failed:',
                            emailResult.errorMessage
                        );
                    }
                }
            } catch (emailError) {
                console.error(
                    'Share role update email error:',
                    emailError.message
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Sharing role updated successfully',
            share
        });

    } catch (error) {
        console.error('Update task share error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Thu hồi quyền chia sẻ
export const deleteTaskShare = async (req, res) => {
    try {
        const { id: taskId, userId } = req.params;

        if (!isValidId(taskId) || !isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or user ID'
            });
        }

        const task = await Task.findOne({
            _id: taskId,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const share = await TaskShare.findOneAndDelete({
            taskId,
            userId
        });

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Share not found'
            });
        }

        // Tạo thông báo cho thành viên bị thu hồi quyền chia sẻ
        try {
            await Notification.create({
                userId,
                actorId: req.userId,
                taskId: task._id,
                type: 'task_share_removed',
                title: 'Quyền truy cập công việc đã bị thu hồi',
                message: `Owner đã thu hồi quyền ${
                    share.role === 'viewer' ? 'xem' : 'chỉnh sửa'
                } đối với công việc "${task.title}".`
            });
        } catch (notificationError) {
            console.error(
                'Delete task share notification error:',
                notificationError.message
            );
        }

        // Gửi Email cho thành viên bị thu hồi quyền chia sẻ
        try {
            const recipient = await User.findById(userId)
                .select('_id fullName email');

            if (recipient?.email) {
                const actorName = req.user?.fullName || 'Owner';

                const revokedRole = share.role === 'viewer'
                    ? 'xem'
                    : 'chỉnh sửa';

                const emailResult = await sendNotificationEmail({
                    recipientEmail: recipient.email,
                    recipientUserId: recipient._id,
                    taskId: task._id,
                    eventType: 'task_share_removed',
                    subject: `Quyền truy cập đã bị thu hồi: ${task.title}`,

                    text: `Xin chào ${recipient.fullName || 'bạn'},

${actorName} đã thu hồi quyền ${revokedRole} của bạn đối với công việc "${task.title}".

Bạn không còn quyền truy cập công việc này thông qua tính năng chia sẻ của Task Manager.

Trân trọng,
Task Manager`
                });

                if (!emailResult.success) {
                    console.error(
                        'Share removal email failed:',
                        emailResult.errorMessage
                    );
                }
            }
        } catch (emailError) {
            console.error(
                'Share removal email error:',
                emailError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Task sharing revoked successfully'
        });

    } catch (error) {
        console.error('Delete task share error:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
