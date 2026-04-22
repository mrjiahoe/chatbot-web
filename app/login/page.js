'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Form } from '@base-ui/react/form';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Button } from '@base-ui/react/button';
import { signIn, signInWithGoogle } from '../../lib/auth';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleLogin = async (values) => {
        setIsLoading(true);
        setError(null);

        const email = typeof values?.email === 'string' ? values.email : '';
        const password = typeof values?.password === 'string' ? values.password : '';

        const { error } = await signIn({ email, password });

        if (error) {
            setError(error.message);
            setIsLoading(false);
        } else {
            router.push('/');
        }
    };

    const handleGoogleLogin = async () => {
        const { error } = await signInWithGoogle();
        if (error) setError(error.message);
    };

    return (
        <div className="min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 flex flex-col justify-center items-center px-6 selection:bg-black/10 dark:selection:bg-white/10 transition-colors duration-500">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black mb-6 shadow-2xl shadow-black/10 transition-transform hover:scale-105 duration-300">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">Welcome back</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Enter your credentials to access your account</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                    <Button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-all mb-6 active:scale-[0.98]"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
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

                    <div className="relative flex items-center justify-center mb-6">
                        <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
                        <span className="flex-shrink mx-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">or email</span>
                        <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
                    </div>

                    <Form onFormSubmit={handleLogin} validationMode="onBlur" className="space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                {error}
                            </div>
                        )}

                        <Field.Root name="email" className="space-y-2">
                            <Field.Label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Email address</Field.Label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                <Input
                                    type="email"
                                    required
                                    placeholder="name@company.com"
                                    autoComplete="email"
                                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </Field.Root>

                        <Field.Root name="password" className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <Field.Label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Password</Field.Label>
                                <Link href="#" className="text-xs font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors">Forgot password?</Link>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                <Input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </Field.Root>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-black/5 dark:shadow-white/5"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Sign in
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </Button>
                    </Form>

                    <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Don't have an account?{' '}
                            <Link href="/register" className="font-bold text-black dark:text-white hover:underline transition-all">
                                Create one for free
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-wide">
                        SECURE AUTHENTICATION POWERED BY SUPABASE
                    </p>
                </div>
            </div>
        </div>
    );
}
