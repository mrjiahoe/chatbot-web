'use client';
import React, { useState } from 'react';
import { Palette, Moon, Sun, Monitor, Globe, Save, Info, Plus } from 'lucide-react';

const PersonalizationView = ({ theme, setTheme }) => {
    const [bio, setBio] = useState('Experienced data analyst with a passion for insights and visualization.');

    const handleSave = () => {
        // Placeholder for save logic
        alert('Personalization saved!');
    };

    return (
        <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Personalization</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Customize your experience and public profile</p>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                    >
                        <Save size={18} className="mr-2" /> Save Changes
                    </button>
                </div>

                {/* Appearance Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center">
                            <Palette size={20} className="mr-2 text-blue-500" /> Appearance
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                            >
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 text-orange-400">
                                    <Sun size={24} />
                                </div>
                                <span className="font-medium text-zinc-900 dark:text-white">Light</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                            >
                                <div className="w-12 h-12 rounded-full bg-zinc-900 shadow-sm flex items-center justify-center mb-3 text-indigo-400">
                                    <Moon size={24} />
                                </div>
                                <span className="font-medium text-zinc-900 dark:text-white">Dark</span>
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                            >
                                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-3 text-zinc-600 dark:text-zinc-400">
                                    <Monitor size={24} />
                                </div>
                                <span className="font-medium text-zinc-900 dark:text-white">System</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Profile Identity Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center">
                            <Info size={20} className="mr-2 text-indigo-500" /> Profile Identity
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Public Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows="4"
                                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow resize-none"
                                placeholder="Tell us about yourself..."
                            />
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Brief description for your profile. This will be visible to collaborators.</p>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center">
                                <Globe size={16} className="mr-2 text-zinc-400" /> Default Language
                            </label>
                            <select className="w-full md:w-64 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                                <option>English (US)</option>
                                <option>English (UK)</option>
                                <option>Spanish</option>
                                <option>French</option>
                                <option>German</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* AI Interaction Styles (New Section) */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center">
                            <Plus size={20} className="mr-2 text-green-500" /> Response Preferences
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            <label className="flex items-center p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer group">
                                <input type="radio" name="style" className="w-4 h-4 text-blue-600" defaultChecked />
                                <div className="ml-4 text-left">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Concise & Direct</p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Short answers focused on immediate results.</p>
                                </div>
                            </label>
                            <label className="flex items-center p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer group">
                                <input type="radio" name="style" className="w-4 h-4 text-blue-600" />
                                <div className="ml-4 text-left">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Detailed & Explanatory</p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Comprehensive answers with step-by-step logic.</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonalizationView;
