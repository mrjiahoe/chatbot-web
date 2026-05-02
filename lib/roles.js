export const DEFAULT_ROLE = 'user';

export const PERMISSIONS = Object.freeze({
    ACCESS_CHAT: 'access_chat',
    VIEW_CHAT_HISTORY: 'view_chat_history',
    ACCESS_DATA_SOURCES: 'access_data_sources',
    PREVIEW_DATA_SOURCES: 'preview_data_sources',
    USE_CHAT_DATA_CONTEXT: 'use_chat_data_context',
    ACCESS_ROLE_DASHBOARD: 'access_role_dashboard',
    MANAGE_USER_ROLES: 'manage_user_roles',
});

export const ROLE_DEFINITIONS = Object.freeze([
    {
        value: 'inactive',
        label: 'Inactive',
        description: 'Signed-in account without active workspace access.',
        permissions: [],
        managed: false,
    },
    {
        value: 'super_admin',
        label: 'Super Admin',
        description: 'Full access to user-role management and future system controls.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
            PERMISSIONS.ACCESS_DATA_SOURCES,
            PERMISSIONS.PREVIEW_DATA_SOURCES,
            PERMISSIONS.USE_CHAT_DATA_CONTEXT,
            PERMISSIONS.ACCESS_ROLE_DASHBOARD,
            PERMISSIONS.MANAGE_USER_ROLES,
        ],
        managed: true,
    },
    {
        value: 'owner',
        label: 'Owner',
        description: 'Workspace owner with elevated access across chat and data workflows.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
            PERMISSIONS.ACCESS_DATA_SOURCES,
            PERMISSIONS.PREVIEW_DATA_SOURCES,
            PERMISSIONS.USE_CHAT_DATA_CONTEXT,
        ],
        managed: true,
    },
    {
        value: 'admin',
        label: 'Admin',
        description: 'Administrative user with access to chat, history, and data sources.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
            PERMISSIONS.ACCESS_DATA_SOURCES,
            PERMISSIONS.PREVIEW_DATA_SOURCES,
            PERMISSIONS.USE_CHAT_DATA_CONTEXT,
        ],
        managed: true,
    },
    {
        value: 'principal',
        label: 'Principal / Management',
        description: 'Management user with school-scoped access to chat and data exploration.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
            PERMISSIONS.ACCESS_DATA_SOURCES,
            PERMISSIONS.PREVIEW_DATA_SOURCES,
            PERMISSIONS.USE_CHAT_DATA_CONTEXT,
        ],
        managed: false,
    },
    {
        value: 'analyst',
        label: 'Analyst',
        description: 'Reporting analyst with broad read access for analytics workflows.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
            PERMISSIONS.ACCESS_DATA_SOURCES,
            PERMISSIONS.PREVIEW_DATA_SOURCES,
            PERMISSIONS.USE_CHAT_DATA_CONTEXT,
        ],
        managed: false,
    },
    {
        value: 'teacher',
        label: 'Teacher / Staff',
        description: 'Teaching or staff account with scoped chat and data access.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
            PERMISSIONS.ACCESS_DATA_SOURCES,
            PERMISSIONS.PREVIEW_DATA_SOURCES,
            PERMISSIONS.USE_CHAT_DATA_CONTEXT,
        ],
        managed: false,
    },
    {
        value: 'user',
        label: 'User',
        description: 'Standard end-user access for chat and personal chat history.',
        permissions: [
            PERMISSIONS.ACCESS_CHAT,
            PERMISSIONS.VIEW_CHAT_HISTORY,
        ],
        managed: true,
    },
]);

const ROLE_DEFINITION_MAP = new Map(
    ROLE_DEFINITIONS.map((definition) => [definition.value, definition])
);

export const ROLE_OPTIONS = ROLE_DEFINITIONS.map(({ value, label, description, managed = false }) => ({
    value,
    label,
    description,
    managed,
}));

export function normalizeRole(role) {
    return ROLE_DEFINITION_MAP.has(role) ? role : DEFAULT_ROLE;
}

export function getRoleDefinition(role) {
    return ROLE_DEFINITION_MAP.get(normalizeRole(role)) || ROLE_DEFINITION_MAP.get(DEFAULT_ROLE);
}

export function getRoleOptions() {
    return ROLE_OPTIONS;
}

export function getAssignableRoleOptions(actorRole) {
    return canManageUserRoles(actorRole)
        ? ROLE_OPTIONS.filter((option) => option.managed)
        : [];
}

export function formatRoleLabel(role) {
    return getRoleDefinition(role)?.label || getRoleDefinition(DEFAULT_ROLE).label;
}

export function getRoleDescription(role) {
    return getRoleDefinition(role)?.description || getRoleDefinition(DEFAULT_ROLE).description;
}

export function hasPermission(role, permission) {
    return getRoleDefinition(role).permissions.includes(permission);
}

export function canAccessRoleDashboard(role) {
    return normalizeRole(role) === 'super_admin';
}

export function canAccessChat(role) {
    return hasPermission(role, PERMISSIONS.ACCESS_CHAT);
}

export function canViewChatHistory(role) {
    return hasPermission(role, PERMISSIONS.VIEW_CHAT_HISTORY);
}

export function canAccessDataSources(role) {
    return hasPermission(role, PERMISSIONS.ACCESS_DATA_SOURCES);
}

export function canPreviewDataSources(role) {
    return hasPermission(role, PERMISSIONS.PREVIEW_DATA_SOURCES);
}

export function canUseChatDataContext(role) {
    return hasPermission(role, PERMISSIONS.USE_CHAT_DATA_CONTEXT);
}

export function canManageUserRoles(role) {
    return normalizeRole(role) === 'super_admin';
}

export function canManageRoles(role) {
    return canManageUserRoles(role);
}
