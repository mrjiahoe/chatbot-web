import { getSupabaseAdminClient } from './supabase-admin';

export function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

export function isBaseAccountUnavailable(error) {
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

export async function ensureUsernameAvailable(admin, username) {
    const normalizedUsername = normalizeUsername(username);

    const { data: baseAccountUser, error: baseAccountError } = await admin
        .from('base_account')
        .select('username')
        .eq('username', normalizedUsername)
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
        .eq('username', normalizedUsername)
        .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
    }

    return !profileUser;
}

export async function checkUsernameAvailability(username) {
    const admin = getSupabaseAdminClient();
    return ensureUsernameAvailable(admin, username);
}
