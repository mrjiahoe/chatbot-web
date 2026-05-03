import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseEnv } from '@/lib/supabase-env';

class UsernameLookupUnavailableError extends Error {
    constructor(message = 'Username login is unavailable right now. Please sign in with your email address instead.') {
        super(message);
        this.name = 'UsernameLookupUnavailableError';
    }
}

class BlockedAccountError extends Error {
    constructor(message = 'Your account is blocked. Contact a super admin to restore access.') {
        super(message);
        this.name = 'BlockedAccountError';
    }
}

function isEmailLike(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isBaseAccountUnavailable(error) {
    const code = error?.code;
    const message = error?.message || '';

    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        code === 'PGRST116' ||
        code === '42703' ||
        message.includes('base_account') ||
        message.includes('relation') ||
        message.includes('schema cache')
    );
}

function isProfileUsernameUnavailable(error) {
    const code = error?.code;
    const message = error?.message || '';

    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        code === 'PGRST116' ||
        code === '42703' ||
        message.includes('profiles') ||
        message.includes('username') ||
        message.includes('relation') ||
        message.includes('schema cache')
    );
}

async function resolveEmailFromIdentifier(identifier) {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    if (isEmailLike(normalizedIdentifier)) {
        return normalizedIdentifier;
    }

    const admin = getSupabaseAdminClient();
    const { data: account, error: accountError } = await admin
        .from('base_account')
        .select('email')
        .eq('username', normalizedIdentifier)
        .maybeSingle();

    if (!accountError && account?.email) {
        return account.email.toLowerCase();
    }

    if (accountError && !isBaseAccountUnavailable(accountError)) {
        console.error('Username lookup failed against base_account:', accountError);
        throw new UsernameLookupUnavailableError();
    }

    const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .eq('username', normalizedIdentifier)
        .maybeSingle();

    if (profileError) {
        if (isProfileUsernameUnavailable(profileError)) {
            console.error('Username lookup failed against profiles:', profileError);
            throw new UsernameLookupUnavailableError(
                'Username login is unavailable on this deployment right now. Please sign in with your email address instead.'
            );
        }

        console.error('Unexpected profiles lookup error during login:', profileError);
        throw new UsernameLookupUnavailableError();
    }

    if (!profile?.id) {
        return null;
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);

    if (userError) {
        console.error('Failed to resolve auth user from profile during login:', userError);
        throw new UsernameLookupUnavailableError();
    }

    return userData.user?.email?.toLowerCase() || null;
}

async function findBaseAccountByEmail(email) {
    const admin = getSupabaseAdminClient();
    const { data: account, error } = await admin
        .from('base_account')
        .select('auth_user_id, email, is_active')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        if (isBaseAccountUnavailable(error)) {
            return null;
        }

        console.error('Failed to look up base_account by email during login:', error);
        throw new Error('Unable to verify account access right now.');
    }

    return account || null;
}

export async function POST(request) {
    try {
        const body = await request.json();
        const identifier = body?.identifier?.trim();
        const password = body?.password;

        if (!identifier || !password) {
            return NextResponse.json(
                { error: 'Email/username and password are required.' },
                { status: 400 }
            );
        }

        const email = await resolveEmailFromIdentifier(identifier);

        if (!email) {
            return NextResponse.json(
                { error: 'Invalid login credentials.' },
                { status: 400 }
            );
        }

        const baseAccount = await findBaseAccountByEmail(email);

        if (baseAccount?.is_active === false) {
            throw new BlockedAccountError();
        }

        const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
        let response = NextResponse.json({ success: true });

        const supabase = createServerClient(
            supabaseUrl,
            supabasePublishableKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        response = NextResponse.json({ success: true });
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            return NextResponse.json(
                { error: signInError.message || 'Invalid login credentials.' },
                { status: 400 }
            );
        }

        return response;
    } catch (error) {
        if (error instanceof BlockedAccountError) {
            return NextResponse.json(
                { error: error.message },
                { status: 403 }
            );
        }

        if (error instanceof UsernameLookupUnavailableError) {
            return NextResponse.json(
                { error: error.message },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to sign in right now.',
            },
            { status: 500 }
        );
    }
}
