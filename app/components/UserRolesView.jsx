'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const UserRolesView = ({ currentRole }) => {
    const [users, setUsers] = useState([]);
    const [schools, setSchools] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [savingUserId, setSavingUserId] = useState(null);
    const [error, setError] = useState(null);
    const [banner, setBanner] = useState({ type: '', text: '' });
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

    const handleBaseAccountFlagChange = async (userId, flagKey, checked) => {
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
                                {sortedUsers.length} users
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
                                    {sortedUsers.map((user) => {
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UserRolesView;
