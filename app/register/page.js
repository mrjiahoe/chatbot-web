'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Lock, Loader2, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { signUp, signInWithGoogle } from '../../lib/auth';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [nickname, setNickname] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleRegister = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setIsLoading(true);
        setError(null);

        console.log('Registering with:', { email, username, nickname });

        const normalizedEmail = email.trim().toLowerCase();

        const { data, error } = await signUp({
            email: normalizedEmail,
            password,
            metadata: {
                username,
                nickname,
                first_name: firstName,
                last_name: lastName
            }
        });

        if (error) {
            setError(error.message);
            setIsLoading(false);
        } else if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
            setError('This email is already registered or still pending confirmation. If you deleted only from profiles, also delete the user in Supabase Auth > Users.');
            setIsLoading(false);
        } else {
            setIsSuccess(true);
            setIsLoading(false);
            // Optional: short delay before redirect or show check email message
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        }
    };

    const handleGoogleRegister = async () => {
        const { error } = await signInWithGoogle();
        if (error) setError(error.message);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 flex flex-col justify-center items-center px-6 transition-colors duration-500">
                <div className="w-full max-w-md text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 mb-8 animate-bounce-subtle">
                        <CheckCircle2 size={40} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">Check your email</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-8">
                        We've sent a confirmation link to <span className="text-black dark:text-white font-bold">{email}</span>. Please verify your account to continue.
                    </p>
                    <Link href="/login" className="text-sm font-bold text-black dark:text-white hover:underline">
                        Back to login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 flex flex-col justify-center items-center px-6 selection:bg-black/10 dark:selection:bg-white/10 transition-colors duration-500">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black mb-6 shadow-2xl shadow-black/10 transition-transform hover:scale-105 duration-300">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">Create an account</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Join thousands of researchers using DataChat</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                    <button
                        onClick={handleGoogleRegister}
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
                    </button>

                    <div className="relative flex items-center justify-center mb-6">
                        <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
                        <span className="flex-shrink mx-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">or email</span>
                        <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Email address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="johndoe"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Nickname</label>
                                <input
                                    type="text"
                                    required
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Johnny"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">First Name (Opt)</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="John"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Last Name (Opt)</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Doe"
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-black/5 dark:shadow-white/5"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Create account
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Already have an account?{' '}
                            <Link href="/login" className="font-bold text-black dark:text-white hover:underline transition-all">
                                Sign in instead
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-12 text-center text-zinc-400 dark:text-zinc-500 font-medium text-xs">
                    By joining, you agree to our Terms of Service and Privacy Policy.
                </div>
            </div>
        </div>
    );
}
