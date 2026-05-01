import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './supabase-env.js';

function parseProjectRefFromUrl(supabaseUrl) {
    try {
        return new URL(supabaseUrl).hostname.split('.')[0] || null;
    } catch {
        return null;
    }
}

function decodeJwtPayload(token) {
    const parts = token.split('.');

    if (parts.length !== 3) {
        return null;
    }

    try {
        const normalized = parts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');

        const payload = Buffer.from(normalized, 'base64').toString('utf8');
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

export function getSupabaseAdminClient() {
    const { supabaseUrl } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error(
            'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your server environment to enable username login.'
        );
    }

    const expectedProjectRef = parseProjectRefFromUrl(supabaseUrl);
    const tokenPayload = decodeJwtPayload(serviceRoleKey);
    const tokenProjectRef = tokenPayload?.ref || null;

    if (!tokenPayload) {
        throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY is not a valid JWT. Copy the service_role key from Supabase Project Settings > API.'
        );
    }

    if (expectedProjectRef && tokenProjectRef && expectedProjectRef !== tokenProjectRef) {
        throw new Error(
            `SUPABASE_SERVICE_ROLE_KEY belongs to project "${tokenProjectRef}", but NEXT_PUBLIC_SUPABASE_URL points to "${expectedProjectRef}".`
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
