'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCcw, Search, ShieldCheck, Users } from 'lucide-react';
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
import { canAccessRoleDashboard, canManageUserRoles, formatRoleLabel } from '@/lib/roles';

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

function buildConfirmationConfig({ actionType, userName, flagKey = null }) {
    if (actionType === 'clear_school_scope') {
        return {
            title: 'Clear school assignment?',
            description: `${userName} will no longer have a school linked in base_account.school_name_id.`,
            confirmLabel: 'Clear assignment',
            confirmVariant: 'destructive',
        };
    }

    if (flagKey === 'is_teacher') {
        return {
            title: 'Remove Teacher access?',
            description: `${userName} will immediately lose teacher-scoped access until Teacher is enabled again.`,
            confirmLabel: 'Remove Teacher',
            confirmVariant: 'destructive',
        };
    }

    if (flagKey === 'is_superuser') {
        return {
            title: 'Grant Super Admin access?',
            description: `${userName} will gain the highest level of administrative access in the workspace.`,
            confirmLabel: 'Grant Super Admin',
            confirmVariant: 'default',
        };
    }

    if (flagKey === 'is_admin') {
        return {
            title: 'Grant Admin access?',
            description: `${userName} will gain elevated administrative access across the workspace.`,
            confirmLabel: 'Grant Admin',
            confirmVariant: 'default',
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
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const hasAccess = canAccessRoleDashboard(currentRole);
    const canEditRoles = canManageUserRoles(currentRole);

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

    const loadUsers = async ({ silent = false } = {}) => {
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
    };

    useEffect(() => {
        loadUsers();
    }, [hasAccess]);

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
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    baseAccountFlags: {
                        [flagKey]: checked,
                    },
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to update access flags.');
            }

            setBanner({
                type: 'success',
                text: 'Access flags updated successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? {
                            ...user,
                            effectiveRole: payload.user?.effectiveRole || user.effectiveRole,
                            roleSource: payload.user?.roleSource || user.roleSource,
                            baseAccountFlags: payload.user?.baseAccountFlags || user.baseAccountFlags,
                            schoolScopeId: payload.user?.schoolScopeId ?? user.schoolScopeId,
                            scopeWarning:
                                payload.user?.baseAccountFlags?.is_teacher &&
                                !(payload.user?.schoolScopeId ?? user.schoolScopeId)
                                    ? 'Teacher accounts must have a school assignment.'
                                    : null,
                        }
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
                onConfirm: () => executeBaseAccountFlagChange(userId, flagKey, checked),
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
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    schoolNameId: schoolId,
                    baseAccountFlags: { is_teacher: true },
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to update school scope.');
            }

            setBanner({
                type: 'success',
                text: 'School scope updated successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? {
                            ...user,
                            effectiveRole: payload.user?.effectiveRole || user.effectiveRole,
                            roleSource: payload.user?.roleSource || user.roleSource,
                            baseAccountFlags: payload.user?.baseAccountFlags || user.baseAccountFlags,
                            schoolScopeId: payload.user?.schoolScopeId ?? schoolId,
                            schoolScopeName: selectedSchool?.name || user.schoolScopeName,
                            scopeWarning: null,
                        }
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
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    schoolNameId: null,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to clear school scope.');
            }

            setBanner({
                type: 'success',
                text: 'School scope cleared successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? {
                            ...user,
                            effectiveRole: payload.user?.effectiveRole || user.effectiveRole,
                            roleSource: payload.user?.roleSource || user.roleSource,
                            baseAccountFlags: payload.user?.baseAccountFlags || user.baseAccountFlags,
                            schoolScopeId: payload.user?.schoolScopeId ?? null,
                            schoolScopeName: null,
                            scopeWarning: null,
                        }
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
            onConfirm: () => executeClearSchoolScope(userId),
        });
    };

    const resetFilters = () => {
        setSearchQuery('');
        setRoleFilter('all');
        setLinkFilter('all');
        setSchoolFilter('all');
    };

    const handleConfirmAction = async () => {
        const action = pendingConfirmation;
        setPendingConfirmation(null);

        if (action?.onConfirm) {
            await action.onConfirm();
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
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            Review users from Supabase Auth and manage RBAC entirely through `base_account` access flags. Teacher accounts are single-school scoped through `school_name_id`.
                        </p>
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
                        Your current effective role is <span className="font-semibold">{formatRoleLabel(currentRole)}</span>. Only linked <span className="font-semibold">Super Admin</span> accounts can edit access flags.
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
                                <CardDescription className="pt-1">
                                    Linked users are managed with boolean access flags. Unlinked users stay inactive until they have a `base_account` record, and teachers must have exactly one school assignment.
                                </CardDescription>
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
                                        disabled={!hasActiveFilters}
                                    >
                                        Reset
                                    </Button>
                                </div>

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
                                        <TableHead>User</TableHead>
                                        <TableHead>Username</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Joined</TableHead>
                                        {baseAccountFlagColumns.map((column) => (
                                            <TableHead key={column.key} className="text-center">
                                                {column.label}
                                            </TableHead>
                                        ))}
                                        <TableHead>School Scope</TableHead>
                                        <TableHead className="w-[220px]">Effective Role</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => {
                                        const isSavingRow = savingUserId === user.id;

                                        return (
                                            <TableRow key={user.id}>
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
                                                {baseAccountFlagColumns.map((column) => (
                                                    <TableCell key={column.key} className="text-center">
                                                        {user.roleSource === 'base_account' ? (
                                                            <div className="flex justify-center">
                                                                <Switch
                                                                    checked={Boolean(user.baseAccountFlags?.[column.key])}
                                                                    onCheckedChange={(checked) =>
                                                                        handleBaseAccountFlagChange(user.id, column.key, checked === true)
                                                                    }
                                                                    disabled={isSavingRow || !canEditRoles}
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
                                                                    !canEditRoles ||
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
                                                            {user.schoolScopeId && !user.baseAccountFlags?.is_teacher && canEditRoles ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground"
                                                                    onClick={() => handleClearSchoolScope(user.id)}
                                                                    disabled={isSavingRow}
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
