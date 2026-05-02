'use client';
import React, { useState, useEffect } from 'react';
import { fetchCurrentAccessProfile } from '@/lib/access';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import ChatHistoryView from './components/ChatHistoryView';
import SettingsView from './components/SettingsView';
import HelpSupportView from './components/HelpSupportView';
import DataView from './components/DataView';
import UserRolesView from './components/UserRolesView';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { supabase } from '../lib/supabase';
import { getSession, signOut } from '../lib/auth';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { canAccessChat, canAccessDataSources, canAccessRoleDashboard, canViewChatHistory } from '@/lib/roles';

function normalizeGeneratedPayload(value) {
  if (!value || typeof value !== 'object') {
    return {
      generatedJson: value || null,
      resultData: null,
      execution: null,
    };
  }

  if ('request' in value || 'data' in value || 'execution' in value) {
    return {
      generatedJson: value.request || null,
      resultData: value.data || null,
      execution: value.execution || null,
    };
  }

  return {
    generatedJson: value,
    resultData: null,
    execution: null,
  };
}

function toUiMessage(msg) {
  const normalized = normalizeGeneratedPayload(msg.generated_json);

  return {
    id: msg.id,
    sender: msg.role === 'user' ? 'user' : 'bot',
    text: msg.content,
    timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    token_usage: msg.token_usage,
    generatedSql: msg.generated_sql,
    generatedJson: normalized.generatedJson,
    resultData: normalized.resultData,
    execution: normalized.execution,
  };
}

export default function Page() {
  const [theme, setTheme] = useState('system');
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bootstrapError, setBootstrapError] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const router = useRouter();

  // This block of code runs as soon as you open the page
  useEffect(() => {
    setMounted(true); // Tells the app the web browser is ready

    // This function checks if you are logged in and if your profile is finished
    const checkUser = async () => {
      try {
        setBootstrapError('');
        const { session } = await getSession(); // Read the current session first

        if (!session?.user) {
          // If the user is NOT logged in, send them to the welcome page
          router.replace('/welcome');
        } else {
          // If they ARE logged in, save their basic info
          const currentUser = session.user;
          setUser(currentUser);

          const accessProfile = await fetchCurrentAccessProfile({
            supabase,
            authUser: currentUser,
          });
          const profileData = accessProfile;

          if (!profileData?.hasBaseAccount && !profileData?.hasProfile) {
            // If the user has no linked account or profile record yet, use onboarding
            // as the lightweight fallback path for creating their app profile.
            router.replace('/onboarding');
          } else if (!profileData.onboarding_completed) {
            router.replace('/onboarding');
          } else {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Failed to bootstrap session:', error);
        setBootstrapError(
          error instanceof Error
            ? error.message
            : error?.message || 'Unable to load your workspace right now.'
        );
      }
    };

    checkUser();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const [activeTab, setActiveTab] = useState('Chat');
  const [messages, setMessages] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const currentRole = profile?.effectiveRole || profile?.role;
  const canUseChat = canAccessChat(currentRole);
  const canUseHistory = canViewChatHistory(currentRole);
  const canUseDataSources = canAccessDataSources(currentRole);
  const hasRoleManagementAccess = canAccessRoleDashboard(currentRole);
  const accessibleTabs = [
    ...(canUseChat ? ['Chat'] : []),
    ...(canUseDataSources ? ['DataCenter'] : []),
    ...(canUseHistory ? ['HistoryList'] : []),
    ...(hasRoleManagementAccess ? ['UserRoles'] : []),
    'Settings',
    'Help',
  ];
  const defaultWorkspaceTab = accessibleTabs[0] || 'Help';
  const activeTabStorageKey = user?.id ? `activeTab:${user.id}` : null;
  const activeChatStorageKey = user?.id ? `activeChatId:${user.id}` : null;

  // Persist and restore activeTab from localStorage per user
  useEffect(() => {
    if (!activeTabStorageKey) {
      return;
    }

    const savedTab = localStorage.getItem(activeTabStorageKey);
    if (savedTab) {
      setActiveTab(savedTab === 'Personalization' ? 'Settings' : savedTab);
    }
  }, [activeTabStorageKey]);

  useEffect(() => {
    if (!activeTabStorageKey) {
      return;
    }

    localStorage.setItem(activeTabStorageKey, activeTab);
  }, [activeTab, activeTabStorageKey]);

  useEffect(() => {
    if (!accessibleTabs.includes(activeTab)) {
      setActiveTab(defaultWorkspaceTab);
    }
  }, [activeTab, accessibleTabs, defaultWorkspaceTab]);

  // Persist and restore activeChatId from localStorage per user
  useEffect(() => {
    if (!activeChatStorageKey) {
      return;
    }

    const savedChatId = localStorage.getItem(activeChatStorageKey);
    if (savedChatId && savedChatId !== 'null') {
      setActiveChatId(savedChatId);
    } else {
      setActiveChatId(null);
    }
  }, [activeChatStorageKey]);

  useEffect(() => {
    if (!activeChatStorageKey) {
      return;
    }

    localStorage.setItem(activeChatStorageKey, activeChatId || 'null');
  }, [activeChatId, activeChatStorageKey]);

  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      setRecentChats([]);
      setActiveChatId(null);
    }
  }, [user?.id]);

  // Load messages for restored chat
  useEffect(() => {
    if (!canUseHistory) {
      return;
    }

    if (activeChatId && messages.length === 0 && user?.id) {
      setIsLoadingChat(true);
      const loadMessages = async () => {
        const { data: conversation, error: conversationError } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', activeChatId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (conversationError || !conversation) {
          if (conversationError) {
            console.error('Error verifying conversation ownership:', conversationError);
          }
          setMessages([]);
          setActiveChatId(null);
          setIsLoadingChat(false);
          return;
        }

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeChatId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          setMessages([]);
        } else {
          setMessages(data.map(toUiMessage));
        }
        setIsLoadingChat(false);
      };
      loadMessages();
    }
  }, [activeChatId, canUseHistory, messages.length, user?.id]);

  useEffect(() => {
    if (!canUseHistory || !user?.id) {
      setRecentChats([]);
      setActiveChatId(null);
      setMessages([]);
      return;
    }

    const fetchChats = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching chats:', error);
      } else {
        setRecentChats(data.map(chat => ({
          id: chat.id,
          title: chat.title || 'New Project',
          date: new Date(chat.created_at).toLocaleDateString()
        })));
      }
    };
    fetchChats();
  }, [canUseHistory, user?.id]);

  const activeChatTitle = recentChats.find(c => c.id === activeChatId)?.title || 'Dashboard';

  if (bootstrapError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6 md:p-10">
        <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
          <p className="font-semibold">Workspace failed to load</p>
          <p className="mt-2 break-words">{bootstrapError}</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (currentTheme) => {
      let actualTheme = currentTheme;
      if (currentTheme === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      if (actualTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const handleNewChat = () => {
    if (!canUseChat) {
      setActiveTab(defaultWorkspaceTab);
      return;
    }

    setActiveChatId(null);
    setMessages([]);
    setActiveTab('Chat');
  };

  const handleSelectChat = async (chatId) => {
    if (!canUseHistory || !canUseChat || !user?.id) {
      setActiveTab(defaultWorkspaceTab);
      return;
    }

    setActiveTab('Chat');
    setActiveChatId(chatId);
    setIsLoadingChat(true);

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (conversationError || !conversation) {
      if (conversationError) {
        console.error('Error verifying conversation ownership:', conversationError);
      }
      setMessages([]);
      setActiveChatId(null);
      setIsLoadingChat(false);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } else {
      setMessages(data.map(toUiMessage));
    }

    setIsLoadingChat(false);
  };

  const handleRenameChat = async (chatId, newTitle) => {
    if (!user?.id) {
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', chatId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error renaming chat:', error);
    } else {
      setRecentChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      ));
    }
  };

  const handleDeleteChat = async (chatId) => {
    if (!user?.id) {
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting chat:', error);
    } else {
      const updatedChats = recentChats.filter(chat => chat.id !== chatId);
      setRecentChats(updatedChats);

      if (activeChatId === chatId) {
        const nextChat = updatedChats[0] || null;
        setActiveChatId(nextChat ? nextChat.id : null);
        if (!nextChat) {
          setMessages([]);
        }
      }
    }
  };

  const handleLogout = async () => {
    setMessages([]);
    setRecentChats([]);
    setActiveChatId(null);
    await signOut();
    router.push('/login');
  };

  if (!mounted || !user || (user && !profile)) {
    return (
      <div className="h-screen w-full bg-[#fbfbfb] dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  return (
    <SidebarProvider className="h-screen overflow-hidden bg-[#fbfbfb] text-zinc-900 transition-colors duration-300 font-sans selection:bg-black/10 dark:selection:bg-white/10 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        recentChats={recentChats}
        activeChatId={activeChatId}
        onLogout={handleLogout}
        user={user}
        profile={profile}
      />

      <SidebarInset className="overflow-hidden bg-transparent">
        <div className="flex h-full flex-col overflow-hidden">
          <Header
            theme={theme}
            setTheme={setTheme}
            chatTitle={activeChatTitle}
            activeChatId={activeChatId}
            onRenameChat={handleRenameChat}
            activeTab={activeTab}
          />

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeTab === 'Chat' ? (
              <ChatArea
                messages={messages}
                setMessages={setMessages}
                onViewHistory={() => canUseHistory && setActiveTab('HistoryList')}
                activeChatId={activeChatId}
                onConversationCreated={(id) => {
                  setActiveChatId(id);
                  // Refresh chats list
                  if (canUseHistory && user?.id) {
                    supabase.from('conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
                      .then(({ data }) => {
                        if (data) setRecentChats(data.map(c => ({
                          id: c.id,
                          title: c.title || 'New Project',
                          date: new Date(c.created_at).toLocaleDateString()
                        })));
                      });
                  }
                }}
                isLoadingChat={isLoadingChat}
                currentRole={currentRole}
                canViewHistory={canUseHistory}
              />
            ) : activeTab === 'DataCenter' ? (
              <DataView currentRole={currentRole} />
            ) : activeTab === 'HistoryList' ? (
              <div className="flex-1 flex flex-col min-h-0 pt-4">
                <ChatHistoryView
                  onSelectChat={handleSelectChat}
                  recentChats={recentChats}
                  onRenameChat={handleRenameChat}
                  onDeleteChat={handleDeleteChat}
                />
              </div>
            ) : activeTab === 'Settings' ? (
              <div className="flex-1 flex flex-col min-h-0 pt-4">
                <SettingsView
                  theme={theme}
                  setTheme={setTheme}
                  onProfileUpdate={(newProfile) => setProfile((currentProfile) => ({ ...currentProfile, ...newProfile }))}
                />
              </div>
            ) : activeTab === 'UserRoles' ? (
              <div className="flex-1 flex flex-col min-h-0 pt-4">
                <UserRolesView currentRole={currentRole} />
              </div>
            ) : activeTab === 'Help' ? (
              <div className="flex-1 flex flex-col min-h-0 pt-4">
                <HelpSupportView />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600 animate-fade-in">
                <div className="text-center">
                  <p className="text-lg font-medium">Select a view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

    </SidebarProvider>
  );
}
