'use client';

import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDontShowAgain(localStorage.getItem('showLogoutConfirmation') === 'false');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (dontShowAgain) {
            localStorage.setItem('showLogoutConfirmation', 'false');
        } else {
            localStorage.removeItem('showLogoutConfirmation');
        }

        onConfirm();
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader className="items-center text-center sm:items-start sm:text-left">
                    <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <LogOut className="size-7" />
                    </div>
                    <AlertDialogTitle className="text-2xl">Sign out?</AlertDialogTitle>
                    <AlertDialogDescription className="max-w-sm">
                        Are you sure you want to sign out? You&apos;ll need to sign back in to access your conversations.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <Checkbox
                        id="dont-show-again"
                        checked={dontShowAgain}
                        onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                    />
                    <Label htmlFor="dont-show-again" className="cursor-pointer text-sm font-normal text-muted-foreground">
                        Don&apos;t show this again
                    </Label>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button variant="destructive" onClick={handleConfirm}>
                            Confirm Sign Out
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default LogoutModal;
