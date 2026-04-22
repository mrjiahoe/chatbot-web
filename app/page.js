'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import ChatHistoryView from './components/ChatHistoryView';
import PersonalizationView from './components/PersonalizationView';
import SettingsView from './components/SettingsView';
import HelpSupportView from './components/HelpSupportView';
import LogoutModal from './components/LogoutModal';

import DataView from './components/DataView';
import { supabase } from '../lib/supabase';
import { getUser, signOut } from '../lib/auth';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';

export default function Page() {
  const [theme, setTheme] = useState('system');
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const router = useRouter();

  // This block of code runs as soon as you open the page
  useEffect(() => {
    setMounted(true); // Tells the app the web browser is ready

    // This function checks if you are logged in and if your profile is finished
    const checkUser = async () => {
      const { user } = await getUser(); // Ask Supabase: "Who is this user?"

      if (!user) {
        // If the user is NOT logged in, send them to the welcome page
        router.push('/welcome');
      } else {
        // If they ARE logged in, save their basic info
        setUser(user);

        // Now, look in the 'profiles' database table for this user's extra info
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          // If we found a profile, check if they finished the onboarding (nickname/username)
          if (!profileData.onboarding_completed) {
            // Not finished? Send them to the onboarding page
            router.push('/onboarding');
          } else {
            // All good! Save the profile and let them use the app
            setProfile(profileData);
          }
        } else {
          // If the user exists but has NO entry in 'profiles' yet, send them to onboard
          router.push('/onboarding');
        }
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

  // Persist and restore activeTab from localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Persist and restore activeChatId from localStorage
  useEffect(() => {
    const savedChatId = localStorage.getItem('activeChatId');
    if (savedChatId && savedChatId !== 'null') {
      setActiveChatId(savedChatId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('activeChatId', activeChatId || 'null');
  }, [activeChatId]);

  // Load messages for restored chat
  useEffect(() => {
    if (activeChatId && messages.length === 0) {
      setIsLoadingChat(true);
      const loadMessages = async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeChatId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          setMessages([]);
        } else {
          setMessages(data.map(msg => ({
            id: msg.id,
            sender: msg.role === 'user' ? 'user' : 'bot',
            text: msg.content,
            timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            token_usage: msg.token_usage,
            generatedSql: msg.generated_sql,
            generatedJson: msg.generated_json
          })));
        }
        setIsLoadingChat(false);
      };
      loadMessages();
    }
  }, [activeChatId]);

  useEffect(() => {
    const fetchChats = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
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
  }, []);

  const activeChatTitle = recentChats.find(c => c.id === activeChatId)?.title || 'Dashboard';

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
    setActiveChatId(null);
    setMessages([]);
    setActiveTab('Chat');
  };

  const handleSelectChat = async (chatId) => {
    setActiveTab('Chat');
    setActiveChatId(chatId);
    setIsLoadingChat(true);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } else {
      setMessages(data.map(msg => ({
        id: msg.id,
        sender: msg.role === 'user' ? 'user' : 'bot',
        text: msg.content,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        token_usage: msg.token_usage,
        generatedSql: msg.generated_sql,
        generatedJson: msg.generated_json
      })));
    }

    setIsLoadingChat(false);
  };

  const handleRenameChat = async (chatId, newTitle) => {
    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', chatId);

    if (error) {
      console.error('Error renaming chat:', error);
    } else {
      setRecentChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      ));
    }
  };

  const handleDeleteChat = async (chatId) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', chatId);

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
    const showConfirmation = localStorage.getItem('showLogoutConfirmation') !== 'false';
    if (showConfirmation) {
      setIsLogoutModalOpen(true);
    } else {
      await confirmLogout();
    }
  };

  const confirmLogout = async () => {
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
    <div className="flex h-screen bg-[#fbfbfb] dark:bg-zinc-950 transition-colors duration-300 font-sans selection:bg-black/10 dark:selection:bg-white/10 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <div className="z-50 flex-shrink-0">
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
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300 z-10">
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
              onViewHistory={() => setActiveTab('HistoryList')}
              activeChatId={activeChatId}
              onConversationCreated={(id) => {
                setActiveChatId(id);
                // Refresh chats list
                supabase.from('conversations').select('*').order('updated_at', { ascending: false })
                  .then(({ data }) => {
                    if (data) setRecentChats(data.map(c => ({
                      id: c.id,
                      title: c.title || 'New Project',
                      date: new Date(c.created_at).toLocaleDateString()
                    })));
                  });
              }}
              isLoadingChat={isLoadingChat}
            />
          ) : activeTab === 'DataCenter' ? (
            <DataView />
          ) : activeTab === 'HistoryList' ? (
            <div className="flex-1 flex flex-col min-h-0 pt-4">
              <ChatHistoryView
                onSelectChat={handleSelectChat}
                recentChats={recentChats}
                onRenameChat={handleRenameChat}
                onDeleteChat={handleDeleteChat}
              />
            </div>
          ) : activeTab === 'Personalization' ? (
            <div className="flex-1 flex flex-col min-h-0 pt-4">
              <PersonalizationView theme={theme} setTheme={setTheme} />
            </div>
          ) : activeTab === 'Settings' ? (
            <div className="flex-1 flex flex-col min-h-0 pt-4">
              <SettingsView onProfileUpdate={(newProfile) => setProfile(newProfile)} />
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
      </main>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
};

