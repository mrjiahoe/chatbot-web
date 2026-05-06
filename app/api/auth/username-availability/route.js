import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkUsernameAvailability, normalizeUsername } from '@/lib/usernameAvailability';

const usernameSchema = z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(225, 'Username is too long.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.');

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const parsed = usernameSchema.safeParse(searchParams.get('username') || '');

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Invalid username.' },
                { status: 400 }
            );
        }

        const username = normalizeUsername(parsed.data);
        const available = await checkUsernameAvailability(username);

        return NextResponse.json({
            username,
            available,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to check username availability.',
            },
            { status: 500 }
        );
    }
}
