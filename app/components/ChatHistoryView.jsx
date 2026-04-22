'use client';
import React, { useState } from 'react';
import { FileText, Clock, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react';

const ChatHistoryView = ({ onSelectChat, recentChats, onRenameChat, onDeleteChat }) => {
    const [displayCount, setDisplayCount] = useState(15);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    const handleShowMore = () => {
        setDisplayCount(prev => prev + 15);
    };

    const handleStartRename = (e, chat) => {
        e.stopPropagation();
        setEditingId(chat.id);
        setEditValue(chat.title);
    };

    const handleSaveRename = (e, id) => {
        e.stopPropagation();
        if (editValue.trim()) {
            onRenameChat(id, editValue.trim());
        }
        setEditingId(null);
    };

    const handleCancelRename = (e) => {
        e.stopPropagation();
        setEditingId(null);
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this chat?')) {
            onDeleteChat(id);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto animate-fade-in w-full pb-20 pt-8">
            <div className="max-w-3xl mx-auto px-4 md:px-8">
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-8">Recent Files</h2>

                <div className="space-y-3">
                    {recentChats && recentChats.slice(0, displayCount).map((chat, index) => (
                        <div
                            key={chat.id}
                            onClick={() => onSelectChat(chat.id)}
                            className="p-4 rounded-2xl bg-white dark:bg-zinc-900/50 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group flex items-center justify-between border border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-center min-w-0 flex-1 mr-4">
                                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center flex-shrink-0 mr-5 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                                    <FileText size={20} strokeWidth={1.5} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    {editingId === chat.id ? (
                                        <div className="flex items-center space-x-2 animate-fade-in pr-4">
                                            <input
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveRename(e, chat.id);
                                                    if (e.key === 'Escape') handleCancelRename(e);
                                                }}
                                                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded px-2 py-1 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-zinc-400 outline-none w-full"
                                            />
                                            <button onClick={(e) => handleSaveRename(e, chat.id)} className="p-1 text-green-500 hover:bg-green-500/10 rounded transition-colors">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={(e) => handleCancelRename(e)} className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2 mr-2">
                                            <h3 className="text-[18px] font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                                                {chat.title}
                                            </h3>
                                            <button
                                                onClick={(e) => handleStartRename(e, chat)}
                                                // className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                                                className=" p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    )}
                                    {/* <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                        {chat.preview || 'No preview available'}
                                    </p> */}
                                </div>
                            </div>

                            <div className="flex items-center text-zinc-400 text-sm flex-shrink-0 space-x-4">
                                <span className="hidden sm:block text-xs font-medium uppercase tracking-wider">{chat.date}</span>
                                {/* <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"> */}
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={(e) => handleDelete(e, chat.id)}
                                        className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        title="Delete Chat"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <ChevronRight size={18} className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {recentChats && displayCount < recentChats.length && (
                    <div className="mt-10 flex justify-center">
                        <button
                            onClick={handleShowMore}
                            className="px-6 py-2.5 bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm"
                        >
                            Load more
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatHistoryView;
