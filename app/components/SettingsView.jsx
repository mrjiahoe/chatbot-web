'use client';
import React, { useState, useEffect } from 'react';
import { Settings, User, Mail, Bell, Shield, Save, Key, Briefcase, Monitor, Loader2, AtSign, Smile } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUser } from '../../lib/auth';

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
        digest: true
    });
    const [general, setGeneral] = useState({
        logoutConfirmation: typeof window !== 'undefined' ? localStorage.getItem('showLogoutConfirmation') !== 'false' : true
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
                        username: data.username,
                        nickname: data.nickname,
                        firstName: data.first_name || '',
                        lastName: data.last_name || '',
                        email: user.email,
                        onboardingCompleted: data.onboarding_completed,
                    });
                } else if (error && error.code === 'PGRST116') {
                    // Profile doesn't exist yet, handle gracefully
                    setProfile(prev => ({ ...prev, email: user.email }));
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
                        first_name: profile.firstName,
                        last_name: profile.lastName,
                        onboarding_completed: profile.onboardingCompleted
                    });
                }
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        }
        setIsSaving(false);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account information and preferences</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <Loader2 size={18} className="mr-2 animate-spin" />
                        ) : (
                            <Save size={18} className="mr-2" />
                        )}
                        Save Changes
                    </button>
                </div>

                {/* Account Details Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <User size={20} className="mr-2 text-blue-500" /> Account Details
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {message.text && (
                            <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30'}`}>
                                {message.text}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                <div className="relative">
                                    <AtSign size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={profile.username}
                                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nickname</label>
                                <div className="relative">
                                    <Smile size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={profile.nickname}
                                        onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={profile.firstName}
                                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={profile.lastName}
                                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    value={profile.email}
                                    readOnly
                                    className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">Email cannot be changed directly.</p>
                        </div>
                    </div>
                </div>

                {/* Notifications Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <Bell size={20} className="mr-2 text-orange-500" /> Notification Settings
                        </h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Email Alerts</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Receive summaries and important updates via email.</p>
                            </div>
                            <button
                                onClick={() => setNotifications({ ...notifications, email: !notifications.email })}
                                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${notifications.email ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.email ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Real-time alerts in your browser.</p>
                            </div>
                            <button
                                onClick={() => setNotifications({ ...notifications, push: !notifications.push })}
                                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${notifications.push ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.push ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* General Preferences Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <Monitor size={20} className="mr-2 text-purple-500" /> General Preferences
                        </h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Logout Confirmation</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Show a confirmation prompt before signing out.</p>
                            </div>
                            <button
                                onClick={() => {
                                    const newValue = !general.logoutConfirmation;
                                    setGeneral({ ...general, logoutConfirmation: newValue });
                                    localStorage.setItem('showLogoutConfirmation', newValue.toString());
                                }}
                                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${general.logoutConfirmation ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${general.logoutConfirmation ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <Shield size={20} className="mr-2 text-red-500" /> Security & Privacy
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-100 dark:border-gray-700 rounded-xl">
                            <div className="flex items-start">
                                <Key size={20} className="mt-1 mr-3 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Password Management</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Regularly updating your password increases security.</p>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                Update Password
                            </button>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-100 dark:border-gray-700 rounded-xl">
                            <div className="flex items-start">
                                <Monitor size={20} className="mt-1 mr-3 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Active Sessions</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Manage areas where you are logged in.</p>
                                </div>
                            </div>
                            <button className="px-4 py-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
                                View Sessions
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
