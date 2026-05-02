import { DEFAULT_ROLE, normalizeRole } from './roles.js';

export const BASE_ACCOUNT_FLAG_FIELDS = Object.freeze([
    'is_active',
    'is_staff',
    'is_superuser',
    'is_teacher',
    'is_ra',
    'is_principal',
    'is_admin',
    'is_management',
    'is_cluster_head',
]);

export const BASE_ACCOUNT_COLUMNS = [
    'id',
    'auth_user_id',
    'username',
    'email',
    'school_name_id',
    'cluster_id',
    ...BASE_ACCOUNT_FLAG_FIELDS,
].join(', ');

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

export function deriveRoleFromBaseAccount(account, fallbackRole = DEFAULT_ROLE) {
    if (!account) {
        return normalizeRole(fallbackRole);
    }

    if (account.is_active === false) {
        return 'inactive';
    }

    if (account.is_superuser) {
        return 'super_admin';
    }

    if (account.is_admin) {
        return 'admin';
    }

    if (account.is_management || account.is_principal || account.is_cluster_head) {
        return 'principal';
    }

    if (account.is_ra) {
        return 'analyst';
    }

    if (account.is_teacher || account.is_staff) {
        return 'teacher';
    }

    return normalizeRole(fallbackRole);
}

export function buildAccessProfile({ authUser = null, profile = null, baseAccount = null }) {
    const storedRole = normalizeRole(profile?.role);
    const effectiveRole = baseAccount
        ? deriveRoleFromBaseAccount(baseAccount, storedRole)
        : storedRole;
    const onboardingCompleted = Boolean(profile?.onboarding_completed);

    return {
        ...profile,
        id: profile?.id || authUser?.id || null,
        email: baseAccount?.email || authUser?.email || profile?.email || '',
        username: baseAccount?.username || profile?.username || '',
        hasProfile: Boolean(profile),
        hasBaseAccount: Boolean(baseAccount),
        onboarding_completed: onboardingCompleted,
        storedRole,
        role: storedRole,
        effectiveRole,
        roleSource: baseAccount ? 'base_account' : 'profiles',
        baseAccountId: baseAccount?.id || null,
        baseAccount: baseAccount
            ? {
                id: baseAccount.id,
                school_name_id: baseAccount.school_name_id || null,
                cluster_id: baseAccount.cluster_id || null,
                is_active: baseAccount.is_active ?? null,
                is_staff: Boolean(baseAccount.is_staff),
                is_superuser: Boolean(baseAccount.is_superuser),
                is_teacher: Boolean(baseAccount.is_teacher),
                is_ra: Boolean(baseAccount.is_ra),
                is_principal: Boolean(baseAccount.is_principal),
                is_admin: Boolean(baseAccount.is_admin),
                is_management: Boolean(baseAccount.is_management),
                is_cluster_head: Boolean(baseAccount.is_cluster_head),
            }
            : null,
    };
}

export function normalizeBaseAccountFlags(flags = {}) {
    return BASE_ACCOUNT_FLAG_FIELDS.reduce((accumulator, field) => {
        if (field in flags) {
            accumulator[field] = Boolean(flags[field]);
        }

        return accumulator;
    }, {});
}

export async function fetchCurrentAccessProfile({ supabase, authUser }) {
    const [profileResponse, baseAccountResponse] = await Promise.all([
        supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle(),
        supabase
            .from('base_account')
            .select(BASE_ACCOUNT_COLUMNS)
            .eq('auth_user_id', authUser.id)
            .maybeSingle(),
    ]);

    if (profileResponse.error && profileResponse.error.code !== 'PGRST116') {
        throw profileResponse.error;
    }

    if (baseAccountResponse.error && !isBaseAccountUnavailable(baseAccountResponse.error)) {
        throw baseAccountResponse.error;
    }

    return buildAccessProfile({
        authUser,
        profile: profileResponse.data || null,
        baseAccount: isBaseAccountUnavailable(baseAccountResponse.error)
            ? null
            : baseAccountResponse.data || null,
    });
}

export async function fetchBaseAccountsByAuthUserIds({ supabase, authUserIds }) {
    if (!authUserIds.length) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('base_account')
        .select(BASE_ACCOUNT_COLUMNS)
        .in('auth_user_id', authUserIds);

    if (error) {
        if (isBaseAccountUnavailable(error)) {
            return new Map();
        }

        throw error;
    }

    return new Map(
        (data || [])
            .filter((row) => row.auth_user_id)
            .map((row) => [row.auth_user_id, row])
    );
}
