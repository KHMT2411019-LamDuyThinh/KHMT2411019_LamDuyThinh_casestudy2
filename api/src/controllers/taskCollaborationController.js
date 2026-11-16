
import mongoose from 'mongoose';

import Task from '../models/Task.js';
import TaskShare from '../models/TaskShare.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

import { sendNotificationEmail } from '../services/emailService.js';
import { getTaskAccess } from '../services/taskAccessService.js';

// ==========================================
// HÀM HỖ TRỢ
// ==========================================

const isValidId = (id) =>
    typeof id === 'string' && mongoose.isValidObjectId(id);

const toId = (value) =>
    value ? String(value._id ?? value) : null;

const uniqueIds = (ids = []) =>
    [...new Set(ids.map(toId).filter(Boolean))];

const getOwnerTask = async (taskId, userId) => {
    return Task.findOne({
        _id: taskId,
        createdBy: userId
    });
};

const getReadableTask = async (taskId, userId) => {
    const task = await Task.findById(taskId);

    if (!task) return null;

    const access = await getTaskAccess(task, userId);

    if (!access.canView) return null;

    return task;
};

const populateTask = async (task) => {
    await task.populate('createdBy', 'fullName email avatarUrl');
    await task.populate('assigneeIds', 'fullName email avatarUrl');
    await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

    return task;
};

const serializeShare = (share) => {
    const result = share.toObject();
    result.permission = result.role;
    return result;
};

// ==========================================
// THÔNG BÁO VÀ EMAIL KHI THAY ĐỔI PHÂN CÔNG
// ==========================================

const notifyAssignmentChanges = async ({
    task,
    actorId,
    newlyAssignedIds = [],
    unassignedIds = [],
    actorName = 'Owner'
}) => {
    const notificationDocs = [
        ...newlyAssignedIds.map(userId => ({
            userId,
            actorId,
            taskId: task._id,
            type: 'task_assigned',
            title: 'Bạn được giao một công việc',
            message: `Bạn đã được giao công việc "${task.title}".`
        })),

        ...unassignedIds.map(userId => ({
            userId,
            actorId,
            taskId: task._id,
            type: 'task_unassigned',
            title: 'Bạn không còn được giao công việc',
            message: `Bạn không còn được giao công việc "${task.title}".`
        }))
    ];

    if (notificationDocs.length > 0) {
        try {
            await Notification.insertMany(notificationDocs);
        } catch (error) {
            console.error(
                'Assignment notification error:',
                error.message
            );
        }
    }

    const changedIds = uniqueIds([
        ...newlyAssignedIds,
        ...unassignedIds
    ]);

    if (changedIds.length === 0) return;

    try {
        const recipients = await User.find({
            _id: { $in: changedIds }
        }).select('_id fullName email');

        const recipientMap = new Map(
            recipients.map(user => [String(user._id), user])
        );

        for (const userId of changedIds) {
            const recipient = recipientMap.get(userId);

            if (!recipient?.email) continue;

            const isAssigned = newlyAssignedIds.includes(userId);

            const eventType = isAssigned
                ? 'task_assigned'
                : 'task_unassigned';

            const subject = isAssigned
                ? `Bạn được giao công việc: ${task.title}`
                : `Bạn không còn được giao công việc: ${task.title}`;

            const message = isAssigned
                ? `${actorName} đã giao cho bạn công việc "${task.title}".`
                : `${actorName} đã gỡ bạn khỏi danh sách người được giao công việc "${task.title}".`;

            const emailResult = await sendNotificationEmail({
                recipientEmail: recipient.email,
                recipientUserId: recipient._id,
                taskId: task._id,
                eventType,
                subject,
                text: `Xin chào ${recipient.fullName || 'bạn'},

${message}

Hãy đăng nhập vào Task Manager để xem thông tin công việc.

Trân trọng,
Task Manager`
            });

            if (!emailResult.success) {
                console.error(
                    `Assignment email failed for ${recipient.email}:`,
                    emailResult.errorMessage
                );
            }
        }
    } catch (error) {
        console.error(
            'Assignment email processing error:',
            error.message
        );
    }
};

// ==========================================
// THÔNG BÁO VÀ EMAIL KHI THAY ĐỔI CHIA SẺ
// ==========================================

const notifyShareChange = async ({
    task,
    actorId,
    recipient,
    eventType,
    title,
    message,
    subject,
    text
}) => {
    try {
        await Notification.create({
            userId: recipient._id,
            actorId,
            taskId: task._id,
            type: eventType,
            title,
            message
        });
    } catch (error) {
        console.error(
            'Share notification error:',
            error.message
        );
    }

    if (!recipient.email) return;

    try {
        const result = await sendNotificationEmail({
            recipientEmail: recipient.email,
            recipientUserId: recipient._id,
            taskId: task._id,
            eventType,
            subject,
            text
        });

        if (!result.success) {
            console.error(
                'Share email failed:',
                result.errorMessage
            );
        }
    } catch (error) {
        console.error('Share email processing error:', error.message);
    }
};

// ==========================================
// TÌM KIẾM THÀNH VIÊN
// Hỗ trợ cả query q và search cũ
// ==========================================

export const searchMembers = async (req, res) => {
    try {
        const search = req.query.q ?? req.query.search;

        if (
            typeof search !== 'string' ||
            search.trim().length < 2
        ) {
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
        console.error('Search members error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ==========================================
// GET /tasks/:id/assignees
// LẤY DANH SÁCH NGƯỜI ĐƯỢC GIAO
// ==========================================

export const getTaskAssignees = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await getReadableTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        await task.populate(
            'assigneeIds',
            'fullName email avatarUrl'
        );

        await task.populate(
            'primaryAssigneeId',
            'fullName email avatarUrl'
        );

        const primaryId = toId(task.primaryAssigneeId);

        const assignees = task.assigneeIds.map(user => ({
            ...user.toObject(),
            isPrimary: String(user._id) === primaryId
        }));

        return res.status(200).json({
            success: true,
            total: assignees.length,
            primaryAssigneeId: primaryId,
            assignees
        });

    } catch (error) {
        console.error('Get task assignees error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve task assignees'
        });
    }
};

// ==========================================
// POST /tasks/:id/assignees
// THÊM MỘT HOẶC NHIỀU NGƯỜI ĐƯỢC GIAO
// ==========================================

export const addTaskAssignees = async (req, res) => {
    try {
        const { id } = req.params;
        const { assigneeIds, userId, primaryAssigneeId } = req.body;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const requestedIds = Array.isArray(assigneeIds)
            ? assigneeIds
            : userId
                ? [userId]
                : null;

        if (
            !requestedIds ||
            requestedIds.length === 0 ||
            requestedIds.some(id => !isValidId(id))
        ) {
            return res.status(400).json({
                success: false,
                message: 'A valid assigneeIds array or userId is required'
            });
        }

        const task = await getOwnerTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const newIds = uniqueIds(requestedIds);

        if (newIds.includes(String(req.userId))) {
            return res.status(400).json({
                success: false,
                message: 'Task owner cannot be an assignee'
            });
        }

        const users = await User.find({
            _id: { $in: newIds }
        }).select('_id');

        if (users.length !== newIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more users do not exist'
            });
        }

        const previousIds = uniqueIds(task.assigneeIds);

        const addedIds = newIds.filter(
            id => !previousIds.includes(id)
        );

        const finalIds = uniqueIds([
            ...previousIds,
            ...newIds
        ]);

        if (primaryAssigneeId !== undefined) {
            if (
                primaryAssigneeId !== null &&
                (
                    !isValidId(primaryAssigneeId) ||
                    !finalIds.includes(primaryAssigneeId)
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Primary assignee must belong to the assigned list'
                });
            }

            task.primaryAssigneeId = primaryAssigneeId;
        }

        task.assigneeIds = finalIds;

        await task.save();

        await notifyAssignmentChanges({
            task,
            actorId: req.userId,
            newlyAssignedIds: addedIds,
            actorName: req.user?.fullName || 'Owner'
        });

        await populateTask(task);

        return res.status(200).json({
            success: true,
            message: 'Assignees added successfully',
            task
        });

    } catch (error) {
        console.error('Add task assignees error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to add task assignees'
        });
    }
};

// ==========================================
// PUT /tasks/:id/assignees
// CẬP NHẬT TOÀN BỘ DANH SÁCH
// GIỮ TƯƠNG THÍCH VỚI FLUTTER CŨ
// ==========================================

export const assignTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { assigneeIds } = req.body;
        const hasPrimaryAssignee = Object.prototype.hasOwnProperty.call(
            req.body,
            'primaryAssigneeId'
        );
        const requestedPrimaryAssigneeId = req.body.primaryAssigneeId;

        if (!isValidId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        if (
            !Array.isArray(assigneeIds) ||
            assigneeIds.some(id => !isValidId(id))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignee list'
            });
        }

        if (
            hasPrimaryAssignee &&
            requestedPrimaryAssigneeId !== null &&
            !isValidId(requestedPrimaryAssigneeId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid primary assignee ID'
            });
        }

        const task = await getOwnerTask(taskId, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const nextIds = uniqueIds(assigneeIds);
        const previousIds = uniqueIds(task.assigneeIds);
        const ownerId = String(req.userId);

        if (nextIds.includes(ownerId)) {
            return res.status(400).json({
                success: false,
                message: 'Task owner cannot be an assignee'
            });
        }

        const users = await User.find({
            _id: { $in: nextIds }
        }).select('_id');

        if (users.length !== nextIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more users do not exist'
            });
        }

        // Nếu client không gửi primaryAssigneeId, giữ người phụ trách chính
        // hiện tại nếu người đó vẫn nằm trong danh sách mới.
        const currentPrimaryId = toId(task.primaryAssigneeId);
        let nextPrimaryId;

        if (hasPrimaryAssignee) {
            nextPrimaryId = requestedPrimaryAssigneeId;
        } else if (currentPrimaryId && nextIds.includes(currentPrimaryId)) {
            nextPrimaryId = currentPrimaryId;
        } else {
            // Nếu người phụ trách chính cũ bị gỡ, chuyển cho người đầu tiên còn lại.
            nextPrimaryId = nextIds[0] ?? null;
        }

        if (nextPrimaryId !== null && !nextIds.includes(String(nextPrimaryId))) {
            return res.status(400).json({
                success: false,
                message: 'Primary assignee must be in the assignee list'
            });
        }

        const newlyAssignedIds = nextIds.filter(
            id => !previousIds.includes(id)
        );

        const unassignedIds = previousIds.filter(
            id => !nextIds.includes(id)
        );

        task.assigneeIds = nextIds;
        task.primaryAssigneeId = nextPrimaryId;

        await task.save();

        await notifyAssignmentChanges({
            task,
            actorId: req.userId,
            newlyAssignedIds,
            unassignedIds,
            actorName: req.user?.fullName || 'Owner'
        });

        await populateTask(task);

        return res.status(200).json({
            success: true,
            message: 'Task assigned successfully',
            task
        });

    } catch (error) {
        console.error('Assign task error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to assign task'
        });
    }
};

// ==========================================
// PATCH /tasks/:id/assignees/:userId
// THAY ĐỔI NGƯỜI PHỤ TRÁCH CHÍNH
// ==========================================

export const updateTaskAssignee = async (req, res) => {
    try {
        const { id, userId } = req.params;

        if (!isValidId(id) || !isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or user ID'
            });
        }

        const task = await getOwnerTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const isAssignee = (task.assigneeIds || []).some(
            item => String(item) === String(userId)
        );

        if (!isAssignee) {
            return res.status(404).json({
                success: false,
                message: 'Assignee not found'
            });
        }

        // Hỗ trợ isPrimary hoặc primaryAssignee
        const isPrimary =
            req.body.isPrimary ??
            req.body.primaryAssignee;

        if (typeof isPrimary !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isPrimary must be a boolean'
            });
        }

        if (isPrimary) {
            task.primaryAssigneeId = userId;
        } else if (toId(task.primaryAssigneeId) === userId) {
            // Không để công việc còn người được giao nhưng mất người phụ trách chính.
            // Chuyển vai trò chính sang người được giao khác đầu tiên.
            const replacementId = uniqueIds(task.assigneeIds).find(
                assigneeId => assigneeId !== userId
            );

            if (!replacementId) {
                return res.status(400).json({
                    success: false,
                    message: 'The only assignee must remain the primary assignee. Assign another user first.'
                });
            }

            task.primaryAssigneeId = replacementId;
        }

        await task.save();
        await populateTask(task);

        return res.status(200).json({
            success: true,
            message: 'Assignee role updated successfully',
            task
        });

    } catch (error) {
        console.error('Update task assignee error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update task assignee'
        });
    }
};

// ==========================================
// DELETE /tasks/:id/assignees/:userId
// GỠ MỘT NGƯỜI ĐƯỢC GIAO
// ==========================================

export const removeTaskAssignee = async (req, res) => {
    try {
        const { id, userId } = req.params;

        if (!isValidId(id) || !isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or user ID'
            });
        }

        const task = await getOwnerTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const previousIds = uniqueIds(task.assigneeIds);

        if (!previousIds.includes(userId)) {
            return res.status(404).json({
                success: false,
                message: 'Assignee not found'
            });
        }

        const remainingIds = previousIds.filter(
            assigneeId => assigneeId !== userId
        );

        task.assigneeIds = remainingIds;

        // Không để primaryAssigneeId trỏ đến người vừa bị gỡ.
        // Nếu người bị gỡ là phụ trách chính, chuyển cho người còn lại đầu tiên.
        if (toId(task.primaryAssigneeId) === userId) {
            task.primaryAssigneeId = remainingIds[0] ?? null;
        }

        await task.save();

        // Chỉ gỡ vai trò Assignee; không xóa TaskShare nếu người này
        // vẫn được chia sẻ công việc dưới quyền viewer/editor.
        await notifyAssignmentChanges({
            task,
            actorId: req.userId,
            unassignedIds: [userId],
            actorName: req.user?.fullName || 'Owner'
        });

        await populateTask(task);

        return res.status(200).json({
            success: true,
            message: 'Assignee removed successfully',
            task
        });

    } catch (error) {
        console.error('Remove task assignee error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to remove task assignee'
        });
    }
};

// ==========================================
// POST /tasks/:id/shares
// CHIA SẺ CÔNG VIỆC
// ==========================================

export const createTaskShare = async (req, res) => {
    try {
        const { id } = req.params;
        const role = req.body.permission ?? req.body.role;

        // Hỗ trợ cả API cũ một userId và API mới nhiều userIds.
        const requestedUserIds = Array.isArray(req.body.userIds)
            ? req.body.userIds
            : req.body.userId
                ? [req.body.userId]
                : null;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        if (
            !requestedUserIds ||
            requestedUserIds.length === 0 ||
            requestedUserIds.some(userId => !isValidId(userId))
        ) {
            return res.status(400).json({
                success: false,
                message: 'A valid userId or non-empty userIds array is required'
            });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Permission must be viewer or editor'
            });
        }

        const task = await getOwnerTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const userIds = uniqueIds(requestedUserIds);
        const ownerId = String(req.userId);

        if (userIds.includes(ownerId)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot share a task with its owner'
            });
        }

        // Kiểm tra tất cả tài khoản trước khi tạo, tránh tạo dở dang.
        const users = await User.find({
            _id: { $in: userIds }
        }).select('_id fullName email');

        if (users.length !== userIds.length) {
            const foundIds = new Set(users.map(user => String(user._id)));
            const missingUserIds = userIds.filter(userId => !foundIds.has(userId));

            return res.status(404).json({
                success: false,
                message: 'One or more users do not exist',
                missingUserIds
            });
        }

        // Cho phép một người vừa là Assignee vừa là Shared.
        // Chỉ chặn trường hợp đã có bản ghi chia sẻ.
        const existingShares = await TaskShare.find({
            taskId: id,
            userId: { $in: userIds }
        }).select('userId');

        if (existingShares.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'One or more users have already been shared this task',
                existingUserIds: existingShares.map(share => String(share.userId))
            });
        }

        const shareDocs = userIds.map(userId => ({
            taskId: id,
            userId,
            role,
            sharedBy: req.userId
        }));

        // insertMany tạo các bản ghi chia sẻ trong cùng một thao tác.
        const createdShares = await TaskShare.insertMany(shareDocs, {
            ordered: true
        });

        const userMap = new Map(
            users.map(user => [String(user._id), user])
        );

        const roleLabel = role === 'viewer'
            ? 'Chỉ xem'
            : 'Có quyền chỉnh sửa';

        // Gửi thông báo và email riêng cho từng người được chia sẻ.
        for (const userId of userIds) {
            const recipient = userMap.get(userId);
            if (!recipient) continue;

            await notifyShareChange({
                task,
                actorId: req.userId,
                recipient,
                eventType: 'task_shared',
                title: 'Một công việc đã được chia sẻ với bạn',
                message: `Bạn được cấp quyền ${roleLabel.toLowerCase()} công việc "${task.title}".`,
                subject: `Bạn được chia sẻ công việc: ${task.title}`,
                text: `Xin chào ${recipient.fullName || 'bạn'},

${req.user?.fullName || 'Owner'} vừa chia sẻ công việc "${task.title}" với bạn.

Quyền truy cập: ${roleLabel}.

Hãy đăng nhập vào Task Manager để xem công việc.

Trân trọng,
Task Manager`
            });
        }

        // Populate dữ liệu để Flutter nhận được thông tin người dùng đầy đủ.
        for (const share of createdShares) {
            await share.populate('userId', 'fullName email avatarUrl');
            await share.populate('sharedBy', 'fullName email avatarUrl');
        }

        const serializedShares = createdShares.map(serializeShare);
        const response = {
            success: true,
            message: 'Task shared successfully',
            total: serializedShares.length,
            shares: serializedShares
        };

        // Giữ nguyên cấu trúc `share` cho Flutter/API cũ khi chỉ chia sẻ một người.
        if (serializedShares.length === 1) {
            response.share = serializedShares[0];
        }

        return res.status(201).json(response);

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'One or more users have already been shared this task'
            });
        }

        console.error('Create task share error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to share task'
        });
    }
};

// ==========================================
// GET /tasks/:id/shares
// LẤY DANH SÁCH CHIA SẺ
// ==========================================

export const getTaskShares = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        const task = await getReadableTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        const shares = await TaskShare.find({ taskId: id })
            .populate('userId', 'fullName email avatarUrl')
            .populate('sharedBy', 'fullName email avatarUrl')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: shares.length,
            shares: shares.map(serializeShare)
        });

    } catch (error) {
        console.error('Get task shares error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve task shares'
        });
    }
};

// ==========================================
// PATCH /tasks/:id/shares/:shareId
// THAY ĐỔI QUYỀN CHIA SẺ
// ==========================================

export const updateTaskShare = async (req, res) => {
    try {
        const { id } = req.params;

        const identifier =
            req.params.shareId ??
            req.params.userId;

        const role =
            req.body.permission ??
            req.body.role;

        if (
            !isValidId(id) ||
            !isValidId(identifier)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or share ID'
            });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Permission must be viewer or editor'
            });
        }

        const task = await getOwnerTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        // Ưu tiên tìm theo shareId.
        // Nếu không tìm thấy, thử userId để tương thích Flutter cũ.
        let share = await TaskShare.findOne({
            _id: identifier,
            taskId: id
        });

        if (!share) {
            share = await TaskShare.findOne({
                taskId: id,
                userId: identifier
            });
        }

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Share not found'
            });
        }

        const previousRole = share.role;

        if (previousRole !== role) {
            share.role = role;
            await share.save();

            const recipient = await User.findById(share.userId)
                .select('_id fullName email');

            if (recipient) {
                const previousLabel = previousRole === 'viewer'
                    ? 'Chỉ xem'
                    : 'Có quyền chỉnh sửa';

                const newLabel = role === 'viewer'
                    ? 'Chỉ xem'
                    : 'Có quyền chỉnh sửa';

                await notifyShareChange({
                    task,
                    actorId: req.userId,
                    recipient,
                    eventType: 'task_share_role_updated',
                    title: 'Quyền truy cập công việc đã thay đổi',
                    message: `Quyền của bạn đối với công việc "${task.title}" đã đổi từ ${previousRole} sang ${role}.`,
                    subject: `Quyền truy cập công việc đã thay đổi: ${task.title}`,
                    text: `Xin chào ${recipient.fullName || 'bạn'},

${req.user?.fullName || 'Owner'} vừa thay đổi quyền truy cập công việc "${task.title}".

Quyền trước đó: ${previousLabel}.
Quyền hiện tại: ${newLabel}.

Hãy đăng nhập vào Task Manager để tiếp tục sử dụng công việc.

Trân trọng,
Task Manager`
                });
            }
        }

        await share.populate('userId', 'fullName email avatarUrl');
        await share.populate('sharedBy', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Sharing permission updated successfully',
            share: serializeShare(share)
        });

    } catch (error) {
        console.error('Update task share error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update sharing permission'
        });
    }
};

// ==========================================
// DELETE /tasks/:id/shares/:shareId
// THU HỒI QUYỀN CHIA SẺ
// ==========================================

export const deleteTaskShare = async (req, res) => {
    try {
        const { id } = req.params;

        const identifier =
            req.params.shareId ??
            req.params.userId;

        if (
            !isValidId(id) ||
            !isValidId(identifier)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task or share ID'
            });
        }

        const task = await getOwnerTask(id, req.userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        let share = await TaskShare.findOne({
            _id: identifier,
            taskId: id
        });

        if (!share) {
            share = await TaskShare.findOne({
                taskId: id,
                userId: identifier
            });
        }

        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Share not found'
            });
        }

        const recipient = await User.findById(share.userId)
            .select('_id fullName email');

        const revokedRole = share.role;

        await share.deleteOne();

        // Chỉ thu hồi vai trò Shared.
        // Nếu người này vẫn là Assignee, quyền Assignee vẫn được giữ.
        if (recipient) {
            const roleLabel = revokedRole === 'viewer'
                ? 'xem'
                : 'chỉnh sửa';

            await notifyShareChange({
                task,
                actorId: req.userId,
                recipient,
                eventType: 'task_share_removed',
                title: 'Quyền truy cập công việc đã bị thu hồi',
                message: `Owner đã thu hồi quyền ${roleLabel} đối với công việc "${task.title}".`,
                subject: `Quyền truy cập đã bị thu hồi: ${task.title}`,
                text: `Xin chào ${recipient.fullName || 'bạn'},

${req.user?.fullName || 'Owner'} đã thu hồi quyền ${roleLabel} của bạn đối với công việc "${task.title}".

Quyền chia sẻ không còn hiệu lực.

Trân trọng,
Task Manager`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Task sharing revoked successfully'
        });

    } catch (error) {
        console.error('Delete task share error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to revoke task sharing'
        });
    }
};
