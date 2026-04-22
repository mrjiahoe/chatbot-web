'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, AtSign, Loader2, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUser } from '../../lib/auth';

export default function OnboardingPage() {
    const [username, setUsername] = useState('');
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState(null); // 'available', 'taken', null
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const checkSession = async () => {
            const { user } = await getUser();
            if (!user) {
                router.push('/welcome');
                return;
            }

            // Check if profile already completed
            const { data: profile } = await supabase
                .from('profiles')
                .select('onboarding_completed')
                .eq('id', user.id)
                .single();

            if (profile?.onboarding_completed) {
                router.push('/');
            }
        };
        checkSession();
    }, []);

    // Debounced username check
    useEffect(() => {
        if (!username || username.length < 3) {
            setUsernameStatus(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsChecking(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', username.toLowerCase())
                .maybeSingle();

            if (error) {
                console.error(error);
            } else if (data) {
                setUsernameStatus('taken');
            } else {
                setUsernameStatus('available');
            }
            setIsChecking(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [username]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (usernameStatus !== 'available') return;

        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();

        const { error: updateError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                username: username.toLowerCase(),
                nickname: nickname,
                onboarding_completed: true
            });

        if (updateError) {
            setError(updateError.message);
            setIsLoading(false);
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 flex flex-col justify-center items-center px-6 transition-colors duration-500">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black mb-6 shadow-2xl shadow-black/10">
                        <User size={32} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">One last step</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Let's personalize your profile</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Unique Username</label>
                            <div className="relative group">
                                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                    placeholder="johndoe"
                                    className="w-full pl-12 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                    {isChecking ? (
                                        <Loader2 className="animate-spin text-zinc-400" size={18} />
                                    ) : usernameStatus === 'available' ? (
                                        <CheckCircle2 className="text-emerald-500" size={18} />
                                    ) : usernameStatus === 'taken' ? (
                                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Taken</span>
                                    ) : null}
                                </div>
                            </div>
                            <p className="text-[11px] text-zinc-400 ml-1">Only letters, numbers and underscores allowed.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Display Nickname</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || usernameStatus !== 'available'}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/5 dark:shadow-white/5"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    Complete Profile
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
