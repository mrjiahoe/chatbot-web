'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCcw, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    canAccessRoleDashboard,
    canDeleteUsers,
    canManageSuperAdminAssignments,
    canManageUserRoles,
    formatRoleLabel,
} from '@/lib/roles';

function formatDate(value) {
    if (!value) {
        return 'N/A';
    }

    return new Date(value).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatName(user) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    if (fullName) {
        return fullName;
    }

    return user.nickname || user.username || user.email || 'Unknown user';
}

const baseAccountFlagColumns = [
    { key: 'is_active', label: 'Active' },
    { key: 'is_superuser', label: 'Super' },
    { key: 'is_admin', label: 'Admin' },
    { key: 'is_management', label: 'Mgmt' },
    { key: 'is_principal', label: 'Principal' },
    { key: 'is_cluster_head', label: 'Cluster' },
    { key: 'is_ra', label: 'Analyst' },
    { key: 'is_teacher', label: 'Teacher' },
    { key: 'is_staff', label: 'Staff' },
];

function deriveScopeWarning(baseAccountFlags, schoolScopeId) {
    return baseAccountFlags?.is_teacher && !schoolScopeId
        ? 'Teacher accounts must have a school assignment.'
        : null;
}

function mergeUpdatedUser(currentUser, updatedUser, overrides = {}) {
    const nextSchoolScopeId = updatedUser?.schoolScopeId ?? currentUser.schoolScopeId ?? null;

    return {
        ...currentUser,
        effectiveRole: updatedUser?.effectiveRole || currentUser.effectiveRole,
        roleSource: updatedUser?.roleSource || currentUser.roleSource,
        baseAccountFlags: updatedUser?.baseAccountFlags || currentUser.baseAccountFlags,
        schoolScopeId: nextSchoolScopeId,
        schoolScopeName:
            overrides.schoolScopeName !== undefined
                ? overrides.schoolScopeName
                : currentUser.schoolScopeName,
        scopeWarning:
            overrides.scopeWarning !== undefined
                ? overrides.scopeWarning
                : deriveScopeWarning(
                    updatedUser?.baseAccountFlags || currentUser.baseAccountFlags,
                    nextSchoolScopeId
                ),
    };
}

function buildConfirmationConfig({ scope = 'single', actionType, userName, count = null, flagKey = null }) {
    const targetLabel =
        scope === 'bulk'
            ? `${count} user${count === 1 ? '' : 's'}`
            : userName;

    if (actionType === 'clear_school_scope') {
        return {
            title:
                scope === 'bulk'
                    ? `Clear school assignments for ${targetLabel}?`
                    : 'Clear school assignment?',
            description:
                scope === 'bulk'
                    ? 'Selected users will no longer have a school linked in base_account.school_name_id.'
                    : `${targetLabel} will no longer have a school linked in base_account.school_name_id.`,
            confirmLabel: scope === 'bulk' ? 'Clear assignments' : 'Clear assignment',
            confirmVariant: 'destructive',
        };
    }

    if (flagKey === 'is_teacher') {
        return {
            title:
                scope === 'bulk'
                    ? `Remove Teacher access for ${targetLabel}?`
                    : 'Remove Teacher access?',
            description:
                scope === 'bulk'
                    ? 'Selected users will immediately lose teacher-scoped access until Teacher is enabled again.'
                    : `${targetLabel} will immediately lose teacher-scoped access until Teacher is enabled again.`,
            confirmLabel: 'Remove Teacher',
            confirmVariant: 'destructive',
        };
    }

    if (flagKey === 'is_superuser') {
        return {
            title:
                scope === 'bulk'
                    ? `Grant Super Admin access to ${targetLabel}?`
                    : 'Grant Super Admin access?',
            description:
                scope === 'bulk'
                    ? 'Selected users will gain the highest level of administrative access in the workspace.'
                    : `${targetLabel} will gain the highest level of administrative access in the workspace.`,
            confirmLabel: 'Grant Super Admin',
            confirmVariant: 'default',
        };
    }

    if (flagKey === 'is_admin') {
        return {
            title:
                scope === 'bulk'
                    ? `Grant Admin access to ${targetLabel}?`
                    : 'Grant Admin access?',
            description:
                scope === 'bulk'
                    ? 'Selected users will gain elevated administrative access across the workspace.'
                    : `${targetLabel} will gain elevated administrative access across the workspace.`,
            confirmLabel: 'Grant Admin',
            confirmVariant: 'default',
        };
    }

    if (actionType === 'toggle_block') {
        const isBlocking = flagKey === 'block';

        return {
            title:
                scope === 'bulk'
                    ? `${isBlocking ? 'Block' : 'Unblock'} ${targetLabel}?`
                    : `${isBlocking ? 'Block' : 'Unblock'} user?`,
            description: isBlocking
                ? `${targetLabel} will no longer be able to log in or use the chatbot until access is restored.`
                : `${targetLabel} will be able to log in and use the chatbot again.`,
            confirmLabel: isBlocking ? 'Block user' : 'Unblock user',
            confirmVariant: isBlocking ? 'destructive' : 'default',
        };
    }

    if (actionType === 'delete_user') {
        return {
            title: scope === 'bulk' ? `Delete ${targetLabel}?` : 'Delete user?',
            description:
                scope === 'bulk'
                    ? 'This will permanently remove the selected auth accounts, profiles, and saved chat history. Any linked base_account rows will be unlinked and deactivated.'
                    : `${targetLabel}'s auth account, profile, and saved chat history will be permanently removed. Any linked base_account row will be unlinked and deactivated.`,
            confirmLabel: scope === 'bulk' ? 'Delete users' : 'Delete user',
            confirmVariant: 'destructive',
        };
    }

    return null;
}

const UserRolesView = ({ currentRole }) => {
    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [savingUserId, setSavingUserId] = useState(null);
    const [error, setError] = useState(null);
    const [banner, setBanner] = useState({ type: '', text: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [linkFilter, setLinkFilter] = useState('all');
    const [schoolFilter, setSchoolFilter] = useState('all');
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [bulkFlagKey, setBulkFlagKey] = useState('is_active');
    const [bulkFlagValue, setBulkFlagValue] = useState('enable');
    const [bulkSchoolId, setBulkSchoolId] = useState('');
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const hasAccess = canAccessRoleDashboard(currentRole);
    const canEditRoles = canManageUserRoles(currentRole);
    const canManageSuperAdmins = canManageSuperAdminAssignments(currentRole);
    const canRemoveUsers = canDeleteUsers(currentRole);
    const visibleFlagColumns = useMemo(
        () =>
            canManageSuperAdmins
                ? baseAccountFlagColumns
                : baseAccountFlagColumns.filter((column) => column.key !== 'is_superuser'),
        [canManageSuperAdmins]
    );

    const canManageTargetUser = useCallback(
        (user) => canManageSuperAdmins || !user?.baseAccountFlags?.is_superuser,
        [canManageSuperAdmins]
    );

    const sortedUsers = useMemo(
        () => [...users].sort((left, right) => {
            const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            return rightDate - leftDate;
        }),
        [users]
    );

    const filterOptions = useMemo(() => {
        const availableRoles = Array.from(
            new Set(users.map((user) => user.effectiveRole).filter(Boolean))
        ).sort((left, right) => formatRoleLabel(left).localeCompare(formatRoleLabel(right)));

        return {
            roles: availableRoles,
            schools: [...schools].sort((left, right) => left.name.localeCompare(right.name)),
        };
    }, [schools, users]);

    const filteredUsers = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return sortedUsers.filter((user) => {
            const matchesSearch =
                normalizedQuery.length === 0 ||
                [
                    formatName(user),
                    user.username,
                    user.nickname,
                    user.email,
                    user.schoolScopeName,
                ]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(normalizedQuery));

            const matchesRole =
                roleFilter === 'all' || user.effectiveRole === roleFilter;

            const matchesLink =
                linkFilter === 'all' ||
                (linkFilter === 'linked' && user.roleSource === 'base_account') ||
                (linkFilter === 'unlinked' && user.roleSource !== 'base_account');

            const matchesSchool =
                schoolFilter === 'all' ||
                (schoolFilter === 'unassigned' && !user.schoolScopeId) ||
                user.schoolScopeId === schoolFilter;

            return matchesSearch && matchesRole && matchesLink && matchesSchool;
        });
    }, [linkFilter, roleFilter, schoolFilter, searchQuery, sortedUsers]);

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        roleFilter !== 'all' ||
        linkFilter !== 'all' ||
        schoolFilter !== 'all';

    const selectedUsers = useMemo(
        () => users.filter((user) => selectedUserIds.includes(user.id)),
        [selectedUserIds, users]
    );

    const selectedLinkedUsers = useMemo(
        () => selectedUsers.filter((user) => user.roleSource === 'base_account' && canManageTargetUser(user)),
        [canManageTargetUser, selectedUsers]
    );

    const selectableFilteredUsers = useMemo(
        () => filteredUsers.filter((user) => user.roleSource === 'base_account' && canManageTargetUser(user)),
        [canManageTargetUser, filteredUsers]
    );

    const allVisibleLinkedSelected =
        selectableFilteredUsers.length > 0 &&
        selectableFilteredUsers.every((user) => selectedUserIds.includes(user.id));

    const bulkTeacherNeedsSchool = bulkFlagKey === 'is_teacher' && bulkFlagValue === 'enable';

    const loadUsers = useCallback(async ({ silent = false } = {}) => {
        if (!hasAccess) {
            setIsLoading(false);
            return;
        }

        if (silent) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        setError(null);

        try {
            const response = await fetch('/api/admin/users', {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to load users.');
            }

            setUsers(payload.users || []);
            setSchools(payload.schools || []);
        } catch (loadError) {
            setError(loadError.message || 'Unable to load users.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [hasAccess]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        setSelectedUserIds((currentIds) =>
            currentIds.filter((id) => users.some((user) => user.id === id && canManageTargetUser(user)))
        );
    }, [canManageTargetUser, users]);

    useEffect(() => {
        if (visibleFlagColumns.some((column) => column.key === bulkFlagKey)) {
            return;
        }

        setBulkFlagKey(visibleFlagColumns[0]?.key || 'is_active');
    }, [bulkFlagKey, visibleFlagColumns]);

    const patchAdminUser = async ({ userId, baseAccountFlags, schoolNameId, fallbackErrorMessage }) => {
        const response = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                ...(baseAccountFlags ? { baseAccountFlags } : {}),
                ...(schoolNameId !== undefined ? { schoolNameId } : {}),
            }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload?.error || fallbackErrorMessage);
        }

        return payload.user;
    };

    const deleteAdminUser = async ({ userId, fallbackErrorMessage }) => {
        const response = await fetch('/api/admin/users', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload?.error || fallbackErrorMessage);
        }

        return payload;
    };

    const executeBaseAccountFlagChange = async (userId, flagKey, checked) => {
        const previousUsers = users;
        const targetUser = users.find((user) => user.id === userId);

        if (
            flagKey === 'is_teacher' &&
            checked === true &&
            targetUser?.roleSource === 'base_account' &&
            !targetUser?.schoolScopeId
        ) {
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? {
                            ...user,
                            baseAccountFlags: {
                                ...user.baseAccountFlags,
                                is_teacher: true,
                            },
                            scopeWarning: 'Select a school to finish enabling Teacher access.',
                        }
                        : user
                )
            );
            setBanner({
                type: 'error',
                text: 'Choose a school from the dropdown to complete Teacher access.',
            });
            return;
        }

        setSavingUserId(userId);
        setBanner({ type: '', text: '' });
        setUsers((currentUsers) =>
            currentUsers.map((user) =>
                user.id === userId
                    ? {
                        ...user,
                        baseAccountFlags: {
                            ...user.baseAccountFlags,
                            [flagKey]: checked,
                        },
                        ...(flagKey === 'is_teacher' && checked === false
                            ? { scopeWarning: null }
                            : {}),
                    }
                    : user
            )
        );

        try {
            const updatedUser = await patchAdminUser({
                userId,
                baseAccountFlags: {
                    [flagKey]: checked,
                },
                fallbackErrorMessage: 'Unable to update access flags.',
            });

            setBanner({
                type: 'success',
                text: 'Access flags updated successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? mergeUpdatedUser(user, updatedUser)
                        : user
                )
            );
            await loadUsers({ silent: true });
        } catch (updateError) {
            setUsers(previousUsers);
            setBanner({
                type: 'error',
                text: updateError.message || 'Unable to update access flags.',
            });
        } finally {
            setSavingUserId(null);
        }
    };

    const handleBaseAccountFlagChange = async (userId, flagKey, checked) => {
        const targetUser = users.find((user) => user.id === userId);
        const confirmationConfig = buildConfirmationConfig({
            actionType: 'update_flag',
            userName: formatName(targetUser || {}),
            flagKey,
        });
        const requiresConfirmation =
            (flagKey === 'is_teacher' && checked === false) ||
            (flagKey === 'is_superuser' && checked === true) ||
            (flagKey === 'is_admin' && checked === true);

        if (requiresConfirmation && confirmationConfig) {
            setPendingConfirmation({
                ...confirmationConfig,
                action: {
                    type: 'single_flag',
                    userId,
                    flagKey,
                    checked,
                },
            });
            return;
        }

        await executeBaseAccountFlagChange(userId, flagKey, checked);
    };

    const handleSchoolScopeChange = async (userId, schoolId) => {
        const previousUsers = users;
        const selectedSchool = schools.find((school) => school.id === schoolId);

        setSavingUserId(userId);
        setBanner({ type: '', text: '' });
        setUsers((currentUsers) =>
            currentUsers.map((user) =>
                user.id === userId
                    ? {
                        ...user,
                        schoolScopeId: schoolId,
                        schoolScopeName: selectedSchool?.name || schoolId,
                        scopeWarning: null,
                    }
                    : user
            )
        );

        try {
            const updatedUser = await patchAdminUser({
                userId,
                schoolNameId: schoolId,
                baseAccountFlags: { is_teacher: true },
                fallbackErrorMessage: 'Unable to update school scope.',
            });

            setBanner({
                type: 'success',
                text: 'School scope updated successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? mergeUpdatedUser(user, updatedUser, {
                            schoolScopeName: selectedSchool?.name || user.schoolScopeName,
                            scopeWarning: null,
                        })
                        : user
                )
            );
            await loadUsers({ silent: true });
        } catch (updateError) {
            setUsers(previousUsers);
            setBanner({
                type: 'error',
                text: updateError.message || 'Unable to update school scope.',
            });
        } finally {
            setSavingUserId(null);
        }
    };

    const executeClearSchoolScope = async (userId) => {
        const previousUsers = users;

        setSavingUserId(userId);
        setBanner({ type: '', text: '' });
        setUsers((currentUsers) =>
            currentUsers.map((user) =>
                user.id === userId
                    ? {
                        ...user,
                        schoolScopeId: null,
                        schoolScopeName: null,
                        scopeWarning: null,
                    }
                    : user
            )
        );

        try {
            const updatedUser = await patchAdminUser({
                userId,
                schoolNameId: null,
                fallbackErrorMessage: 'Unable to clear school scope.',
            });

            setBanner({
                type: 'success',
                text: 'School scope cleared successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? mergeUpdatedUser(user, updatedUser, {
                            schoolScopeName: null,
                            scopeWarning: null,
                        })
                        : user
                )
            );
            await loadUsers({ silent: true });
        } catch (updateError) {
            setUsers(previousUsers);
            setBanner({
                type: 'error',
                text: updateError.message || 'Unable to clear school scope.',
            });
        } finally {
            setSavingUserId(null);
        }
    };

    const handleClearSchoolScope = (userId) => {
        const targetUser = users.find((user) => user.id === userId);
        const confirmationConfig = buildConfirmationConfig({
            actionType: 'clear_school_scope',
            userName: formatName(targetUser || {}),
        });

        setPendingConfirmation({
            ...confirmationConfig,
            action: {
                type: 'single_clear_school_scope',
                userId,
            },
        });
    };

    const toggleUserSelection = (userId, checked) => {
        setSelectedUserIds((currentIds) =>
            checked
                ? [...new Set([...currentIds, userId])]
                : currentIds.filter((id) => id !== userId)
        );
    };

    const toggleVisibleLinkedSelection = (checked) => {
        setSelectedUserIds((currentIds) => {
            const visibleIds = selectableFilteredUsers.map((user) => user.id);

            if (checked) {
                return [...new Set([...currentIds, ...visibleIds])];
            }

            return currentIds.filter((id) => !visibleIds.includes(id));
        });
    };

    const executeBulkFlagChange = async () => {
        if (!selectedLinkedUsers.length) {
            setBanner({
                type: 'error',
                text: 'Select at least one linked user to run a bulk action.',
            });
            return;
        }

        if (bulkFlagKey === 'is_superuser' && !canManageSuperAdmins) {
            setBanner({
                type: 'error',
                text: 'Only Super Admins can grant or revoke Super Admin access.',
            });
            return;
        }

        if (bulkTeacherNeedsSchool && !bulkSchoolId) {
            setBanner({
                type: 'error',
                text: 'Choose a school before bulk enabling Teacher access.',
            });
            return;
        }

        setIsBulkSaving(true);
        setBanner({ type: '', text: '' });

        let successCount = 0;
        let firstError = null;

        try {
            for (const user of selectedLinkedUsers) {
                try {
                    await patchAdminUser({
                        userId: user.id,
                        baseAccountFlags: {
                            [bulkFlagKey]: bulkFlagValue === 'enable',
                        },
                        schoolNameId: bulkTeacherNeedsSchool ? bulkSchoolId : undefined,
                        fallbackErrorMessage: 'Unable to update one or more users.',
                    });
                    successCount += 1;
                } catch (updateError) {
                    if (!firstError) {
                        firstError = updateError;
                    }
                }
            }

            if (successCount > 0) {
                await loadUsers({ silent: true });
            }

            if (successCount === selectedLinkedUsers.length) {
                setBanner({
                    type: 'success',
                    text: `Updated ${successCount} user${successCount === 1 ? '' : 's'} successfully.`,
                });
                setSelectedUserIds([]);
            } else if (successCount > 0) {
                setBanner({
                    type: 'error',
                    text: `Updated ${successCount} user${successCount === 1 ? '' : 's'}, but ${selectedLinkedUsers.length - successCount} failed. ${firstError?.message || ''}`.trim(),
                });
            } else {
                throw firstError || new Error('Unable to update the selected users.');
            }
        } catch (bulkError) {
            setBanner({
                type: 'error',
                text: bulkError.message || 'Unable to update the selected users.',
            });
        } finally {
            setIsBulkSaving(false);
        }
    };

    const handleBulkFlagChange = async () => {
        const confirmationConfig = buildConfirmationConfig({
            scope: 'bulk',
            actionType: 'update_flag',
            count: selectedLinkedUsers.length,
            flagKey: bulkFlagKey,
        });
        const requiresConfirmation =
            (bulkFlagKey === 'is_teacher' && bulkFlagValue === 'disable') ||
            (bulkFlagKey === 'is_superuser' && bulkFlagValue === 'enable') ||
            (bulkFlagKey === 'is_admin' && bulkFlagValue === 'enable');

        if (requiresConfirmation && confirmationConfig) {
            setPendingConfirmation({
                ...confirmationConfig,
                action: {
                    type: 'bulk_flag',
                },
            });
            return;
        }

        await executeBulkFlagChange();
    };

    const executeBulkClearSchoolScope = async () => {
        const eligibleUsers = selectedLinkedUsers.filter(
            (user) => user.schoolScopeId && !user.baseAccountFlags?.is_teacher
        );

        if (!eligibleUsers.length) {
            setBanner({
                type: 'error',
                text: 'Select linked non-teacher users with a saved school assignment to clear scope in bulk.',
            });
            return;
        }

        setIsBulkSaving(true);
        setBanner({ type: '', text: '' });

        let successCount = 0;
        let firstError = null;

        try {
            for (const user of eligibleUsers) {
                try {
                    await patchAdminUser({
                        userId: user.id,
                        schoolNameId: null,
                        fallbackErrorMessage: 'Unable to clear one or more school assignments.',
                    });
                    successCount += 1;
                } catch (updateError) {
                    if (!firstError) {
                        firstError = updateError;
                    }
                }
            }

            if (successCount > 0) {
                await loadUsers({ silent: true });
            }

            if (successCount === eligibleUsers.length) {
                setBanner({
                    type: 'success',
                    text: `Cleared school scope for ${successCount} user${successCount === 1 ? '' : 's'}.`,
                });
                setSelectedUserIds((currentIds) => currentIds.filter((id) => !eligibleUsers.some((user) => user.id === id)));
            } else if (successCount > 0) {
                setBanner({
                    type: 'error',
                    text: `Cleared ${successCount} school assignment${successCount === 1 ? '' : 's'}, but ${eligibleUsers.length - successCount} failed. ${firstError?.message || ''}`.trim(),
                });
            } else {
                throw firstError || new Error('Unable to clear school assignments for the selected users.');
            }
        } catch (bulkError) {
            setBanner({
                type: 'error',
                text: bulkError.message || 'Unable to clear school assignments for the selected users.',
            });
        } finally {
            setIsBulkSaving(false);
        }
    };

    const executeBlockToggle = async (userId, shouldBlock) => {
        const previousUsers = users;
        const targetUser = users.find((user) => user.id === userId);

        if (!targetUser) {
            return;
        }

        if (targetUser.roleSource !== 'base_account') {
            setBanner({
                type: 'error',
                text: 'Only users linked to base_account can be blocked.',
            });
            return;
        }

        if (targetUser.isCurrentUser) {
            setBanner({
                type: 'error',
                text: 'You cannot block your own account.',
            });
            return;
        }

        setSavingUserId(userId);
        setBanner({ type: '', text: '' });

        try {
            const updatedUser = await patchAdminUser({
                userId,
                baseAccountFlags: {
                    is_active: !shouldBlock,
                },
                fallbackErrorMessage: shouldBlock
                    ? 'Unable to block this user.'
                    : 'Unable to unblock this user.',
            });

            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? mergeUpdatedUser(user, updatedUser)
                        : user
                )
            );
            setBanner({
                type: 'success',
                text: shouldBlock
                    ? `${formatName(targetUser)} has been blocked.`
                    : `${formatName(targetUser)} has been unblocked.`,
            });
        } catch (updateError) {
            setUsers(previousUsers);
            setBanner({
                type: 'error',
                text: updateError.message || (shouldBlock ? 'Unable to block this user.' : 'Unable to unblock this user.'),
            });
        } finally {
            setSavingUserId(null);
        }
    };

    const handleBlockToggle = (user) => {
        const isBlocked = user.baseAccountFlags?.is_active === false;
        const confirmationConfig = buildConfirmationConfig({
            scope: 'single',
            actionType: 'toggle_block',
            userName: formatName(user),
            flagKey: isBlocked ? 'unblock' : 'block',
        });

        if (!confirmationConfig) {
            return;
        }

        setPendingConfirmation({
            ...confirmationConfig,
            action: {
                type: 'single_toggle_block',
                userId: user.id,
                shouldBlock: !isBlocked,
            },
        });
    };

    const executeDeleteUser = async (userId) => {
        const targetUser = users.find((user) => user.id === userId);

        if (!targetUser) {
            return;
        }

        setSavingUserId(userId);
        setBanner({ type: '', text: '' });

        try {
            await deleteAdminUser({
                userId,
                fallbackErrorMessage: 'Unable to delete this user.',
            });

            setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
            setSelectedUserIds((currentIds) => currentIds.filter((id) => id !== userId));
            setBanner({
                type: 'success',
                text: `${formatName(targetUser)} has been deleted.`,
            });
        } catch (deleteError) {
            setBanner({
                type: 'error',
                text: deleteError.message || 'Unable to delete this user.',
            });
        } finally {
            setSavingUserId(null);
        }
    };

    const handleDeleteUser = (user) => {
        const confirmationConfig = buildConfirmationConfig({
            scope: 'single',
            actionType: 'delete_user',
            userName: formatName(user),
        });

        setPendingConfirmation({
            ...confirmationConfig,
            action: {
                type: 'single_delete_user',
                userId: user.id,
            },
        });
    };

    const handleBulkClearSchoolScope = () => {
        const eligibleUsers = selectedLinkedUsers.filter(
            (user) => user.schoolScopeId && !user.baseAccountFlags?.is_teacher
        );
        const confirmationConfig = buildConfirmationConfig({
            scope: 'bulk',
            actionType: 'clear_school_scope',
            count: eligibleUsers.length,
        });

        if (eligibleUsers.length && confirmationConfig) {
            setPendingConfirmation({
                ...confirmationConfig,
                action: {
                    type: 'bulk_clear_school_scope',
                },
            });
            return;
        }

        executeBulkClearSchoolScope();
    };

    const resetFilters = () => {
        setSearchQuery('');
        setRoleFilter('all');
        setLinkFilter('all');
        setSchoolFilter('all');
    };

    const handleConfirmAction = async () => {
        const action = pendingConfirmation?.action;
        setPendingConfirmation(null);

        if (!action) {
            return;
        }

        if (action.type === 'single_flag') {
            await executeBaseAccountFlagChange(action.userId, action.flagKey, action.checked);
            return;
        }

        if (action.type === 'single_clear_school_scope') {
            await executeClearSchoolScope(action.userId);
            return;
        }

        if (action.type === 'single_toggle_block') {
            await executeBlockToggle(action.userId, action.shouldBlock);
            return;
        }

        if (action.type === 'single_delete_user') {
            await executeDeleteUser(action.userId);
            return;
        }

        if (action.type === 'bulk_flag') {
            await executeBulkFlagChange();
            return;
        }

        if (action.type === 'bulk_clear_school_scope') {
            await executeBulkClearSchoolScope();
        }
    };

    if (!hasAccess) {
        return (
            <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
                <div className="mx-auto max-w-5xl">
                    <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                                <AlertTriangle className="size-5" />
                                Access restricted
                            </CardTitle>
                            <CardDescription className="text-amber-800/80 dark:text-amber-200/80">
                                Your current role does not have access to this dashboard.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Access control
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            User Role Management
                        </h1>
                        {/* <p className="max-w-3xl text-sm text-muted-foreground">
                            Review users from Supabase Auth and manage RBAC entirely through `base_account` access flags. Teacher accounts are single-school scoped through `school_name_id`.
                        </p> */}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => loadUsers({ silent: true })}
                        disabled={isRefreshing || isLoading}
                    >
                        {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                        Refresh
                    </Button>
                </div>

                {banner.text && (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                            banner.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                    >
                        {banner.text}
                    </div>
                )}

                {!canEditRoles ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
                        Your current effective role is <span className="font-semibold">{formatRoleLabel(currentRole)}</span>. Only linked <span className="font-semibold">Admin</span> and <span className="font-semibold">Super Admin</span> accounts can manage users here.
                    </div>
                ) : null}

                {canEditRoles ? (
                    <div className="rounded-lg border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                        Admins can manage routine access flags, blocking, and school scope. Super Admins keep schema access, Super Admin promotion, and user deletion.
                    </div>
                ) : null}

                <Card>
                    <CardHeader className="border-b border-border bg-muted/20">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="size-5 text-primary" />
                                    Team access
                                </CardTitle>
                                {/* <CardDescription className="pt-1">
                                    Linked users are managed with boolean access flags. Unlinked users stay inactive until they have a `base_account` record, and teachers must have exactly one school assignment.
                                </CardDescription> */}
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                                <Users className="size-3.5" />
                                {filteredUsers.length} of {sortedUsers.length} users
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="space-y-3 p-6">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <div key={index} className="grid grid-cols-5 gap-4">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                                <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        ) : sortedUsers.length === 0 ? (
                            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                                <p className="text-sm font-medium text-muted-foreground">No users found yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 p-4 md:p-6">
                                <div className="grid gap-3 md:grid-cols-[minmax(260px,1.3fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(180px,1fr)_auto]">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="Search name, username, email, or school"
                                            className="pl-9"
                                            aria-label="Search users"
                                        />
                                    </div>
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger aria-label="Filter by role">
                                            <SelectValue placeholder="All roles" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All roles</SelectItem>
                                            {filterOptions.roles.map((role) => (
                                                <SelectItem key={role} value={role}>
                                                    {formatRoleLabel(role)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={linkFilter} onValueChange={setLinkFilter}>
                                        <SelectTrigger aria-label="Filter by link status">
                                            <SelectValue placeholder="All users" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All users</SelectItem>
                                            <SelectItem value="linked">Linked only</SelectItem>
                                            <SelectItem value="unlinked">Unlinked only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                                        <SelectTrigger aria-label="Filter by school scope">
                                            <SelectValue placeholder="All schools" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All schools</SelectItem>
                                            <SelectItem value="unassigned">No school assigned</SelectItem>
                                            {filterOptions.schools.map((school) => (
                                                <SelectItem key={school.id} value={school.id}>
                                                    {school.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={resetFilters}
                                        disabled={!hasActiveFilters || isBulkSaving}
                                    >
                                        Reset
                                    </Button>
                                </div>

                                {selectedLinkedUsers.length > 0 ? (
                                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {selectedLinkedUsers.length} linked user{selectedLinkedUsers.length === 1 ? '' : 's'} selected
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Apply a flag change to all selected linked users, or clear stale school assignments for eligible non-teacher accounts.
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                                <Select value={bulkFlagKey} onValueChange={setBulkFlagKey}>
                                                    <SelectTrigger className="min-w-[150px]" aria-label="Bulk flag">
                                                        <SelectValue placeholder="Choose flag" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {visibleFlagColumns.map((column) => (
                                                            <SelectItem key={column.key} value={column.key}>
                                                                {column.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select value={bulkFlagValue} onValueChange={setBulkFlagValue}>
                                                    <SelectTrigger className="min-w-[130px]" aria-label="Bulk flag value">
                                                        <SelectValue placeholder="Choose action" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="enable">Enable</SelectItem>
                                                        <SelectItem value="disable">Disable</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {bulkTeacherNeedsSchool ? (
                                                    <Select value={bulkSchoolId || undefined} onValueChange={setBulkSchoolId}>
                                                        <SelectTrigger className="min-w-[190px]" aria-label="Bulk teacher school">
                                                            <SelectValue placeholder="Select teacher school" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {schools.map((school) => (
                                                                <SelectItem key={school.id} value={school.id}>
                                                                    {school.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    onClick={handleBulkFlagChange}
                                                    disabled={isBulkSaving}
                                                >
                                                    {isBulkSaving ? 'Applying...' : 'Apply to selected'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleBulkClearSchoolScope}
                                                    disabled={isBulkSaving}
                                                >
                                                    Clear school scope
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => setSelectedUserIds([])}
                                                    disabled={isBulkSaving}
                                                >
                                                    Clear selection
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {filteredUsers.length === 0 ? (
                                    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
                                        <p className="text-sm font-medium text-foreground">No users match the current filters.</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Try a broader search or reset the filters.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[52px]">
                                            <input
                                                type="checkbox"
                                                checked={allVisibleLinkedSelected}
                                                onChange={(event) => toggleVisibleLinkedSelection(event.target.checked)}
                                                disabled={!canEditRoles || isBulkSaving || selectableFilteredUsers.length === 0}
                                                aria-label="Select all visible linked users"
                                                className="h-4 w-4 rounded border-border align-middle"
                                            />
                                        </TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Username</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Joined</TableHead>
                                        {visibleFlagColumns.map((column) => (
                                            <TableHead key={column.key} className="text-center">
                                                {column.label}
                                            </TableHead>
                                        ))}
                                        <TableHead>School Scope</TableHead>
                                        <TableHead className="w-[260px]">Access</TableHead>
                                        <TableHead className="w-[220px]">Effective Role</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => {
                                        const isSavingRow = savingUserId === user.id;
                                        const canManageThisUser = canManageTargetUser(user);

                                        return (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUserIds.includes(user.id)}
                                                        onChange={(event) => toggleUserSelection(user.id, event.target.checked)}
                                                        disabled={!canEditRoles || isBulkSaving || user.roleSource !== 'base_account' || !canManageThisUser}
                                                        aria-label={`Select ${formatName(user)}`}
                                                        className="h-4 w-4 rounded border-border align-middle"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-medium text-foreground">{formatName(user)}</p>
                                                            {user.isCurrentUser ? (
                                                                <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                                    You
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {user.nickname ? `Nickname: ${user.nickname}` : 'No nickname yet'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {user.username ? `@${user.username}` : 'Not set'}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">
                                                    {user.email || 'No email'}
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                            user.onboardingCompleted
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                        }`}
                                                    >
                                                        {user.onboardingCompleted ? 'Onboarded' : 'Pending profile'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(user.createdAt)}
                                                </TableCell>
                                                {visibleFlagColumns.map((column) => (
                                                    <TableCell key={column.key} className="text-center">
                                                        {user.roleSource === 'base_account' ? (
                                                            <div className="flex justify-center">
                                                                <Switch
                                                                    checked={Boolean(user.baseAccountFlags?.[column.key])}
                                                                    onCheckedChange={(checked) =>
                                                                        handleBaseAccountFlagChange(user.id, column.key, checked === true)
                                                                    }
                                                                    disabled={isSavingRow || isBulkSaving || !canEditRoles || !canManageThisUser}
                                                                    aria-label={`${column.label} access for ${formatName(user)}`}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell>
                                                    {user.roleSource === 'base_account' ? (
                                                        <div className="space-y-1">
                                                            <div className="text-sm font-medium text-foreground">
                                                                {user.schoolScopeName || 'No school assigned'}
                                                            </div>
                                                            <Select
                                                                value={user.schoolScopeId || undefined}
                                                                onValueChange={(value) => handleSchoolScopeChange(user.id, value)}
                                                                disabled={
                                                                    isSavingRow ||
                                                                    isBulkSaving ||
                                                                    !canEditRoles ||
                                                                    !canManageThisUser ||
                                                                    !user.baseAccountFlags?.is_teacher
                                                                }
                                                            >
                                                                <SelectTrigger
                                                                    className="h-8 min-w-[180px] text-xs"
                                                                    aria-label={`School scope for ${formatName(user)}`}
                                                                >
                                                                    <SelectValue
                                                                        placeholder={
                                                                            user.baseAccountFlags?.is_teacher
                                                                                ? 'Select school'
                                                                                : 'Enable Teacher first'
                                                                        }
                                                                    />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {schools.map((school) => (
                                                                        <SelectItem key={school.id} value={school.id}>
                                                                            {school.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <div className="text-xs text-muted-foreground">
                                                                {user.schoolScopeId || 'school_name_id is null'}
                                                            </div>
                                                            {user.schoolScopeId && !user.baseAccountFlags?.is_teacher && canEditRoles && canManageThisUser ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground"
                                                                    onClick={() => handleClearSchoolScope(user.id)}
                                                                    disabled={isSavingRow || isBulkSaving}
                                                                >
                                                                    Clear school assignment
                                                                </Button>
                                                            ) : null}
                                                            {user.scopeWarning ? (
                                                                <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                                                    {user.scopeWarning}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="text-xs text-muted-foreground">
                                                                Link this user to <code>base_account</code> to manage access flags.
                                                            </div>
                                                            {canRemoveUsers ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-1.5 text-red-600 hover:text-red-600"
                                                                    onClick={() => handleDeleteUser(user)}
                                                                    disabled={isSavingRow || isBulkSaving || user.isCurrentUser}
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                    Delete
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {user.roleSource === 'base_account' ? (
                                                        <div className="space-y-2">
                                                            <div
                                                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                                    user.baseAccountFlags?.is_active === false
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                }`}
                                                            >
                                                                {user.baseAccountFlags?.is_active === false ? 'Blocked' : 'Active'}
                                                            </div>
                                                            <div>
                                                                <Button
                                                                    type="button"
                                                                    variant={user.baseAccountFlags?.is_active === false ? 'outline' : 'destructive'}
                                                                    size="sm"
                                                                    onClick={() => handleBlockToggle(user)}
                                                                    disabled={isSavingRow || isBulkSaving || !canEditRoles || !canManageThisUser || user.isCurrentUser}
                                                                >
                                                                    {user.baseAccountFlags?.is_active === false ? 'Unblock' : 'Block'}
                                                                </Button>
                                                            </div>
                                                            {canRemoveUsers ? (
                                                                <div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="gap-1.5 text-red-600 hover:text-red-600"
                                                                        onClick={() => handleDeleteUser(user)}
                                                                        disabled={isSavingRow || isBulkSaving || !canManageThisUser || user.isCurrentUser}
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                        Delete
                                                                    </Button>
                                                                </div>
                                                            ) : null}
                                                            {user.isCurrentUser ? (
                                                                <div className="text-xs text-muted-foreground">
                                                                    You cannot block or delete yourself.
                                                                </div>
                                                            ) : null}
                                                            {!canManageThisUser ? (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Super Admin access requires a Super Admin to manage.
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                                        {formatRoleLabel(user.effectiveRole)}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                </Table>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <AlertDialog
                open={pendingConfirmation !== null}
                onOpenChange={(open) => !open && setPendingConfirmation(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{pendingConfirmation?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingConfirmation?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button variant="outline" onClick={() => setPendingConfirmation(null)}>
                                Cancel
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button
                                variant={pendingConfirmation?.confirmVariant || 'default'}
                                onClick={handleConfirmAction}
                            >
                                {pendingConfirmation?.confirmLabel || 'Confirm'}
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UserRolesView;
