'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { canManageRoles, ROLE_OPTIONS } from '@/lib/roles';

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

const UserRolesView = ({ currentRole }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [savingUserId, setSavingUserId] = useState(null);
    const [error, setError] = useState(null);
    const [banner, setBanner] = useState({ type: '', text: '' });
    const hasAccess = canManageRoles(currentRole);

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

    const handleRoleChange = async (userId, nextRole) => {
        const previousUsers = users;
        setSavingUserId(userId);
        setBanner({ type: '', text: '' });
        setUsers((currentUsers) =>
            currentUsers.map((user) =>
                user.id === userId
                    ? {
                        ...user,
                        role: nextRole,
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
                    role: nextRole,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to update role.');
            }

            setBanner({
                type: 'success',
                text: 'Role updated successfully.',
            });
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === userId
                        ? {
                            ...user,
                            role: payload.user?.role || nextRole,
                        }
                        : user
                )
            );
        } catch (updateError) {
            setUsers(previousUsers);
            setBanner({
                type: 'error',
                text: updateError.message || 'Unable to update role.',
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
                                Only super admins or owners can manage user roles from this page.
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
                            Super admin
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            User Role Management
                        </h1>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            Review user details and assign roles from one place. Changes save as soon as you pick a new role.
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

                <Card>
                    <CardHeader className="border-b border-border bg-muted/20">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="size-5 text-primary" />
                                    Team access
                                </CardTitle>
                                <CardDescription className="pt-1">
                                    Users are listed from Supabase Auth and matched with their profile records.
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Username</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="w-[180px]">Role</TableHead>
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
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Select
                                                            value={user.role || 'user'}
                                                            onValueChange={(value) => handleRoleChange(user.id, value)}
                                                            disabled={isSavingRow}
                                                        >
                                                            <SelectTrigger className="w-full bg-background">
                                                                <SelectValue placeholder="Select role" />
                                                            </SelectTrigger>
                                                            <SelectContent align="end">
                                                                {ROLE_OPTIONS.map((roleOption) => (
                                                                    <SelectItem key={roleOption.value} value={roleOption.value}>
                                                                        {roleOption.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {isSavingRow ? (
                                                            <p className="text-xs text-muted-foreground">Saving role change...</p>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UserRolesView;
