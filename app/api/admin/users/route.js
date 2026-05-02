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
import { canAccessRoleDashboard, canManageUserRoles, normalizeRole } from '@/lib/roles';

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

export async function GET() {
    try {
        const access = await requireRoleAccess();

        if (access.error) {
            return access.error;
        }

        const { admin, currentUserId, actorRole } = access;
        const [users, profilesResponse] = await Promise.all([
            listAllUsers(admin),
            admin
                .from('profiles')
                .select('id, username, nickname, first_name, last_name, onboarding_completed'),
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
                onboardingCompleted: Boolean(accessProfile.onboarding_completed),
                createdAt: user.created_at,
                lastSignInAt: user.last_sign_in_at,
                isCurrentUser: user.id === currentUserId,
            };
        });

        return NextResponse.json({
            users: mergedUsers,
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

        if (requestedBaseAccountFlags && typeof requestedBaseAccountFlags === 'object') {
            if (!baseAccount) {
                return NextResponse.json(
                    { error: 'This user is not linked to base_account.' },
                    { status: 400 }
                );
            }

            const flagKeys = Object.keys(requestedBaseAccountFlags);

            if (!flagKeys.length) {
                return NextResponse.json(
                    { error: 'At least one base_account flag is required.' },
                    { status: 400 }
                );
            }

            const hasInvalidFlag = flagKeys.some((key) => !BASE_ACCOUNT_FLAG_FIELDS.includes(key));

            if (hasInvalidFlag) {
                return NextResponse.json(
                    { error: 'Invalid base_account flag selected.' },
                    { status: 400 }
                );
            }

            const normalizedFlags = normalizeBaseAccountFlags(requestedBaseAccountFlags);

            const { data: updatedBaseAccount, error } = await admin
                .from('base_account')
                .update(normalizedFlags)
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
                    baseAccountFlags: {
                        ...normalizeBaseAccountFlags(baseAccount),
                        ...normalizedFlags,
                    },
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
