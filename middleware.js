import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getSupabaseEnv } from './lib/supabase-env';

export async function middleware(request) {
    const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isOnboardingPreview =
        pathname === '/onboarding' && request.nextUrl.searchParams.get('preview') === '1';

    // If there is no user and the user is trying to access a protected route
    if (!user) {
        if (pathname === '/') {
            const url = request.nextUrl.clone();
            url.pathname = '/welcome';
            return NextResponse.redirect(url);
        }

        // Onboarding should never be reachable without a session.
        if (pathname === '/onboarding' && !isOnboardingPreview) {
            const url = request.nextUrl.clone();
            url.pathname = '/welcome';
            return NextResponse.redirect(url);
        }
    }

    // If there is a user and the user is trying to access login/register/welcome.
    if (user && (pathname === '/login' || pathname === '/register' || pathname === '/welcome')) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ['/', '/welcome', '/login', '/register', '/onboarding'],
};
