'use client';

import React, { useEffect, useState } from 'react';
import {
    AtSign,
    Bell,
    Key,
    Loader2,
    Mail,
    Monitor,
    Save,
    Shield,
    Smile,
    User,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUser } from '../../lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const SettingsView = ({ onProfileUpdate }) => {
    const [profile, setProfile] = useState({
        username: '',
        nickname: '',
        firstName: '',
        lastName: '',
        email: '',
        onboardingCompleted: true,
    });
    const [notifications, setNotifications] = useState({
        email: true,
        push: false,
        digest: true,
    });
    const [general, setGeneral] = useState({
        logoutConfirmation: typeof window !== 'undefined' ? localStorage.getItem('showLogoutConfirmation') !== 'false' : true,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchProfile = async () => {
            const { user } = await getUser();

            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setProfile({
                        username: data.username || '',
                        nickname: data.nickname || '',
                        firstName: data.first_name || '',
                        lastName: data.last_name || '',
                        email: user.email || '',
                        onboardingCompleted: data.onboarding_completed,
                    });
                } else if (error && error.code === 'PGRST116') {
                    setProfile((prev) => ({ ...prev, email: user.email || '' }));
                }
            }

            setIsLoading(false);
        };

        fetchProfile();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        const { user } = await getUser();
        if (user) {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    username: profile.username,
                    nickname: profile.nickname,
                    first_name: profile.firstName,
                    last_name: profile.lastName,
                    onboarding_completed: profile.onboardingCompleted,
                    updated_at: new Date().toISOString(),
                });

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });

                if (onProfileUpdate) {
                    onProfileUpdate({
                        username: profile.username,
                        nickname: profile.nickname,
                        firstName: profile.firstName,
                        lastName: profile.lastName,
                        email: profile.email,
                        onboardingCompleted: profile.onboardingCompleted,
                    });
                }

                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        }

        setIsSaving(false);
    };

    const handleLogoutConfirmationChange = (checked) => {
        const nextValue = checked === true;
        setGeneral({ logoutConfirmation: nextValue });
        localStorage.setItem('showLogoutConfirmation', nextValue.toString());
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="mx-auto max-w-5xl space-y-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Account settings
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Settings
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Manage your profile, notifications, and a few app preferences from one place.
                        </p>
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save Changes
                    </Button>
                </div>

                {message.text && (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                            message.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="size-5 text-primary" />
                            Profile
                        </CardTitle>
                        <CardDescription>
                            Update the details shown across your workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="grid gap-5 md:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="username">Username</FieldLabel>
                                <div className="relative">
                                    <AtSign className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        type="text"
                                        value={profile.username}
                                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                                        className="pl-9"
                                    />
                                </div>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
                                <div className="relative">
                                    <Smile className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="nickname"
                                        type="text"
                                        value={profile.nickname}
                                        onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                                        className="pl-9"
                                    />
                                </div>
                                <FieldDescription>
                                    You can change this anytime.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="first-name">First name</FieldLabel>
                                <Input
                                    id="first-name"
                                    type="text"
                                    value={profile.firstName}
                                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                                    placeholder="Optional"
                                />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                                <Input
                                    id="last-name"
                                    type="text"
                                    value={profile.lastName}
                                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                                    placeholder="Optional"
                                />
                            </Field>

                            <Field className="md:col-span-2">
                                <FieldLabel htmlFor="email">Email address</FieldLabel>
                                <div className="relative">
                                    <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        value={profile.email}
                                        readOnly
                                        className="cursor-not-allowed bg-muted/50 pl-9 text-muted-foreground"
                                    />
                                </div>
                                <FieldDescription>
                                    Email cannot be changed directly.
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="size-5 text-primary" />
                            Notifications
                        </CardTitle>
                        <CardDescription>
                            Decide how you want to hear about activity in the app.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            {
                                key: 'email',
                                title: 'Email Alerts',
                                description: 'Receive summaries and important updates via email.',
                            },
                            {
                                key: 'push',
                                title: 'Push Notifications',
                                description: 'Get real-time alerts in your browser.',
                            },
                        ].map((item, index) => (
                            <React.Fragment key={item.key}>
                                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                                        <p className="text-sm text-muted-foreground">{item.description}</p>
                                    </div>
                                    <Switch
                                        checked={notifications[item.key]}
                                        onCheckedChange={(checked) =>
                                            setNotifications((prev) => ({ ...prev, [item.key]: checked === true }))
                                        }
                                    />
                                </div>
                                {index < 2 && <Separator />}
                            </React.Fragment>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Monitor className="size-5 text-primary" />
                            Preferences
                        </CardTitle>
                        <CardDescription>
                            Fine-tune a couple of small app behaviors.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">Logout Confirmation</p>
                                <p className="text-sm text-muted-foreground">
                                    Show a confirmation prompt before signing out.
                                </p>
                            </div>
                            <Switch
                                checked={general.logoutConfirmation}
                                onCheckedChange={handleLogoutConfirmationChange}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="size-5 text-primary" />
                            Security
                        </CardTitle>
                        <CardDescription>
                            Keep your account safe and review active access when needed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-lg border border-border p-4">
                                <div className="space-y-2">
                                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <Key className="size-4 text-primary" />
                                        Password Management
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Regularly updating your password increases security.
                                    </p>
                                </div>
                                <div className="mt-4">
                                    <Button variant="outline" className="w-full sm:w-auto">
                                        Update Password
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border p-4">
                                <div className="space-y-2">
                                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <Monitor className="size-4 text-primary" />
                                        Active Sessions
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Manage the places where you are currently logged in.
                                    </p>
                                </div>
                                <div className="mt-4">
                                    <Button variant="outline" className="w-full sm:w-auto">
                                        View Sessions
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SettingsView;
