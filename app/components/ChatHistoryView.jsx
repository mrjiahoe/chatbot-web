'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Clock, FileText, Pencil, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const ChatHistoryView = ({ onSelectChat, recentChats, onRenameChat, onDeleteChat }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [deleteChatId, setDeleteChatId] = useState(null);

    const filteredChats = useMemo(() => {
        const chats = Array.isArray(recentChats) ? recentChats : [];
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return chats;
        }

        return chats.filter((chat) => {
            const title = String(chat.title || '').toLowerCase();
            const date = String(chat.date || '').toLowerCase();
            return title.includes(query) || date.includes(query);
        });
    }, [recentChats, searchQuery]);

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
        setDeleteChatId(id);
    };

    const handleConfirmDelete = () => {
        if (deleteChatId) {
            onDeleteChat(deleteChatId);
        }
        setDeleteChatId(null);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Workspace
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                        Chat history
                    </h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Search past conversations, rename them, or remove ones you no longer need.
                    </p>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader className="space-y-3 border-b border-border bg-muted/20">
                        {/* <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="size-5 text-primary" />
                                    Recent chats
                                </CardTitle>
                                <CardDescription>
                                    Browse, search, and manage your saved conversations.
                                </CardDescription>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                {filteredChats.length} result{filteredChats.length === 1 ? '' : 's'}
                            </p>
                        </div> */}

                        <div className="relative max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search chats by title or date"
                                className="pl-9"
                            />
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <ScrollArea className="h-[min(65vh,42rem)]">
                            <div className="space-y-3 p-4 md:p-6">
                                {filteredChats.length ? (
                                    filteredChats.map((chat) => (
                                        <div
                                            key={chat.id}
                                            onClick={() => onSelectChat(chat.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    onSelectChat(chat.id);
                                                }
                                            }}
                                            className="group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:shadow-sm"
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <FileText className="size-5" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    {editingId === chat.id ? (
                                                        <div className="flex items-center gap-2 pr-2">
                                                            <Input
                                                                autoFocus
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveRename(e, chat.id);
                                                                    if (e.key === 'Escape') handleCancelRename(e);
                                                                }}
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="icon-sm"
                                                                onClick={(e) => handleSaveRename(e, chat.id)}
                                                            >
                                                                <Check className="size-4" />
                                                                <span className="sr-only">Save rename</span>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                onClick={handleCancelRename}
                                                            >
                                                                <X className="size-4" />
                                                                <span className="sr-only">Cancel rename</span>
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="truncate text-sm font-semibold text-foreground">
                                                                    {chat.title}
                                                                </h3>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    onClick={(e) => handleStartRename(e, chat)}
                                                                    className="opacity-0 transition-opacity group-hover:opacity-100"
                                                                >
                                                                    <Pencil className="size-4" />
                                                                    <span className="sr-only">Rename chat</span>
                                                                </Button>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {chat.date || 'No date available'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={(e) => handleDelete(e, chat.id)}
                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                >
                                                    <Trash2 className="size-4" />
                                                    <span className="sr-only">Delete chat</span>
                                                </Button>
                                                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                                        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                            <FileText className="size-5" />
                                        </div>
                                        <h3 className="text-base font-semibold text-foreground">
                                            No chats found
                                        </h3>
                                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                            Try a different search term, or start a new chat from the sidebar.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={deleteChatId !== null} onOpenChange={(open) => !open && setDeleteChatId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the conversation and all of its messages.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                            <Button variant="outline" onClick={() => setDeleteChatId(null)}>
                                Cancel
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button variant="destructive" onClick={handleConfirmDelete}>
                                Delete chat
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ChatHistoryView;
