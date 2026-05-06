'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, AtSign, CheckCircle2, Loader2, User } from 'lucide-react';
import { fetchCurrentAccessProfile } from '@/lib/access';
import { supabase } from '../../lib/supabase';
import { getSession } from '../../lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

function OnboardingPageContent() {
    const [username, setUsername] = useState('');
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState(null);
    const [error, setError] = useState(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const isPreviewMode = searchParams.get('preview') === '1';

    useEffect(() => {
        const checkSession = async () => {
            if (isPreviewMode) {
                return;
            }

            try {
                const { session } = await getSession();
                const user = session?.user;

                if (!user) {
                    router.replace('/welcome');
                    return;
                }

                const accessProfile = await fetchCurrentAccessProfile({
                    supabase,
                    authUser: user,
                });

                if (accessProfile?.onboarding_completed) {
                    router.replace('/');
                }
            } catch (loadError) {
                console.error('Failed to load onboarding profile:', loadError);
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : loadError?.message || 'Unable to load onboarding right now.'
                );
            }
        };

        checkSession();
    }, [isPreviewMode, router]);

    useEffect(() => {
        if (!username || username.length < 3) {
            setIsChecking(false);
            setUsernameStatus(null);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setIsChecking(true);
            const normalizedUsername = username.trim().toLowerCase();

            try {
                const response = await fetch(
                    `/api/auth/username-availability?username=${encodeURIComponent(normalizedUsername)}`,
                    {
                        cache: 'no-store',
                        signal: controller.signal,
                    }
                );
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload?.error || 'Unable to check username availability.');
                }

                setUsernameStatus(payload?.available ? 'available' : 'taken');
            } catch (checkError) {
                if (checkError?.name === 'AbortError') {
                    return;
                }

                console.error(checkError);
                setUsernameStatus(null);
            } finally {
                if (!controller.signal.aborted) {
                    setIsChecking(false);
                }
            }
        }, 500);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [username]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (usernameStatus !== 'available') return;

        setIsLoading(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        const response = await fetch('/api/account/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username.toLowerCase(),
                nickname,
                onboardingCompleted: true,
            }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            setError(payload?.error || 'Unable to complete onboarding right now.');
            setIsLoading(false);
        } else {
            router.replace('/');
        }
    };

    return (
        <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6 md:p-10">
            <div className="w-full max-w-lg space-y-6">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
                        <User className="size-8" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        One last step
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                        Personalize your profile
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Choose a unique username and a display nickname so your workspace feels like yours.
                    </p>
                </div>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Complete Profile</CardTitle>
                        <CardDescription>
                            This information will be shown across your workspace and can be updated later.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <FieldGroup className="gap-5">
                                <Field>
                                    <FieldLabel htmlFor="username">Unique Username</FieldLabel>
                                    <div className="relative">
                                        <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="username"
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                            placeholder="johndoe"
                                            className="pl-9 pr-11"
                                        />
                                        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
                                            {isChecking ? (
                                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                            ) : usernameStatus === 'available' ? (
                                                <CheckCircle2 className="size-4 text-emerald-500" />
                                            ) : usernameStatus === 'taken' ? (
                                                <span className="text-[10px] font-bold uppercase tracking-tighter text-red-500">
                                                    Taken
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <FieldDescription>
                                        Only letters, numbers, and underscores are allowed.
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="nickname">Display Nickname</FieldLabel>
                                    <Input
                                        id="nickname"
                                        type="text"
                                        required
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="John Doe"
                                    />
                                </Field>
                            </FieldGroup>

                            <Button
                                type="submit"
                                disabled={isLoading || usernameStatus !== 'available'}
                                className="w-full gap-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <>
                                        Complete Profile
                                        <ArrowRight className="size-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-svh bg-muted/30" />}>
            <OnboardingPageContent />
        </Suspense>
    );
}
