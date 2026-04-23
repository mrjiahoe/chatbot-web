'use client';

import React, { useEffect, useState } from 'react';
import {
    AtSign,
    Bell,
    Globe,
    Key,
    Loader2,
    Mail,
    Monitor,
    Moon,
    Palette,
    Save,
    Shield,
    Smile,
    User,
    Sun,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUser } from '../../lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const themeOptions = [
    {
        value: 'light',
        title: 'Light',
        description: 'A bright, clean interface for daytime use.',
        icon: Sun,
    },
    {
        value: 'dark',
        title: 'Dark',
        description: 'A low-light interface with stronger contrast.',
        icon: Moon,
    },
    {
        value: 'system',
        title: 'System',
        description: 'Follow your operating system preference.',
        icon: Monitor,
    },
];

const SettingsView = ({ onProfileUpdate, theme, setTheme }) => {
    const [profile, setProfile] = useState({
        username: '',
        nickname: '',
        firstName: '',
        lastName: '',
        email: '',
        onboardingCompleted: true,
    });
    const [bio, setBio] = useState(() =>
        typeof window !== 'undefined'
            ? localStorage.getItem('workspaceBio') || 'Experienced data analyst with a passion for insights and visualization.'
            : 'Experienced data analyst with a passion for insights and visualization.'
    );
    const [language, setLanguage] = useState(() =>
        typeof window !== 'undefined'
            ? localStorage.getItem('workspaceLanguage') || 'English (US)'
            : 'English (US)'
    );
    const [notifications, setNotifications] = useState({
        email: true,
        push: false,
        digest: true,
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
                localStorage.setItem('workspaceBio', bio);
                localStorage.setItem('workspaceLanguage', language);

                setMessage({ type: 'success', text: 'Settings updated successfully!' });

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

                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="gap-2 transition-colors hover:bg-emerald-600 hover:text-white"
                    >
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
                            <Palette className="size-5 text-primary" />
                            Appearance
                        </CardTitle>
                        <CardDescription>
                            Choose the theme that feels best while you work.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            {themeOptions.map((option) => {
                                const Icon = option.icon;
                                const isActive = theme === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setTheme(option.value)}
                                        className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                                            isActive
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-border bg-card hover:bg-muted/50'
                                        }`}
                                    >
                                        <div
                                            className={`mb-4 flex size-11 items-center justify-center rounded-xl ${
                                                option.value === 'light'
                                                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300'
                                                    : option.value === 'dark'
                                                        ? 'bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                                        : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            <Icon className="size-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">{option.title}</p>
                                            <p className="text-sm text-muted-foreground">{option.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="size-5 text-primary" />
                            Workspace Defaults
                        </CardTitle>
                        <CardDescription>
                            Add a personal bio and choose the default language for your workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="bio">Public Bio</FieldLabel>
                                <FieldContent>
                                    <Textarea
                                        id="bio"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell us about yourself..."
                                    />
                                    <FieldDescription>
                                        This can be shown to collaborators who can view your profile.
                                    </FieldDescription>
                                </FieldContent>
                            </Field>
                        </FieldGroup>

                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="language">Default Language</FieldLabel>
                                <FieldContent>
                                    <Select value={language} onValueChange={setLanguage}>
                                        <SelectTrigger id="language">
                                            <SelectValue placeholder="Choose a language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="English (US)">English (US)</SelectItem>
                                            <SelectItem value="English (UK)">English (UK)</SelectItem>
                                            <SelectItem value="Spanish">Spanish</SelectItem>
                                            <SelectItem value="French">French</SelectItem>
                                            <SelectItem value="German">German</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FieldContent>
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card> */}

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
                            <Shield className="size-5 text-primary" />
                            Security
                        </CardTitle>
                        <CardDescription>
                            Keep your account safe and manage password access.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Key className="size-4 text-primary" />
                                    Password Management
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Regularly updating your password increases security.
                                </p>
                            </div>
                                <Button
                                    variant="outline"
                                    className="w-full border-amber-200 text-amber-700 transition-colors hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/20 dark:hover:text-amber-300 sm:w-auto"
                                >
                                    Update Password
                                </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SettingsView;
