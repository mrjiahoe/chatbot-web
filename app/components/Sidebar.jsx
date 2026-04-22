'use client';
import React, { useState } from 'react';
import { MessageSquare, Database, Settings, HelpCircle, Plus, ChartNoAxesCombined, User, Palette, Clock, ChevronLeft, ChevronRight, FileText, Menu, X, LogOut } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, onNewChat, onSelectChat, recentChats, activeChatId, onLogout, user, profile }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const mainMenuItems = [
        { icon: MessageSquare, label: 'Chat', id: 'Chat' },
        { icon: Database, label: 'Data', id: 'DataCenter' },
    ];

    const toggleSidebar = (e) => {
        if (e) e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <aside
            className={`flex flex-col py-6 h-screen transition-all duration-300 ease-in-out bg-white dark:bg-zinc-950 shrink-0 border-r border-black/5 dark:border-white/5 z-20 relative ${isExpanded ? 'w-64 px-4' : 'w-16 md:w-20 items-center'}`}
        >
            {/* Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="absolute -right-3 top-16 w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-black dark:hover:text-white shadow-lg z-[999] transition-all hover:scale-110 active:scale-95"
                title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
                {isExpanded ? <X size={16} /> : <Menu size={16} />}
            </button>

            {/* Logo area */}
            <div className={`mb-8 flex items-center ${isExpanded ? 'px-2 gap-3' : 'justify-center'}`}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-black dark:from-white dark:to-zinc-300 flex items-center justify-center shadow-md shrink-0">
                    <ChartNoAxesCombined size={20} className="text-white dark:text-black" />
                </div>
                {isExpanded && (
                    <span className="font-bold text-xl tracking-tight animate-fade-in whitespace-nowrap">Antigravity</span>
                )}
            </div>

            {/* New Chat Button */}
            <button
                onClick={onNewChat}
                className={`flex items-center rounded-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:-translate-y-0.5 transition-all mb-6 group overflow-hidden ${isExpanded ? 'w-full px-4 py-2.5 gap-3' : 'w-10 h-10 justify-center'}`}
            >
                <Plus size={20} className="shrink-0" />
                {isExpanded && (
                    <span className="font-medium animate-fade-in whitespace-nowrap">New Chat</span>
                )}
                {!isExpanded && (
                    <div className="absolute left-16 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        New Chat
                    </div>
                )}
            </button>
            <div className={`h-0.5 bg-zinc-200 dark:bg-zinc-800 transition-all duration-300 ${isExpanded ? 'w-full mb-6' : 'w-8 mb-6'}`} />

            {/* Main Navigation */}
            <nav className={`flex flex-col space-y-2 mb-4 ${isExpanded ? '' : 'items-center'}`}>
                {mainMenuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center rounded-xl transition-all group relative ${isExpanded ? 'w-full px-3 py-2.5 gap-4' : 'w-10 h-10 justify-center'} ${isActive
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                                : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
                                }`}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                            {isExpanded && (
                                <span className={`font-medium animate-fade-in whitespace-nowrap ${isActive ? 'text-white dark:text-black' : ''}`}>
                                    {item.label}
                                </span>
                            )}
                            {!isExpanded && (
                                <div className="absolute left-16 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    );
                })}

                {/* History Toggler / Section */}
                {!isExpanded ? (
                    <button
                        onClick={() => setActiveTab('HistoryList')}
                        className={`flex items-center rounded-xl transition-all group relative w-10 h-10 justify-center ${activeTab === 'HistoryList'
                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                            : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
                            }`}
                    >
                        <Clock size={20} strokeWidth={activeTab === 'HistoryList' ? 2.5 : 2} className="shrink-0" />
                        <div className="absolute left-16 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            History
                        </div>
                    </button>
                ) : (
                    <>
                        <div className="h-0.5 bg-zinc-200 dark:bg-zinc-800 w-full my-6" />
                        <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
                            <div className="flex items-center justify-between px-3 mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">History</span>
                                <button
                                    onClick={() => setActiveTab('HistoryList')}
                                    className="text-[10px] font-medium text-zinc-700 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                                >
                                    View more
                                </button>
                            </div>
                            <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                                {recentChats.map((chat) => (
                                    <button
                                        key={chat.id}
                                        onClick={() => onSelectChat(chat.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group text-left ${activeChatId === chat.id ? 'bg-black/5 dark:bg-white/5 text-black dark:text-white font-medium' : 'text-zinc-700 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
                                    >
                                        <FileText size={14} className={`shrink-0 transition-opacity ${activeChatId === chat.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
                                        <span className="truncate">{chat.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </nav>

            {/* Bottom Tools */}
            <div className={`flex flex-col space-y-4 mt-auto ${isExpanded ? '' : 'items-center'}`}>
                {/* <button
                    onClick={() => setActiveTab('Personalization')}
                    className={`flex items-center rounded-xl transition-all group relative ${isExpanded ? 'w-full px-3 py-2.5 gap-4' : 'w-10 h-10 justify-center'} ${activeTab === 'Personalization'
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                        : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                >
                    <Palette size={20} className="shrink-0" />
                    {isExpanded && <span className="font-medium animate-fade-in whitespace-nowrap">Appearance</span>}
                    {!isExpanded && (
                        <div className="absolute left-16 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            Appearance
                        </div>
                    )}
                </button> */}
                {/* <button
                    onClick={() => setActiveTab('Settings')}
                    className={`flex items-center rounded-xl transition-all group relative ${isExpanded ? 'w-full px-3 py-2.5 gap-4' : 'w-10 h-10 justify-center'} ${activeTab === 'Settings'
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                        : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                >
                    <Settings size={20} className="shrink-0" />
                    {isExpanded && <span className="font-medium animate-fade-in whitespace-nowrap">Settings</span>}
                    {!isExpanded && (
                        <div className="absolute left-16 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            Settings
                        </div>
                    )}
                </button> */}

                <div 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`flex items-center mt-2 group relative border-t border-black/5 dark:border-white/5 pt-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg ${isExpanded ? 'px-2 gap-3' : 'justify-center border-t-0 pt-0'}`}
                >
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm hover:ring-2 hover:ring-black/10 dark:hover:ring-white/20 transition-all flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        <User size={18} className="text-zinc-500" />
                    </div>
                    {isExpanded && (
                        <div className="flex flex-col min-w-0 animate-fade-in flex-1">
                            <span className="text-sm font-semibold truncate">{profile?.nickname || user?.email?.split('@')[0] || 'User Profile'}</span>
                            <span className="text-[10px] text-zinc-700 dark:text-zinc-500 truncate uppercase tracking-wider">{profile?.username ? `@${profile.username}` : user?.email || 'Free Plan'}</span>
                        </div>
                    )}
                    {isExpanded && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onLogout();
                            }}
                            className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Sign out"
                        >
                            <LogOut size={16} />
                        </button>
                    )}

                    {/* User Menu Dropdown */}
                    {showUserMenu && (
                        <>
                            <div 
                                className="fixed inset-0 z-30"
                                onClick={() => setShowUserMenu(false)}
                            />
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-40 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <User size={16} className="text-zinc-500" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-semibold truncate">{profile?.nickname || user?.email?.split('@')[0] || 'User'}</span>
                                            <span className="text-[10px] text-zinc-500 truncate">{user?.email || 'user@example.com'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setActiveTab('Help');
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <HelpCircle size={16} className="text-zinc-500" />
                                        <span>Help & Support</span>
                                    </button>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                                    <button
                                        onClick={() => {
                                            onLogout();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
