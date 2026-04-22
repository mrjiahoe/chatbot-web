'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Sparkles, Database, Lock, Sun, Moon } from 'lucide-react';

export default function WelcomePage() {
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

    const toggleTheme = () => {
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    };

    return (
        <div className="min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 flex flex-col items-center justify-center px-6 transition-colors duration-500">
            <div className="w-full max-w-2xl text-center">
                <div className="flex items-center justify-end mb-8">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm shadow-black/5 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-800"
                        aria-label="Toggle light and dark theme"
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    
                    </button>
                </div>
                {/* Hero Icon */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-black dark:bg-white text-white dark:text-black mb-10 shadow-2xl shadow-black/10 transition-transform hover:scale-110 duration-500">
                    <ShieldCheck size={40} />
                </div>

                {/* Main Heading */}
                <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6 leading-tight">
                    Analyze Data with <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-500 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100">AI Intelligence.</span>
                </h1>

                {/* Subtext */}
                <p className="text-xl text-zinc-500 dark:text-zinc-400 mb-12 max-w-lg mx-auto leading-relaxed">
                    A secure platform for intelligent conversations with your data files.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                    <Link
                        href="/login"
                        className="w-full sm:w-auto px-10 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-[0.98] shadow-xl shadow-black/5 dark:shadow-white/5"
                    >
                        Get Started
                        <ArrowRight size={20} />
                    </Link>
                </div>

                {/* Feature Grid (Minimalist) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-zinc-100 dark:border-zinc-900 pt-16 mt-8">
                    <div className="flex flex-col gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                            <Sparkles size={20} />
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">AI Driven</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Deep analysis powered by latest LLMs.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                            <Database size={20} />
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">Data Secure</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Granular column-level access control.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                            <Lock size={20} />
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">Production Ready</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Built for scale and professional use.</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-20 py-8 text-zinc-400 dark:text-zinc-600 font-medium text-xs tracking-widest uppercase">
                &copy; 2025 Data Analytic Chatbot
            </footer>
        </div>
    );
}
