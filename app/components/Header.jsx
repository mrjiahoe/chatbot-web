'use client';
import React from 'react';
import { Sun, Moon, Bell, Pencil, Check, X } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const Header = ({ theme, setTheme, chatTitle, activeChatId, onRenameChat, activeTab }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(chatTitle);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const [notifications, setNotifications] = React.useState([
        { id: 1, text: 'Your export is ready for download.', time: '2m ago', unread: true },
        { id: 2, text: 'New analysis shared with you.', time: '1h ago', unread: true },
        { id: 3, text: 'Storage limit reached 80%.', time: '5h ago', unread: false },
    ]);

    React.useEffect(() => {
        setEditValue(chatTitle);
    }, [chatTitle]);

    const displayTitle = activeTab === 'Chat' ? chatTitle :
        activeTab === 'DataCenter' ? 'Data Sources' :
            activeTab === 'HistoryList' ? 'Chat History' :
                activeTab === 'Personalization' ? 'Appearance' :
                    activeTab === 'Settings' ? 'Settings' :
                        activeTab === 'Help' ? 'Help & Support' : 'Dashboard';

    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const toggleTheme = () => {
        if (theme === 'dark') setTheme('light');
        else setTheme('dark');
    };

    const handleStartEdit = () => {
        setIsEditing(true);
        setEditValue(chatTitle);
    };

    const handleSave = () => {
        if (editValue.trim() && editValue !== chatTitle) {
            onRenameChat(activeChatId, editValue.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue(chatTitle);
    };

    const unreadCount = notifications.filter(n => n.unread).length;

    const handleMarkAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, unread: false })));
    };

    const handleClearNotification = (id) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    return (
        <header className="h-16 bg-transparent flex items-center justify-between px-4 md:px-6 z-[100] transition-colors duration-300 w-full max-w-4xl mx-auto relative">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <SidebarTrigger className="-ml-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5" />
                <div className="flex flex-col flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex items-center space-x-2 animate-fade-in">
                            <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') handleCancel();
                                }}
                                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded px-2 py-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-zinc-400 outline-none w-full max-w-[200px]"
                            />
                            <button onClick={handleSave} className="p-1 text-green-500 hover:bg-green-500/10 rounded transition-colors">
                                <Check size={14} />
                            </button>
                            <button onClick={handleCancel} className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="group flex items-center space-x-2">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[300px]">{displayTitle}</h2>
                            {activeTab === 'Chat' && (
                                <button
                                    onClick={handleStartEdit}
                                    className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Rename Chat"
                                >
                                    <Pencil size={12} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    aria-label="Toggle Theme"
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative ${showNotifications ? 'text-blue-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white dark:border-zinc-900"></span>
                        )}
                    </button>

                    {showNotifications && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllRead}
                                            className="text-[10px] font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {notifications.length > 0 ? (
                                        notifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`p-4 flex gap-3 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-default group relative ${notif.unread ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.unread ? 'bg-blue-500' : 'bg-transparent'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">{notif.text}</p>
                                                    <span className="text-[10px] text-zinc-400 mt-1 block">{notif.time}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleClearNotification(notif.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center">
                                            <p className="text-xs text-zinc-500">No notifications yet</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-zinc-50 dark:bg-white/5 text-center border-t border-zinc-100 dark:border-zinc-800">
                                    <button className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                        View all notifications
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
