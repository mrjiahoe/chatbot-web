import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './supabase-env.js';

export async function getServerSupabaseClient() {
    const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
    const cookieStore = await cookies();

    return createServerClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // This can happen during server rendering.
                    }
                },
            },
        }
    );
}
