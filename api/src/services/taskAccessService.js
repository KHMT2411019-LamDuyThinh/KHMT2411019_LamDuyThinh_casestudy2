
import TaskShare from '../models/TaskShare.js';

// Chuyển ObjectId hoặc populated document thành chuỗi ID
const normalizeId = (value) => {
    if (!value) return null;

    return String(value._id ?? value);
};

/**
 * Xác định toàn bộ vai trò và quyền của người dùng
 * đối với một công việc.
 *
 * Một người có thể đồng thời là:
 * - Owner
 * - Assignee
 * - Viewer
 * - Editor
 *
 * Thứ tự quyền hiệu lực:
 * Owner > Editor > Assignee > Viewer
 */
export const getTaskAccess = async (task, userId) => {
    if (!task || !userId) {
        return {
            canView: false,
            canEdit: false,
            canUpdateStatus: false,
            canManageCollaboration: false,
            isOwner: false,
            isAssignee: false,
            isViewer: false,
            isEditor: false,
            shareRole: null,
            roles: [],
            accessRole: null
        };
    }

    const currentUserId = normalizeId(userId);

    // 1. Kiểm tra Owner
    const isOwner =
        normalizeId(task.createdBy) === currentUserId;

    // 2. Kiểm tra Assignee
    const isAssignee = (task.assigneeIds || []).some(
        id => normalizeId(id) === currentUserId
    );

    // 3. Kiểm tra quyền chia sẻ độc lập với Assignee
    const share = await TaskShare.findOne({
        taskId: task._id,
        userId
    }).select('role');

    const shareRole = share?.role ?? null;

    const isViewer = shareRole === 'viewer';
    const isEditor = shareRole === 'editor';

    // 4. Thu thập tất cả vai trò
    const roles = [];

    if (isOwner) roles.push('owner');
    if (isAssignee) roles.push('assignee');
    if (isViewer) roles.push('viewer');
    if (isEditor) roles.push('editor');

    const canView = roles.length > 0;

    // 5. Xác định vai trò hiệu lực
    let accessRole = null;

    if (isOwner) {
        accessRole = 'owner';
    } else if (isEditor) {
        accessRole = 'editor';
    } else if (isAssignee) {
        accessRole = 'assignee';
    } else if (isViewer) {
        accessRole = 'viewer';
    }

    // 6. Xác định quyền thực tế
    const canEdit = isOwner || isEditor;

    const canUpdateStatus =
        isOwner || isEditor || isAssignee;

    const canManageCollaboration = isOwner;

    return {
        canView,
        canEdit,
        canUpdateStatus,
        canManageCollaboration,

        isOwner,
        isAssignee,
        isViewer,
        isEditor,

        shareRole,
        roles,
        accessRole
    };
};
