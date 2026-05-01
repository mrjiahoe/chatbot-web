import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './supabase-env.js';

export function getSupabaseAdminClient() {
    const { supabaseUrl } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error(
            'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your server environment to enable username login.'
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
