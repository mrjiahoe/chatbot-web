import { NextResponse } from 'next/server';
import {
    BASE_ACCOUNT_FLAG_FIELDS,
    buildAccessProfile,
    fetchBaseAccountsByAuthUserIds,
    fetchCurrentAccessProfile,
    normalizeBaseAccountFlags,
} from '@/lib/access';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getServerSupabaseClient } from '@/lib/serverSupabase';
import {
    canAccessRoleDashboard,
    canDeleteUsers,
    canManageSuperAdminAssignments,
    canManageUserRoles,
    normalizeRole,
} from '@/lib/roles';

async function requireRoleAccess() {
    const supabase = await getServerSupabaseClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }),
        };
    }

    const accessProfile = await fetchCurrentAccessProfile({
        supabase,
        authUser: user,
    });
    const actorRole = normalizeRole(accessProfile.effectiveRole);

    if (!canAccessRoleDashboard(actorRole)) {
        return {
            error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }),
        };
    }

    return {
        admin: getSupabaseAdminClient(),
        currentUserId: user.id,
        actorRole,
    };
}

async function listAllUsers(admin) {
    const users = [];
    const perPage = 100;
    let page = 1;

    while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) {
            throw error;
        }

        const batch = data?.users || [];
        users.push(...batch);

        if (batch.length < perPage) {
            break;
        }

        page += 1;
    }

    return users;
}

async function fetchSchoolMap(admin) {
    const { data, error } = await admin
        .from('base_school')
        .select('id, name');

    if (error) {
        throw new Error(
            `Unable to load schools from base_school: ${error.message || 'unknown error'}`
        );
    }

    return new Map((data || []).map((school) => [school.id, school.name]));
}

async function listLinkedSuperAdminIds(admin) {
    const { data, error } = await admin
        .from('base_account')
        .select('auth_user_id')
        .eq('is_superuser', true);

    if (error) {
        throw error;
    }

    return (data || [])
        .map((row) => row.auth_user_id)
        .filter(Boolean);
}

function isLinkedSuperAdmin(baseAccount) {
    return Boolean(baseAccount?.is_superuser && baseAccount?.auth_user_id);
}

function canManageTargetUser({ actorRole, targetBaseAccount }) {
    if (canManageSuperAdminAssignments(actorRole)) {
        return true;
    }

    return !isLinkedSuperAdmin(targetBaseAccount);
}

async function assertNotLastLinkedSuperAdmin({ admin, userId, baseAccount, actionLabel }) {
    if (!isLinkedSuperAdmin(baseAccount)) {
        return;
    }

    const linkedSuperAdminIds = await listLinkedSuperAdminIds(admin);

    if (linkedSuperAdminIds.includes(userId) && linkedSuperAdminIds.length <= 1) {
        throw new Error(`You cannot ${actionLabel} the last linked Super Admin.`);
    }
}

export async function GET() {
    try {
        const access = await requireRoleAccess();

        if (access.error) {
            return access.error;
        }

        const { admin, currentUserId } = access;
        const [users, profilesResponse, schoolMap] = await Promise.all([
            listAllUsers(admin),
            admin
                .from('profiles')
                .select('id, username, nickname, first_name, last_name, onboarding_completed'),
            fetchSchoolMap(admin),
        ]);
        const authUserIds = users.map((authUser) => authUser.id);
        const baseAccountsByAuthUserId = await fetchBaseAccountsByAuthUserIds({
            supabase: admin,
            authUserIds,
        });

        if (profilesResponse.error) {
            throw profilesResponse.error;
        }

        const profilesById = new Map(
            (profilesResponse.data || []).map((profile) => [profile.id, profile])
        );

        const mergedUsers = users.map((user) => {
            const profile = profilesById.get(user.id) || null;
            const accessProfile = buildAccessProfile({
                authUser: user,
                profile,
                baseAccount: baseAccountsByAuthUserId.get(user.id) || null,
            });

            return {
                id: user.id,
                email: accessProfile.email,
                username: accessProfile.username,
                nickname: profile?.nickname || '',
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
                role: accessProfile.role,
                effectiveRole: accessProfile.effectiveRole,
                roleSource: accessProfile.roleSource,
                baseAccountId: accessProfile.baseAccountId,
                baseAccountFlags: accessProfile.baseAccount,
                schoolScopeId: accessProfile.baseAccount?.school_name_id || null,
                schoolScopeName: accessProfile.baseAccount?.school_name_id
                    ? schoolMap.get(accessProfile.baseAccount.school_name_id) || accessProfile.baseAccount.school_name_id
                    : null,
                scopeWarning:
                    accessProfile.baseAccount?.is_teacher &&
                    !accessProfile.baseAccount?.school_name_id
                        ? 'Teacher accounts must have a school assignment.'
                        : null,
                onboardingCompleted: Boolean(accessProfile.onboarding_completed),
                createdAt: user.created_at,
                lastSignInAt: user.last_sign_in_at,
                isCurrentUser: user.id === currentUserId,
            };
        });

        return NextResponse.json({
            users: mergedUsers,
            schools: Array.from(schoolMap.entries()).map(([id, name]) => ({ id, name })),
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to load users.',
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request) {
    try {
        const access = await requireRoleAccess();

        if (access.error) {
            return access.error;
        }

        const { admin, actorRole } = access;
        if (!canManageUserRoles(actorRole)) {
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }
        const body = await request.json();
        const userId = body?.userId;
        const requestedBaseAccountFlags = body?.baseAccountFlags;
        const requestedSchoolNameId = Object.prototype.hasOwnProperty.call(body || {}, 'schoolNameId')
            ? body.schoolNameId
            : undefined;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required.' },
                { status: 400 }
            );
        }

        const baseAccountsByAuthUserId = await fetchBaseAccountsByAuthUserIds({
            supabase: admin,
            authUserIds: [userId],
        });
        const baseAccount = baseAccountsByAuthUserId.get(userId) || null;

        const hasFlagPayload = requestedBaseAccountFlags && typeof requestedBaseAccountFlags === 'object';
        const hasSchoolPayload = requestedSchoolNameId !== undefined;

        if (!canManageTargetUser({ actorRole, targetBaseAccount: baseAccount })) {
            return NextResponse.json(
                { error: 'Only Super Admins can manage another Super Admin account.' },
                { status: 403 }
            );
        }

        if (hasFlagPayload || hasSchoolPayload) {
            if (!baseAccount) {
                return NextResponse.json(
                    { error: 'This user is not linked to base_account.' },
                    { status: 400 }
                );
            }

            const flagKeys = hasFlagPayload ? Object.keys(requestedBaseAccountFlags) : [];

            if (!hasSchoolPayload && !flagKeys.length) {
                return NextResponse.json(
                    { error: 'At least one base_account update is required.' },
                    { status: 400 }
                );
            }

            const hasInvalidFlag = hasFlagPayload
                ? flagKeys.some((key) => !BASE_ACCOUNT_FLAG_FIELDS.includes(key))
                : false;

            if (hasInvalidFlag) {
                return NextResponse.json(
                    { error: 'Invalid base_account flag selected.' },
                    { status: 400 }
                );
            }

            if (
                hasFlagPayload &&
                Object.prototype.hasOwnProperty.call(requestedBaseAccountFlags, 'is_superuser') &&
                !canManageSuperAdminAssignments(actorRole)
            ) {
                return NextResponse.json(
                    { error: 'Only Super Admins can grant or revoke Super Admin access.' },
                    { status: 403 }
                );
            }

            const normalizedFlags = hasFlagPayload
                ? normalizeBaseAccountFlags(requestedBaseAccountFlags)
                : {};
            const mergedFlags = {
                ...normalizeBaseAccountFlags(baseAccount),
                ...normalizedFlags,
            };
            const normalizedSchoolNameId =
                requestedSchoolNameId === undefined
                    ? baseAccount.school_name_id
                    : requestedSchoolNameId || null;

            if (
                requestedSchoolNameId !== undefined &&
                requestedSchoolNameId !== null &&
                requestedSchoolNameId !== '' &&
                !mergedFlags.is_teacher
            ) {
                return NextResponse.json(
                    {
                        error: 'School assignment can only be changed when the Teacher flag is enabled.',
                    },
                    { status: 400 }
                );
            }

            if (mergedFlags.is_teacher && !normalizedSchoolNameId) {
                return NextResponse.json(
                    {
                        error: 'Teacher accounts must have exactly one assigned school in base_account.school_name_id before enabling the Teacher flag.',
                    },
                    { status: 400 }
                );
            }

            const superAdminWillBeDisabled =
                isLinkedSuperAdmin(baseAccount) &&
                (mergedFlags.is_superuser === false || mergedFlags.is_active === false);

            if (superAdminWillBeDisabled) {
                try {
                    await assertNotLastLinkedSuperAdmin({
                        admin,
                        userId,
                        baseAccount,
                        actionLabel: mergedFlags.is_active === false ? 'block' : 'demote',
                    });
                } catch (guardError) {
                    return NextResponse.json(
                        { error: guardError instanceof Error ? guardError.message : 'Update blocked.' },
                        { status: 400 }
                    );
                }
            }

            const { data: updatedBaseAccount, error } = await admin
                .from('base_account')
                .update({
                    ...normalizedFlags,
                    ...(requestedSchoolNameId !== undefined
                        ? { school_name_id: normalizedSchoolNameId }
                        : {}),
                })
                .eq('auth_user_id', userId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            const effectiveRole = buildAccessProfile({
                authUser: { id: userId },
                baseAccount: updatedBaseAccount,
            }).effectiveRole;

            return NextResponse.json({
                user: {
                    id: userId,
                    effectiveRole,
                    roleSource: 'base_account',
                    baseAccountFlags: mergedFlags,
                    schoolScopeId: updatedBaseAccount.school_name_id || null,
                },
            });
        }

        return NextResponse.json(
            { error: 'RBAC is managed only through base_account flags now. Link this user to base_account first.' },
            { status: 400 }
        );
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to update role.',
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request) {
    try {
        const access = await requireRoleAccess();

        if (access.error) {
            return access.error;
        }

        const { admin, actorRole, currentUserId } = access;

        if (!canDeleteUsers(actorRole)) {
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const userId = body?.userId;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required.' },
                { status: 400 }
            );
        }

        if (userId === currentUserId) {
            return NextResponse.json(
                { error: 'You cannot delete your own account.' },
                { status: 400 }
            );
        }

        const baseAccountsByAuthUserId = await fetchBaseAccountsByAuthUserIds({
            supabase: admin,
            authUserIds: [userId],
        });
        const baseAccount = baseAccountsByAuthUserId.get(userId) || null;

        if (!canManageTargetUser({ actorRole, targetBaseAccount: baseAccount })) {
            return NextResponse.json(
                { error: 'Only Super Admins can delete another Super Admin account.' },
                { status: 403 }
            );
        }

        try {
            await assertNotLastLinkedSuperAdmin({
                admin,
                userId,
                baseAccount,
                actionLabel: 'delete',
            });
        } catch (guardError) {
            return NextResponse.json(
                { error: guardError instanceof Error ? guardError.message : 'Delete blocked.' },
                { status: 400 }
            );
        }

        const { data: conversations, error: conversationsError } = await admin
            .from('conversations')
            .select('id')
            .eq('user_id', userId);

        if (conversationsError) {
            throw conversationsError;
        }

        const conversationIds = (conversations || []).map((conversation) => conversation.id).filter(Boolean);

        if (conversationIds.length) {
            const { error: messagesError } = await admin
                .from('messages')
                .delete()
                .in('conversation_id', conversationIds);

            if (messagesError) {
                throw messagesError;
            }
        }

        const { error: deleteConversationsError } = await admin
            .from('conversations')
            .delete()
            .eq('user_id', userId);

        if (deleteConversationsError) {
            throw deleteConversationsError;
        }

        const { error: deleteProfileError } = await admin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (deleteProfileError) {
            throw deleteProfileError;
        }

        if (baseAccount) {
            const { error: unlinkBaseAccountError } = await admin
                .from('base_account')
                .update({
                    auth_user_id: null,
                    is_active: false,
                })
                .eq('auth_user_id', userId);

            if (unlinkBaseAccountError) {
                throw unlinkBaseAccountError;
            }
        }

        const { error: deleteAuthUserError } = await admin.auth.admin.deleteUser(userId);

        if (deleteAuthUserError) {
            throw deleteAuthUserError;
        }

        return NextResponse.json({
            deletedUserId: userId,
            unlinkedBaseAccountId: baseAccount?.id || null,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to delete user.',
            },
            { status: 500 }
        );
    }
}
