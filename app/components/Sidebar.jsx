'use client';

import React from 'react';
import {
    ChartNoAxesCombined,
    Clock,
    Database,
    FileText,
    HelpCircle,
    LogOut,
    MessageSquare,
    Palette,
    Plus,
    Settings,
    ChevronsUpDown,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sidebar as SidebarRoot, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, SidebarSeparator } from '@/components/ui/sidebar';

const Sidebar = ({ activeTab, setActiveTab, onNewChat, onSelectChat, recentChats, activeChatId, onLogout, user, profile }) => {
    const displayName = profile?.nickname || user?.email?.split('@')[0] || 'User Profile';
    const secondaryLabel = profile?.username ? `@${profile.username}` : user?.email || 'Free Plan';
    const initials = displayName
        .split(' ')
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';

    const mainMenuItems = [
        { icon: MessageSquare, label: 'Chat', id: 'Chat' },
        { icon: Database, label: 'Data Sources', id: 'DataCenter' },
        { icon: Clock, label: 'History', id: 'HistoryList' },
    ];

    return (
        <SidebarRoot collapsible="icon" className="border-r border-sidebar-border/80 bg-sidebar" >
            <SidebarHeader className="gap-4 border-b border-sidebar-border p-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                        <ChartNoAxesCombined size={20} />
                    </div>
                    <div className="grid min-w-0 flex-1 leading-tight transition-opacity duration-200 group-data-[collapsible=icon]/sidebar-wrapper:opacity-0">
                        <span className="truncate text-sm font-semibold">NaLDAC</span>
                        <span className="truncate text-xs text-sidebar-foreground/70">AI analysis workspace</span>
                    </div>
                </div>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={onNewChat}
                            tooltip="New chat"
                            className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                        >
                            <Plus />
                            <span>New Chat</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainMenuItems.map((item) => {
                                const isActive = activeTab === item.id;

                                return (
                                    <SidebarMenuItem key={item.id}>
                                        <SidebarMenuButton
                                            onClick={() => setActiveTab(item.id)}
                                            isActive={isActive}
                                            tooltip={item.label}
                                        >
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                <SidebarGroup className="min-h-0">
                    <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
                    <SidebarGroupContent className="min-h-0">
                        <SidebarMenu className="gap-1">
                            {recentChats?.length ? (
                                recentChats.map((chat) => (
                                    <SidebarMenuItem key={chat.id}>
                                        <SidebarMenuButton
                                            onClick={() => onSelectChat(chat.id)}
                                            isActive={activeChatId === chat.id}
                                            tooltip={chat.title}
                                        >
                                            <FileText />
                                            <span>{chat.title}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))
                            ) : (
                                <div className="px-2 py-3 text-sm text-sidebar-foreground/60">
                                    No chats yet
                                </div>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                            tooltip={displayName}
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{displayName}</span>
                                <span className="truncate text-xs text-sidebar-foreground/70">{secondaryLabel}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-56 rounded-lg"
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{displayName}</span>
                                    <span className="truncate text-xs text-muted-foreground">{secondaryLabel}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setActiveTab('Personalization')}>
                            <Palette />
                            Appearance
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActiveTab('Settings')}>
                            <Settings />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setActiveTab('Help')}>
                            <HelpCircle />
                            Help & Support
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onLogout}
                            className="text-red-600 focus:text-red-600"
                        >
                            <LogOut />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>

            <SidebarRail />
        </SidebarRoot>
    );
};

export default Sidebar;
