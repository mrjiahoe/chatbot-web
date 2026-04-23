import React, { useState } from 'react';
import { LogOut, X, Check } from 'lucide-react';
import { Button } from './ui/button';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (dontShowAgain) {
            localStorage.setItem('showLogoutConfirmation', 'false');
        }
        onConfirm();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 animate-scale-in">
                <Button
                    onClick={onClose}
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4"
                >
                    <X size={20} />
                </Button>

                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
                        <LogOut size={32} className="text-red-500" />
                    </div>

                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                        Sign Out?
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed">
                        Are you sure you want to sign out? You'll need to sign back in to access your conversations.
                    </p>

                    <div className="w-full space-y-3">
                        <Button
                            onClick={handleConfirm}
                            variant="destructive"
                            size="lg"
                            className="w-full"
                        >
                            Confirm Sign Out
                        </Button>
                        <Button
                            onClick={onClose}
                            variant="outline"
                            size="lg"
                            className="w-full"
                        >
                            Cancel
                        </Button>
                    </div>

                    <div className="mt-6 flex items-center gap-2 group cursor-pointer" onClick={() => setDontShowAgain(!dontShowAgain)}>
                        <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${dontShowAgain ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100' : 'border-zinc-300 dark:border-zinc-700'}`}>
                            {dontShowAgain && <Check size={12} className="text-white dark:text-zinc-900" />}
                        </div>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors select-none">
                            Don't show this again
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogoutModal;
