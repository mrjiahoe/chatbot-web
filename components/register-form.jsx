'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    CheckCircle2,
    Loader2,
    Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signUp, signInWithGoogle } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function RegisterForm() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState(null);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        if (!username || username.length < 3) {
            setUsernameStatus(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsCheckingUsername(true);
            const normalizedUsername = username.trim().toLowerCase();

            const { data: baseAccountUser, error: baseAccountError } = await supabase
                .from('base_account')
                .select('username')
                .eq('username', normalizedUsername)
                .maybeSingle();

            if (baseAccountError && baseAccountError.code !== 'PGRST116') {
                console.error(baseAccountError);
                setIsCheckingUsername(false);
                return;
            }

            if (baseAccountUser) {
                setUsernameStatus('taken');
                setIsCheckingUsername(false);
                return;
            }

            const { data: profileUser, error: profileError } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', normalizedUsername)
                .maybeSingle();

            if (profileError) {
                console.error(profileError);
            } else if (profileUser) {
                setUsernameStatus('taken');
            } else {
                setUsernameStatus('available');
            }

            setIsCheckingUsername(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [username]);

    const handleRegister = async (event) => {
        event.preventDefault();

        if (usernameStatus !== 'available') {
            setError('Choose an available username before creating your account.');
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setIsLoading(true);
        setError(null);

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim().toLowerCase();

        const { data, error: signUpError } = await signUp({
            email: normalizedEmail,
            password,
            metadata: {
                username: normalizedUsername,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            },
        });

        if (signUpError) {
            setError(signUpError.message);
            setIsLoading(false);
            return;
        }

        if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
            setError('This email is already registered or still pending confirmation. If you deleted only from profiles, also delete the user in Supabase Auth > Users.');
            setIsLoading(false);
            return;
        }

        setIsSuccess(true);
        setIsLoading(false);
        setTimeout(() => {
            router.push('/login');
        }, 3000);
    };

    const handleGoogleRegister = async () => {
        setError(null);
        const { error: googleError } = await signInWithGoogle();
        if (googleError) setError(googleError.message);
    };

    if (isSuccess) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-6 pt-10 text-center">
                    <div className="flex size-20 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                        <CheckCircle2 className="size-10" />
                    </div>
                    <div className="grid gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
                        <p className="text-sm text-muted-foreground">
                            We&apos;ve sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
                            Please verify your account to continue.
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/login">Back to login</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Create your account</CardTitle>
                    <CardDescription>Enter your details below to create your account</CardDescription>
                </CardHeader>

                <CardContent>
                    <div className="grid gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleRegister}
                            className="w-full justify-center gap-3"
                            disabled={isLoading}
                        >
                            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.69-2.31 1.14-3.71 1.14-2.84 0-5.25-1.91-6.11-4.48H2.26v2.81C4.09 20.65 7.73 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.89 14.23c-.22-.67-.35-1.39-.35-2.13s.13-1.46.35-2.13V7.16H2.26C1.16 9.38 0.53 11.9 0.53 12.5s.63 3.12 1.73 5.34l3.63-2.61z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.73 1 4.09 3.35 2.26 6.36l3.63 2.81c.86-2.57 3.27-4.48 6.11-4.48z"
                                />
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="relative">
                            <FieldDescription className="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 bg-card px-2">
                                Or continue with email
                            </FieldDescription>
                            <div className="h-px w-full bg-border" />
                        </div>

                        {error && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleRegister}>
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="username">Username</FieldLabel>
                                    <Input
                                        id="username"
                                        type="text"
                                        placeholder="johndoe"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                        required
                                    />
                                    <FieldDescription>
                                        {isCheckingUsername
                                            ? 'Checking username availability...'
                                            : usernameStatus === 'taken'
                                                ? 'That username is already taken.'
                                                : usernameStatus === 'available'
                                                    ? 'Username is available.'
                                                    : 'Use at least 3 letters, numbers, or underscores.'}
                                    </FieldDescription>
                                </Field>

                                <Field className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field>
                                        <FieldLabel htmlFor="first-name">First name</FieldLabel>
                                        <Input
                                            id="first-name"
                                            type="text"
                                            placeholder="John"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            required
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                                        <Input
                                            id="last-name"
                                            type="text"
                                            placeholder="Doe"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            required
                                        />
                                    </Field>
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="email">Email</FieldLabel>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="password">Password</FieldLabel>
                                    <div className="relative">
                                        <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-9"
                                            required
                                        />
                                    </div>
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                    <FieldDescription>Must be at least 8 characters long.</FieldDescription>
                                </Field>

                                <Field>
                                    <Button type="submit" className="w-full gap-2" disabled={isLoading || usernameStatus !== 'available'}>
                                        {isLoading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <ArrowRight className="size-4" />
                                        )}
                                        Create Account
                                    </Button>
                                    <FieldDescription className="text-center">
                                        Already have an account?{' '}
                                        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                                            Sign in
                                        </Link>
                                    </FieldDescription>
                                </Field>
                            </FieldGroup>
                        </form>
                    </div>
                </CardContent>
            </Card>

            <FieldDescription className="px-6 text-center">
                By clicking continue, you agree to our{' '}
                <Link href="#" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="#" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Privacy Policy
                </Link>
                .
            </FieldDescription>
        </div>
    );
}
