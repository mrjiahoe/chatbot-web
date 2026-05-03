'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { RegisterForm } from '@/components/register-form';

export default function RegisterPage() {
    const [theme, setTheme] = useState('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const savedTheme = window.localStorage.getItem('theme');
        const defaultTheme = savedTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(defaultTheme);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        document.documentElement.classList.toggle('dark', theme === 'dark');
        window.localStorage.setItem('theme', theme);
    }, [theme, mounted]);

    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <button
                type="button"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                className="absolute top-6 right-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm shadow-black/5 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-800"
                aria-label="Toggle light and dark theme"
            >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a href="/welcome" className="flex items-center gap-2 self-center font-medium">
                    <div className="flex size-8 items-center justify-center overflow-hidden rounded-md bg-white shadow-sm">
                        <img
                            src="/logo/logo.png?v=20260503-1532"
                            alt="NaLDAC logo"
                            className="size-full object-contain"
                        />
                    </div>
                    NaLDAC
                </a>
                <RegisterForm />
            </div>
        </div>
    );
}
