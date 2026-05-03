'use client';

import React from 'react';
import {
    Clock,
    Database,
    FileText,
    HelpCircle,
    LogOut,
    MessageSquare,
    Plus,
    Settings,
    ShieldCheck,
    ChevronsUpDown,
    PanelLeftOpen,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sidebar as SidebarRoot, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canAccessChat, canAccessDataSources, canAccessRoleDashboard, canViewChatHistory } from '@/lib/roles';

const SIDEBAR_LOGO_SRC = '/logo/logo.png?v=20260503-1532';

const Sidebar = ({ activeTab, setActiveTab, onNewChat, onSelectChat, recentChats, activeChatId, onLogout, user, profile }) => {
    const { toggleSidebar } = useSidebar();
    const displayName = profile?.nickname || user?.email?.split('@')[0] || 'User Profile';
    const secondaryLabel = profile?.username ? `@${profile.username}` : user?.email || 'Free Plan';
    const currentRole = profile?.effectiveRole || profile?.role;
    const canUseChat = canAccessChat(currentRole);
    const canUseDataSources = canAccessDataSources(currentRole);
    const canUseHistory = canViewChatHistory(currentRole);
    const hasRoleManagementAccess = canAccessRoleDashboard(currentRole);
    const initials = displayName
        .split(' ')
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';

    const mainMenuItems = [
        ...(canUseChat ? [{ icon: MessageSquare, label: 'Chat', id: 'Chat' }] : []),
        ...(canUseDataSources ? [{ icon: Database, label: 'Data Sources', id: 'DataCenter' }] : []),
        ...(canUseHistory ? [{ icon: Clock, label: 'History', id: 'HistoryList' }] : []),
        ...(hasRoleManagementAccess ? [{ icon: ShieldCheck, label: 'User Roles', id: 'UserRoles' }] : []),
    ];

    return (
        <SidebarRoot
            collapsible="icon"
            className="border-r border-sidebar-border/80 bg-sidebar"
            style={{ '--sidebar-width-icon': '5rem' }}
        >
            <SidebarHeader className="gap-4 border-b border-sidebar-border p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
                <div className="flex items-start justify-between gap-3 px-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:px-0">
                    <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
                        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sidebar-border/60 bg-white shadow-sm group-data-[collapsible=icon]:hidden dark:bg-sidebar-accent/20">
                            <img
                                src={SIDEBAR_LOGO_SRC}
                                alt="NaLDAC logo"
                                className="h-full w-full object-contain p-1"
                            />
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={toggleSidebar}
                                    aria-label="Expand sidebar"
                                    className="group/logo-toggle relative hidden size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sidebar-border/60 bg-white shadow-sm transition-all duration-200 hover:scale-[1.03] hover:bg-sidebar-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:bg-sidebar-accent/20 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:flex"
                                >
                                    <img
                                        src={SIDEBAR_LOGO_SRC}
                                        alt="NaLDAC logo"
                                        className="h-full w-full object-contain p-1 transition-all duration-200 group-hover/logo-toggle:-rotate-90 group-hover/logo-toggle:scale-75 group-hover/logo-toggle:opacity-0"
                                    />
                                    <PanelLeftOpen className="absolute size-6 shrink-0 rotate-90 text-sidebar-foreground opacity-0 transition-all duration-200 group-hover/logo-toggle:rotate-0 group-hover/logo-toggle:opacity-100" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" sideOffset={10}>
                                Expand sidebar
                            </TooltipContent>
                        </Tooltip>
                        <div className="grid min-w-0 flex-1 leading-tight transition-opacity duration-200 group-data-[collapsible=icon]:hidden">
                            <span className="truncate text-xl font-semibold">NaLDAC</span>
                            <span className="truncate text-sm text-sidebar-foreground/70">AI analysis chatbot</span>
                        </div>
                    </div>
                    <SidebarTrigger className="hidden shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex group-data-[collapsible=icon]:hidden" />
                </div>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={onNewChat}
                            tooltip="New chat"
                            className="text-sm bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                            disabled={!canUseChat}
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

                {canUseHistory ? (
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
                ) : null}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:items-center">
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
        </SidebarRoot>
    );
};

export default Sidebar;
