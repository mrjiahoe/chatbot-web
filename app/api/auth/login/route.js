import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseEnv } from '@/lib/supabase-env';

function isEmailLike(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveEmailFromIdentifier(identifier) {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    if (isEmailLike(normalizedIdentifier)) {
        return normalizedIdentifier;
    }

    const admin = getSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .eq('username', normalizedIdentifier)
        .maybeSingle();

    if (profileError) {
        throw new Error('Unable to look up that username right now.');
    }

    if (!profile?.id) {
        return null;
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);

    if (userError) {
        throw new Error('Unable to look up that username right now.');
    }

    return userData.user?.email?.toLowerCase() || null;
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
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to sign in right now.',
            },
            { status: 500 }
        );
    }
}
