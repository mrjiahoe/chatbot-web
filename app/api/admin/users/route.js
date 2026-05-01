import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getServerSupabaseClient } from '@/lib/serverSupabase';
import { canManageRoles, ROLE_OPTIONS } from '@/lib/roles';

const ALLOWED_ROLES = new Set(ROLE_OPTIONS.map((option) => option.value));

async function requireRoleManager() {
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

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

    if (profileError || !canManageRoles(profile?.role)) {
        return {
            error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }),
        };
    }

    return {
        admin: getSupabaseAdminClient(),
        currentUserId: user.id,
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
        const access = await requireRoleManager();

        if (access.error) {
            return access.error;
        }

        const { admin, currentUserId } = access;
        const [users, profilesResponse] = await Promise.all([
            listAllUsers(admin),
            admin
                .from('profiles')
                .select('id, username, nickname, first_name, last_name, role, onboarding_completed'),
        ]);

        if (profilesResponse.error) {
            throw profilesResponse.error;
        }

        const profilesById = new Map(
            (profilesResponse.data || []).map((profile) => [profile.id, profile])
        );

        const mergedUsers = users.map((user) => {
            const profile = profilesById.get(user.id);

            return {
                id: user.id,
                email: user.email || '',
                username: profile?.username || '',
                nickname: profile?.nickname || '',
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
                role: profile?.role || 'user',
                onboardingCompleted: Boolean(profile?.onboarding_completed),
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
        const access = await requireRoleManager();

        if (access.error) {
            return access.error;
        }

        const { admin } = access;
        const body = await request.json();
        const userId = body?.userId;
        const role = body?.role;

        if (!userId || !role) {
            return NextResponse.json(
                { error: 'User ID and role are required.' },
                { status: 400 }
            );
        }

        if (!ALLOWED_ROLES.has(role)) {
            return NextResponse.json(
                { error: 'Invalid role selected.' },
                { status: 400 }
            );
        }

        const { error } = await admin
            .from('profiles')
            .upsert(
                {
                    id: userId,
                    role,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'id',
                }
            );

        if (error) {
            throw error;
        }

        return NextResponse.json({
            user: {
                id: userId,
                role,
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to update role.',
            },
            { status: 500 }
        );
    }
}
