export const ROLE_OPTIONS = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
];

export function canManageRoles(role) {
    return role === 'super_admin' || role === 'owner';
}

export function formatRoleLabel(role) {
    const match = ROLE_OPTIONS.find((option) => option.value === role);

    if (match) {
        return match.label;
    }

    return (role || 'user')
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
