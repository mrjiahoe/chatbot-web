'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AtSign,
    ArrowRight,
    Loader2,
    Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { signIn, signInWithGoogle } from '../lib/auth';

export function LoginForm() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleLogin = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const { error: signInError } = await signIn({
            identifier: identifier.trim(),
            password,
        });

        if (signInError) {
            setError(signInError.message);
            setIsLoading(false);
            return;
        }

        router.push('/');
    };

    const handleGoogleLogin = async () => {
        setError(null);
        const { error: googleError } = await signInWithGoogle();
        if (googleError) setError(googleError.message);
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <CardDescription>Sign in to continue to your workspace.</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleLogin}
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
                    <Separator />
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
                        Or continue with email or username
                    </span>
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <form className="grid gap-4" onSubmit={handleLogin}>
                    <div className="grid gap-2">
                        <Label htmlFor="identifier">Email or username</Label>
                        <div className="relative">
                            <AtSign className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="identifier"
                                name="identifier"
                                type="text"
                                autoComplete="username"
                                placeholder="name@company.com or johndoe"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">Password</Label>
                            <Link
                                href="#"
                                className="ml-auto text-sm underline-offset-4 hover:underline text-muted-foreground"
                            >
                                Forgot your password?
                            </Link>
                        </div>
                        <div className="relative">
                            <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                        {isLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <ArrowRight className="size-4" />
                        )}
                        Login
                    </Button>
                </form>
            </CardContent>

            <CardFooter className="flex-col gap-2">
                <div className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
                        Sign up
                    </Link>
                </div>
            </CardFooter>
        </Card>
    );
}
