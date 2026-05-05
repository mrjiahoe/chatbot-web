import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseEnv } from '@/lib/supabase-env';

const registerSchema = z.object({
    email: z.string().trim().email('A valid email is required.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters.')
        .max(225, 'Username is too long.')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.'),
    firstName: z.string().trim().min(1, 'First name is required.').max(255, 'First name is too long.'),
    lastName: z.string().trim().min(1, 'Last name is required.').max(255, 'Last name is too long.'),
}).strict();

function firstValidationMessage(zodError) {
    const issue = zodError.issues[0];
    return issue?.message ?? 'Invalid registration data.';
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

async function ensureUsernameAvailable(admin, username) {
    const { data: baseAccountUser, error: baseAccountError } = await admin
        .from('base_account')
        .select('username')
        .eq('username', username)
        .maybeSingle();

    if (baseAccountError && !isBaseAccountUnavailable(baseAccountError)) {
        throw baseAccountError;
    }

    if (baseAccountUser) {
        return false;
    }

    const { data: profileUser, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
    }

    return !profileUser;
}

async function createProfileForEmailSignup({ admin, userId, username, firstName, lastName }) {
    const { error } = await admin
        .from('profiles')
        .upsert(
            {
                id: userId,
                username,
                nickname: '',
                first_name: firstName,
                last_name: lastName,
                onboarding_completed: true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
        );

    if (error) {
        throw error;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const parsed = registerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: firstValidationMessage(parsed.error) },
                { status: 400 }
            );
        }

        const email = parsed.data.email.trim().toLowerCase();
        const username = parsed.data.username.trim().toLowerCase();
        const firstName = parsed.data.firstName.trim();
        const lastName = parsed.data.lastName.trim();
        const admin = getSupabaseAdminClient();
        const usernameAvailable = await ensureUsernameAvailable(admin, username);

        if (!usernameAvailable) {
            return NextResponse.json(
                { error: 'That username is already taken.' },
                { status: 400 }
            );
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

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password: parsed.data.password,
            options: {
                data: {
                    username,
                    first_name: firstName,
                    last_name: lastName,
                },
            },
        });

        if (signUpError) {
            return NextResponse.json(
                { error: signUpError.message || 'Unable to sign up right now.' },
                { status: 400 }
            );
        }

        if (!data?.user) {
            return NextResponse.json(
                { error: 'Unable to create your account right now.' },
                { status: 500 }
            );
        }

        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return NextResponse.json(
                {
                    error: 'This email is already registered or still pending confirmation. If you deleted only from profiles, also delete the user in Supabase Auth > Users.',
                },
                { status: 400 }
            );
        }

        await createProfileForEmailSignup({
            admin,
            userId: data.user.id,
            username,
            firstName,
            lastName,
        });

        response = NextResponse.json(
            {
                success: true,
                data,
            },
            {
                status: 200,
                headers: response.headers,
            }
        );

        return response;
    } catch (error) {
        if (error?.code === '23505') {
            return NextResponse.json(
                { error: 'That username is already taken.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to sign up right now.',
            },
            { status: 500 }
        );
    }
}
