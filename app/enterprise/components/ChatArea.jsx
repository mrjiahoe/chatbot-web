import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Send, FileText, Bot, User, Plus, ArrowDown, Clock, X, Database, Check, Loader2, Table } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { supabase } from '../../../lib/supabase';
import { getChatClientValidationError } from '../../../lib/chatLimits';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const ChatArea = ({ messages, setMessages, onViewHistory, activeChatId, onConversationCreated }) => {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // Data Context States
    const [availableTables, setAvailableTables] = useState([]);
    const [selectedTables, setSelectedTables] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFetchingTables, setIsFetchingTables] = useState(false);

    useEffect(() => {
        if (isMenuOpen) {
            fetchAvailableTables();
        }
    }, [isMenuOpen]);

    const fetchAvailableTables = async () => {
        setIsFetchingTables(true);
        try {
            const { data, error } = await supabase
                .from('chatbot_schema_registry')
                .select('table_name, column_name, column_type')
                .eq('enabled', true)
                .order('table_name', { ascending: true })
                .order('column_name', { ascending: true });

            if (error) throw error;

            // Group columns by table
            const groupedTables = new Map();
            data?.forEach((row) => {
                const tableName = row.table_name;
                if (!groupedTables.has(tableName)) {
                    groupedTables.set(tableName, {
                        name: tableName,
                        columns: []
                    });
                }
                groupedTables.get(tableName).columns.push({
                    name: row.column_name,
                    type: row.column_type
                });
            });

            setAvailableTables(Array.from(groupedTables.values()));
        } catch (err) {
            console.error('Error fetching tables:', err);
        } finally {
            setIsFetchingTables(false);
        }
    };

    const handleToggleTable = (table) => {
        const isSelected = selectedTables.some(t => t.name === table.name);

        if (isSelected) {
            setSelectedTables(prev => prev.filter(t => t.name !== table.name));
        } else {
            setSelectedTables(prev => [...prev, table]);
        }
    };

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const scrollToBottom = (behavior = 'auto') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useLayoutEffect(() => {
        setShowScrollButton(false);
        scrollToBottom('instant');
    }, [messages]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollButton(!isNearBottom);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        // Prepare data context string from selected tables
        const dataContext = selectedTables.length > 0
            ? `CONTEXT TABLES:\n${selectedTables.map(t => `- ${t.name}: ${t.columns.map(c => c.name).join(', ')}`).join('\n')}`
            : '';

        const userText = inputValue;
        const clientValidationError = getChatClientValidationError({
            message: userText,
            dataContext,
            historyMessages: messages,
        });
        if (clientValidationError) {
            setError(clientValidationError);
            return;
        }

        const newUserMessage = {
            id: messages.length + 1,
            sender: 'user',
            text: userText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newUserMessage]);
        setInputValue('');
        setSelectedTables([]); // Reset selection after sending
        setIsLoading(true);
        setError(null);

        try {
            // Convert messages to the format expected by the backend
            const history = messages.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userText,
                    history: history,
                    dataContext: dataContext,
                    conversationId: typeof activeChatId === 'string' ? activeChatId : undefined
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to get response');
            }

            const payload = await response.json();

            // Create placeholder for bot message
            const botMessageId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
            const botResponse = {
                id: botMessageId,
                sender: 'bot',
                text: payload.message || payload.summary || 'No response returned.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            const convId = payload.conversationId || response.headers.get('X-Conversation-Id');
            if (convId && convId !== activeChatId && onConversationCreated) {
                onConversationCreated(convId);
            }

            setMessages(prev => [...prev, botResponse]);
            setIsLoading(false);
        } catch (err) {
            console.error('Chat error:', err);
            const errorMessage = {
                id: Date.now(),
                sender: 'bot',
                isError: true,
                text: `Error: ${err.message}. Please try again.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMessage]);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col relative w-full items-center min-h-0">
            {messages.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center w-full max-w-3xl px-6 pb-32 animate-fade-in text-center">
                    <div className="w-16 h-16 rounded-3xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mb-8 shadow-xl shadow-black/5 dark:shadow-white/5 mx-auto">
                        <FileText size={32} strokeWidth={1.5} />
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-3">
                        Draft a new insight
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-8 max-w-md">
                        Begin typing below to analyze data, create a summary, or explore a new topic.
                    </p>
                    <button
                        onClick={onViewHistory}
                        className="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all font-medium text-sm"
                    >
                        <Clock size={16} className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                        Browse recent files
                    </button>
                </div>
            ) : (
                <div
                    className="flex-1 overflow-y-auto w-full px-6 md:px-12 pb-40 scroll-smooth"
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                >
                    <div className="max-w-3xl mx-auto space-y-10 py-8">
                        {messages.map((message) => (
                            <div key={message.id} className="group relative flex items-start gap-5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${message.sender === 'user'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                                    : message.isError
                                        ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                        : 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                                    }`}>
                                    {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className="flex-1 space-y-2 overflow-hidden pt-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                            {message.sender === 'user' ? 'You' : 'Assistant'}
                                        </span>
                                        <span className="text-xs text-zinc-400 font-medium">
                                            {message.timestamp}
                                        </span>
                                    </div>
                                    <div className={`prose dark:prose-invert max-w-none leading-relaxed text-[15px] ${message.isError ? 'text-red-600 dark:text-red-400 italic' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                code({ node, inline, className, children, ...props }) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    return !inline && match ? (
                                                        <div className="relative group">
                                                            <div className="absolute right-4 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{match[1]}</span>
                                                            </div>
                                                            <SyntaxHighlighter
                                                                style={vscDarkPlus}
                                                                language={match[1]}
                                                                PreTag="div"
                                                                className="!bg-zinc-50 dark:!bg-zinc-900/50 !p-6 !m-0 !rounded-2xl border border-zinc-200 dark:border-zinc-800"
                                                                {...props}
                                                            >
                                                                {String(children).replace(/\n$/, '')}
                                                            </SyntaxHighlighter>
                                                        </div>
                                                    ) : (
                                                        <code className={className} {...props}>
                                                            {children}
                                                        </code>
                                                    );
                                                },
                                                // Support line breaks
                                                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                            }}
                                        >
                                            {message.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex items-start gap-5 animate-pulse">
                                <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-white dark:text-black" />
                                </div>
                                <div className="flex-1 space-y-3 pt-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Assistant</span>
                                        <span className="w-12 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-3/4" />
                                        <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-1/2" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>
            )}

            {showScrollButton && (
                <button
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-28 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md text-zinc-600 dark:text-zinc-300 p-2 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all z-20"
                >
                    <ArrowDown size={18} />
                </button>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#fbfbfb] via-[#fbfbfb]/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 dark:to-transparent pointer-events-none flex justify-center">
                <div className="w-full max-w-3xl pointer-events-auto relative">
                    {/* Selected Tables Chips */}
                    {selectedTables.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3 px-2">
                            {selectedTables.map(table => (
                                <div key={table.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 animate-scale-up">
                                    <Database size={12} className="text-blue-500" />
                                    <span className="truncate max-w-[120px]">{table.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTables(prev => prev.filter(t => t.name !== table.name))}
                                        className="p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table Selection Menu */}
                    {isMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-4 w-72 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-scale-up z-[100] pointer-events-auto">
                            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Select Database Tables</span>
                                <button type="button" onClick={() => setIsMenuOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                                {isFetchingTables ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 size={20} className="animate-spin text-zinc-400" />
                                    </div>
                                ) : availableTables.length === 0 ? (
                                    <div className="py-8 text-center px-4">
                                        <p className="text-xs text-zinc-500">No tables available. Check your database configuration.</p>
                                    </div>
                                ) : (
                                    availableTables.map(table => {
                                        const isSelected = selectedTables.some(t => t.name === table.name);
                                        return (
                                            <button
                                                key={table.name}
                                                type="button"
                                                onClick={() => handleToggleTable(table)}
                                                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl border transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>
                                                        <Table size={14} />
                                                    </div>
                                                    <div className="flex flex-col items-start translate-y-[-1px]">
                                                        <span className={`text-[13px] font-medium transition-colors truncate max-w-[140px] ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                            {table.name}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 uppercase tracking-tight">
                                                            {table.columns.length} columns
                                                        </span>
                                                    </div>
                                                </div>
                                                {isSelected && <Check size={14} className="text-blue-500" />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div
                            className="mb-2 px-2 text-[13px] leading-snug text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <form
                        onSubmit={handleSendMessage}
                        className="bg-white dark:bg-[#1a1a1a] border border-gray-200/60 dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] rounded-3xl p-2 transition-shadow focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 flex items-center gap-2"
                    >
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`p-2.5 rounded-full transition-all shrink-0 ${isMenuOpen ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                        >
                            <Plus size={20} className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-45 text-blue-500' : ''}`} />
                        </button>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder="Ask anything or analyze data..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100 py-2.5 outline-none min-w-0"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim()}
                            className={`p-2.5 rounded-full transition-all shrink-0 ${inputValue.trim()
                                ? 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
                                : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed'
                                }`}
                        >
                            <Send size={18} className={inputValue.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        </button>
                    </form>
                    <div className="text-center mt-3 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide">
                        AI CAN MAKE MISTAKES. VERIFY IMPORTANT DATA.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatArea;
