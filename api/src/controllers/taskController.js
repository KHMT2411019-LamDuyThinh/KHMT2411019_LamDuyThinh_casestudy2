
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import TaskShare from '../models/TaskShare.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNotificationEmail } from '../services/emailService.js';
import { getTaskAccess } from '../services/taskAccessService.js';

const isValidId = (id) =>
    typeof id === 'string' && mongoose.isValidObjectId(id);

const getStatusLabel = (status) => ({
    todo: 'Chưa bắt đầu',
    in_progress: 'Đang thực hiện',
    completed: 'Đã hoàn thành'
})[status] || status;

// Chuẩn hóa ObjectId hoặc populated document thành chuỗi ID
const normalizeId = (value) => {
    if (!value) return null;

    return String(value._id ?? value);
};

// Lấy tất cả vai trò của người dùng đối với công việc
const getAccessRoles = (task, userId, shareRole) => {
    const roles = [];

    if (
        normalizeId(task.createdBy) === normalizeId(userId)
    ) {
        roles.push('owner');
    }

    if ((task.assigneeIds || []).some(
        id => normalizeId(id) === normalizeId(userId)
    )) {
        roles.push('assignee');
    }

    if (shareRole === 'viewer') {
        roles.push('viewer');
    }

    if (shareRole === 'editor') {
        roles.push('editor');
    }

    return roles;
};

// Xác định vai trò hiệu lực cao nhất
const getEffectiveRole = (roles) => {
    if (roles.includes('owner')) return 'owner';
    if (roles.includes('editor')) return 'editor';
    if (roles.includes('assignee')) return 'assignee';
    if (roles.includes('viewer')) return 'viewer';

    return null;
};

// ==========================================
// B. LẤY DANH SÁCH CÔNG VIỆC
// ==========================================

export const getTasks = async (req, res) => {
    try {
        const userId = req.userId;
        const scope = req.query.scope;

        const allowedScopes = [
            'created',
            'assigned',
            'shared'
        ];

        if (
            scope !== undefined &&
            !allowedScopes.includes(scope)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task scope'
            });
        }

        const sharedTaskIds = await TaskShare.distinct(
            'taskId',
            { userId }
        );

        let roleCondition;

        if (scope === 'created') {
            roleCondition = { createdBy: userId };
        } else if (scope === 'assigned') {
            roleCondition = { assigneeIds: userId };
        } else if (scope === 'shared') {
            roleCondition = {
                _id: { $in: sharedTaskIds }
            };
        } else {
            roleCondition = {
                $or: [
                    { createdBy: userId },
                    { assigneeIds: userId },
                    { _id: { $in: sharedTaskIds } }
                ]
            };
        }

        const conditions = [roleCondition];

        // Hỗ trợ cả search cũ và q theo tài liệu
        const search = req.query.q ?? req.query.search;

        if (search !== undefined) {
            if (typeof search !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid search keyword'
                });
            }

            const keyword = search.trim();

            if (keyword) {
                const escapedKeyword = keyword.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );

                conditions.push({
                    $or: [
                        {
                            title: {
                                $regex: escapedKeyword,
                                $options: 'i'
                            }
                        },
                        {
                            description: {
                                $regex: escapedKeyword,
                                $options: 'i'
                            }
                        }
                    ]
                });
            }
        }

        const filter = {
            $and: conditions
        };

        if (req.query.status !== undefined) {
            const allowedStatus = [
                'todo',
                'in_progress',
                'completed'
            ];

            if (
                typeof req.query.status !== 'string' ||
                !allowedStatus.includes(req.query.status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task status'
                });
            }

            filter.status = req.query.status;
        }

        if (req.query.priority !== undefined) {
            const allowedPriority = [
                'low',
                'medium',
                'high'
            ];

            if (
                typeof req.query.priority !== 'string' ||
                !allowedPriority.includes(req.query.priority)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid task priority'
                });
            }

            filter.priority = req.query.priority;
        }

        // Hỗ trợ cả order mới và sortOrder cũ
        const allowedSortFields = [
            'createdAt',
            'updatedAt',
            'title',
            'startDate',
            'dueDate',
            'priority',
            'status'
        ];

        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder =
            req.query.order ||
            req.query.sortOrder ||
            'desc';

        if (!allowedSortFields.includes(sortBy)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sort field'
            });
        }

        if (!['asc', 'desc'].includes(sortOrder)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sort order'
            });
        }

        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const tasks = await Task.find(filter)
            .populate('createdBy', 'fullName email avatarUrl')
            .populate('assigneeIds', 'fullName email avatarUrl')
            .populate('primaryAssigneeId', 'fullName email avatarUrl')
            .sort(
                sortBy === 'priority' || sortBy === 'status'
                    ? { createdAt: -1 }
                    : { [sortBy]: sortDirection }
            );

        if (sortBy === 'priority') {
            const priorityOrder = {
                low: 1,
                medium: 2,
                high: 3
            };

            tasks.sort((a, b) =>
                (
                    priorityOrder[a.priority] -
                    priorityOrder[b.priority]
                ) * sortDirection
            );
        }

        if (sortBy === 'status') {
            const statusOrder = {
                todo: 1,
                in_progress: 2,
                completed: 3
            };

            tasks.sort((a, b) =>
                (
                    statusOrder[a.status] -
                    statusOrder[b.status]
                ) * sortDirection
            );
        }

        // Lấy quyền chia sẻ của người dùng cho toàn bộ danh sách
        const taskIds = tasks.map(task => task._id);

        const shares = taskIds.length > 0
            ? await TaskShare.find({
                taskId: { $in: taskIds },
                userId
            }).select('taskId role')
            : [];

        const shareRoleMap = new Map(
            shares.map(share => [
                String(share.taskId),
                share.role
            ])
        );

        // Bổ sung vai trò truy cập cho từng công việc
        const resultTasks = tasks.map(task => {
            const shareRole = shareRoleMap.get(
                String(task._id)
            );

            const accessRoles = getAccessRoles(
                task,
                userId,
                shareRole
            );

            return {
                ...task.toObject(),
                accessRole: getEffectiveRole(accessRoles),
                accessRoles
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Get tasks successfully',
            total: resultTasks.length,
            tasks: resultTasks
        });

    } catch (error) {
        console.error('Get tasks error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ==========================================
// LẤY CHI TIẾT CÔNG VIỆC
// ==========================================

export const getTaskById = async (req, res) => {
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

        const access = await getTaskAccess(task, req.userId);

        if (!access.canView) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or access denied'
            });
        }

        await task.populate('createdBy', 'fullName email avatarUrl');
        await task.populate('assigneeIds', 'fullName email avatarUrl');
        await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Get task successfully',
            task,
            accessRole: access.accessRole,
            accessRoles: access.roles
        });

    } catch (error) {
        console.error('Get task detail error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ==========================================
// TẠO CÔNG VIỆC
// ==========================================

export const createTask = async (req, res) => {
    try {
        const {
            title,
            description = '',
            startDate,
            dueDate,
            priority = 'medium'
        } = req.body;

        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Task title is required'
            });
        }

        if (typeof description !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Task description must be a string'
            });
        }

        if (!['low', 'medium', 'high'].includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task priority'
            });
        }

        const parseDate = (value) => {
            if (
                value === undefined ||
                value === null ||
                value === ''
            ) {
                return { valid: true, date: null };
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return { valid: false, date: null };
            }

            return { valid: true, date };
        };

        const parsedStartDate = parseDate(startDate);
        const parsedDueDate = parseDate(dueDate);

        if (!parsedStartDate.valid || !parsedDueDate.valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task date'
            });
        }

        if (
            parsedStartDate.date &&
            parsedDueDate.date &&
            parsedDueDate.date < parsedStartDate.date
        ) {
            return res.status(400).json({
                success: false,
                message: 'Due date cannot be earlier than start date'
            });
        }

        const task = await Task.create({
            title: title.trim(),
            description: description.trim(),
            createdBy: req.userId,
            startDate: parsedStartDate.date,
            dueDate: parsedDueDate.date,
            priority
        });

        await task.populate(
            'createdBy',
            'fullName email avatarUrl'
        );

        return res.status(201).json({
            success: true,
            message: 'Task created successfully',
            task,
            accessRole: 'owner',
            accessRoles: ['owner']
        });

    } catch (error) {
        console.error('Create task error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ==========================================
// CẬP NHẬT THÔNG TIN CÔNG VIỆC
// ==========================================

export const updateTask = async (req, res) => {
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

        // Giữ nguyên kiểm tra quyền của nhóm C
        const access = await getTaskAccess(task, req.userId);

        if (!access.canEdit) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to edit this task'
            });
        }

        const {
            title,
            description,
            startDate,
            dueDate,
            priority
        } = req.body;

        // Lưu thông tin cũ để so sánh
        const previous = {
            title: task.title,
            description: task.description,
            startDate: task.startDate,
            dueDate: task.dueDate,
            priority: task.priority
        };

        // Kiểm tra tiêu đề
        if (title !== undefined) {
            if (typeof title !== 'string' || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Task title is required'
                });
            }
        }

        // Kiểm tra mô tả
        if (
            description !== undefined &&
            typeof description !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Task description must be a string'
            });
        }

        // Kiểm tra mức ưu tiên
        if (
            priority !== undefined &&
            !['low', 'medium', 'high'].includes(priority)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task priority'
            });
        }

        // Phân tích ngày tháng
        const parseDate = (value, currentDate) => {
            if (value === undefined) {
                return {
                    valid: true,
                    date: currentDate
                };
            }

            if (value === null || value === '') {
                return {
                    valid: true,
                    date: null
                };
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return {
                    valid: false,
                    date: null
                };
            }

            return {
                valid: true,
                date
            };
        };

        const parsedStartDate = parseDate(
            startDate,
            task.startDate
        );

        const parsedDueDate = parseDate(
            dueDate,
            task.dueDate
        );

        if (!parsedStartDate.valid || !parsedDueDate.valid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task date'
            });
        }

        if (
            parsedStartDate.date &&
            parsedDueDate.date &&
            parsedDueDate.date < parsedStartDate.date
        ) {
            return res.status(400).json({
                success: false,
                message: 'Due date cannot be earlier than start date'
            });
        }

        // Xác định thông tin mới
        const updatedTitle = title !== undefined
            ? title.trim()
            : previous.title;

        const updatedDescription = description !== undefined
            ? description.trim()
            : previous.description;

        const updatedPriority = priority !== undefined
            ? priority
            : previous.priority;

        const updatedStartDate = parsedStartDate.date;
        const updatedDueDate = parsedDueDate.date;

        // Chuẩn hóa ngày tháng thành timestamp để so sánh
        const getDateTime = (date) => {
            return date ? new Date(date).getTime() : null;
        };

        // Định dạng ngày tháng cho thông báo
        const formatDate = (date) => {
            if (!date) return 'Chưa thiết lập';

            const value = new Date(date)
                .toISOString()
                .slice(0, 10);

            const [year, month, day] = value.split('-');

            return `${day}/${month}/${year}`;
        };

        // Chuyển mức ưu tiên sang tiếng Việt
        const priorityLabels = {
            low: 'Thấp',
            medium: 'Trung bình',
            high: 'Cao'
        };

        // Xác định những nội dung thực sự thay đổi
        const changes = [];

        if (previous.title !== updatedTitle) {
            changes.push(
                `Tên công việc: "${previous.title}" → "${updatedTitle}"`
            );
        }

        if (previous.description !== updatedDescription) {
            changes.push('Mô tả công việc đã thay đổi');
        }

        if (
            getDateTime(previous.startDate) !==
            getDateTime(updatedStartDate)
        ) {
            changes.push(
                `Ngày bắt đầu: ${formatDate(previous.startDate)} → ${formatDate(updatedStartDate)}`
            );
        }

        if (
            getDateTime(previous.dueDate) !==
            getDateTime(updatedDueDate)
        ) {
            changes.push(
                `Hạn hoàn thành: ${formatDate(previous.dueDate)} → ${formatDate(updatedDueDate)}`
            );
        }

        if (previous.priority !== updatedPriority) {
            changes.push(
                `Mức ưu tiên: ${priorityLabels[previous.priority] || previous.priority} → ${priorityLabels[updatedPriority] || updatedPriority}`
            );
        }

        // Cập nhật dữ liệu công việc
        task.title = updatedTitle;
        task.description = updatedDescription;
        task.priority = updatedPriority;
        task.startDate = updatedStartDate;
        task.dueDate = updatedDueDate;

        await task.save();

        // Chỉ thông báo nếu dữ liệu thực sự thay đổi
        if (changes.length > 0) {
            try {
                // Lấy người được chia sẻ công việc
                const shares = await TaskShare.find({
                    taskId: task._id
                }).select('userId');

                // Gộp người tạo, người được giao và người được chia sẻ
                const recipientIds = [
                    task.createdBy,
                    ...(task.assigneeIds || []),
                    ...shares.map(share => share.userId)
                ]
                    .filter(Boolean)
                    .map(id => String(id));

                // Loại bỏ ID trùng và người đang thực hiện cập nhật
                const uniqueRecipientIds = [
                    ...new Set(recipientIds)
                ].filter(id => id !== String(req.userId));

                if (uniqueRecipientIds.length > 0) {
                    const changeSummary = changes.join('; ');

                    const notificationMessage = (
                        `Công việc "${task.title}" đã được cập nhật. ` +
                        `Nội dung thay đổi: ${changeSummary}`
                    ).slice(0, 500);

                    // Tạo thông báo trong ứng dụng
                    try {
                        const notificationDocs =
                            uniqueRecipientIds.map(userId => ({
                                userId,
                                actorId: req.userId,
                                taskId: task._id,
                                type: 'task_updated',
                                title: 'Thông tin công việc đã thay đổi',
                                message: notificationMessage
                            }));

                        await Notification.insertMany(
                            notificationDocs
                        );
                    } catch (notificationError) {
                        console.error(
                            'Create task update notifications error:',
                            notificationError.message
                        );
                    }

                    // Gửi email cho người liên quan
                    try {
                        const recipients = await User.find({
                            _id: {
                                $in: uniqueRecipientIds
                            }
                        }).select('_id fullName email');

                        const actorName =
                            req.user?.fullName || 'Một thành viên';

                        for (const recipient of recipients) {
                            if (!recipient.email) continue;

                            const emailResult =
                                await sendNotificationEmail({
                                    recipientEmail: recipient.email,
                                    recipientUserId: recipient._id,
                                    taskId: task._id,
                                    eventType: 'task_updated',
                                    subject: (
                                        `Thông tin công việc đã thay đổi: ${task.title}`
                                    ).slice(0, 255),
                                    text: `Xin chào ${recipient.fullName || 'bạn'},

${actorName} vừa cập nhật công việc "${task.title}".

Các nội dung thay đổi:
${changes.map(change => `- ${change}`).join('\n')}

Hãy đăng nhập vào Task Manager để xem chi tiết công việc.

Trân trọng,
Task Manager`
                                });

                            if (!emailResult.success) {
                                console.error(
                                    `Task update email failed for ${recipient.email}:`,
                                    emailResult.errorMessage
                                );
                            }
                        }
                    } catch (emailError) {
                        console.error(
                            'Task update email processing error:',
                            emailError.message
                        );
                    }
                }
            } catch (recipientError) {
                console.error(
                    'Get task update recipients error:',
                    recipientError.message
                );
            }
        }

        // Populate dữ liệu trả về
        await task.populate(
            'createdBy',
            'fullName email avatarUrl'
        );

        await task.populate(
            'assigneeIds',
            'fullName email avatarUrl'
        );

        await task.populate(
            'primaryAssigneeId',
            'fullName email avatarUrl'
        );

        return res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            task,
            accessRole: access.accessRole,
            accessRoles: access.roles
        });

    } catch (error) {
        console.error('Update task error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ==========================================
// XÓA CÔNG VIỆC
// ==========================================

export const deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        // Chỉ Owner được xóa công việc
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

        await task.deleteOne();

        await TaskShare.deleteMany({
            taskId: task._id
        });

        return res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('Delete task error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// ==========================================
// CẬP NHẬT TRẠNG THÁI CÔNG VIỆC
// ==========================================

export const updateTaskStatus = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { status } = req.body;

        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID'
            });
        }

        if (
            typeof status !== 'string' ||
            !['todo', 'in_progress', 'completed'].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task status'
            });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const access = await getTaskAccess(task, req.userId);

        if (!access.canUpdateStatus) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update task status'
            });
        }

        const previousStatus = task.status;

        task.status = status;
        await task.save();

        // Chỉ thông báo và gửi email khi trạng thái thực sự thay đổi
        if (previousStatus !== status) {
            const statusMessage =
                `Công việc "${task.title}" đã thay đổi từ ` +
                `"${getStatusLabel(previousStatus)}" sang ` +
                `"${getStatusLabel(status)}".`;

            try {
                const shares = await TaskShare.find({
                    taskId: task._id
                }).select('userId');

                const recipientIds = [
                    task.createdBy,
                    ...(task.assigneeIds || []),
                    ...shares.map(share => share.userId)
                ]
                    .filter(Boolean)
                    .map(id => String(id));

                const uniqueRecipientIds = [
                    ...new Set(recipientIds)
                ].filter(id => id !== String(req.userId));

                if (uniqueRecipientIds.length > 0) {
                    const notificationDocs = uniqueRecipientIds.map(
                        userId => ({
                            userId,
                            actorId: req.userId,
                            taskId: task._id,
                            type: 'task_status_changed',
                            title: 'Trạng thái công việc đã thay đổi',
                            message: statusMessage
                        })
                    );

                    try {
                        await Notification.insertMany(notificationDocs);
                    } catch (notificationError) {
                        console.error(
                            'Create status notifications error:',
                            notificationError.message
                        );
                    }

                    try {
                        const recipients = await User.find({
                            _id: { $in: uniqueRecipientIds }
                        }).select('_id fullName email');

                        const actorName =
                            req.user?.fullName || 'Thành viên';

                        for (const recipient of recipients) {
                            if (!recipient.email) continue;

                            const emailResult =
                                await sendNotificationEmail({
                                    recipientEmail: recipient.email,
                                    recipientUserId: recipient._id,
                                    taskId: task._id,
                                    eventType: 'task_status_changed',
                                    subject:
                                        `Trạng thái công việc đã thay đổi: ${task.title}`,
                                    text: `Xin chào ${recipient.fullName || 'bạn'},

${actorName} vừa thay đổi trạng thái công việc "${task.title}".

Trạng thái trước đó: ${getStatusLabel(previousStatus)}.
Trạng thái hiện tại: ${getStatusLabel(status)}.

Hãy đăng nhập vào Task Manager để theo dõi công việc.

Trân trọng,
Task Manager`
                                });

                            if (!emailResult.success) {
                                console.error(
                                    `Task status email failed for ${recipient.email}:`,
                                    emailResult.errorMessage
                                );
                            }
                        }
                    } catch (emailError) {
                        console.error(
                            'Task status email processing error:',
                            emailError.message
                        );
                    }
                }
            } catch (recipientError) {
                console.error(
                    'Get task notification recipients error:',
                    recipientError.message
                );
            }
        }

        await task.populate('createdBy', 'fullName email avatarUrl');
        await task.populate('assigneeIds', 'fullName email avatarUrl');
        await task.populate('primaryAssigneeId', 'fullName email avatarUrl');

        return res.status(200).json({
            success: true,
            message: 'Task status updated successfully',
            task,
            accessRole: access.accessRole,
            accessRoles: access.roles
        });

    } catch (error) {
        console.error('Update task status error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
