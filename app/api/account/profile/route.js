import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAccessProfile, fetchCurrentAccessProfile } from '@/lib/access';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getServerSupabaseClient } from '@/lib/serverSupabase';

const profileSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters.')
        .max(225, 'Username is too long.')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.')
        .optional(),
    nickname: z.string().trim().max(255, 'Nickname is too long.').optional(),
    firstName: z.string().trim().max(255, 'First name is too long.').optional(),
    lastName: z.string().trim().max(255, 'Last name is too long.').optional(),
    onboardingCompleted: z.boolean().optional(),
}).strict();

function firstValidationMessage(zodError) {
    const issue = zodError.issues[0];
    return issue?.message ?? 'Invalid profile data.';
}

export async function PATCH(request) {
    try {
        const body = await request.json();
        const parsed = profileSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: firstValidationMessage(parsed.error) },
                { status: 400 }
            );
        }

        const supabase = await getServerSupabaseClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const admin = getSupabaseAdminClient();
        const accessProfile = await fetchCurrentAccessProfile({
            supabase: admin,
            authUser: user,
        });
        const { username, nickname, firstName, lastName, onboardingCompleted } = parsed.data;
        const normalizedUsername = username?.trim().toLowerCase();
        const profilePayload = {
            id: user.id,
            username: normalizedUsername || accessProfile.username || null,
            nickname: nickname ?? accessProfile.nickname ?? '',
            first_name: firstName ?? accessProfile.first_name ?? '',
            last_name: lastName ?? accessProfile.last_name ?? '',
            onboarding_completed: onboardingCompleted ?? accessProfile.onboarding_completed ?? false,
            updated_at: new Date().toISOString(),
        };

        if (accessProfile.hasBaseAccount && normalizedUsername) {
            const { error: baseAccountError } = await admin
                .from('base_account')
                .update({ username: normalizedUsername })
                .eq('auth_user_id', user.id);

            if (baseAccountError) {
                throw baseAccountError;
            }
        }

        const { data: profileData, error: profileError } = await admin
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' })
            .select('*')
            .single();

        if (profileError) {
            throw profileError;
        }

        const mergedProfile = buildAccessProfile({
            authUser: user,
            profile: profileData,
            baseAccount: accessProfile.hasBaseAccount
                ? {
                    ...accessProfile.baseAccount,
                    username: normalizedUsername || accessProfile.username || '',
                    email: accessProfile.email || user.email || '',
                }
                : null,
        });

        return NextResponse.json({
            profile: mergedProfile,
        });
    } catch (error) {
        if (error?.code === '23505') {
            return NextResponse.json(
                { error: 'That username is already taken.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to update profile.',
            },
            { status: 500 }
        );
    }
}
