import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Send, FileText, Bot, User, Plus, ArrowDown, Clock, X, Database, Check, Loader2, Table } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { supabase } from '../../lib/supabase';
import { getChatClientValidationError } from '../../lib/chatLimits';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { canAccessChat, canUseChatDataContext } from '@/lib/roles';
import ResultVisualization, {
    canVisualizeStructuredResult,
    stripVisualizationTableFromMessage,
} from './ResultVisualization';

function getTokenUsage(message) {
    const usage = message?.tokenUsage || message?.token_usage || null;

    if (!usage || typeof usage !== 'object') {
        return null;
    }

    return {
        promptTokenCount: usage.promptTokenCount ?? usage.prompt_token_count ?? null,
        candidatesTokenCount: usage.candidatesTokenCount ?? usage.candidates_token_count ?? null,
        totalTokenCount: usage.totalTokenCount ?? usage.total_token_count ?? null,
        cachedContentTokenCount:
            usage.cachedContentTokenCount ?? usage.cached_content_token_count ?? null,
    };
}

function getResponseDuration(message) {
    const durationMs =
        message?.execution?.durationMs ??
        message?.execution?.duration_ms ??
        message?.responseDurationMs ??
        message?.response_duration_ms ??
        null;

    return typeof durationMs === 'number' && Number.isFinite(durationMs)
        ? durationMs
        : null;
}

function formatResponseDuration(durationMs) {
    if (!durationMs || durationMs < 1000) {
        return `${durationMs || 0} ms`;
    }

    return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)} s`;
}

const ChatArea = ({
    messages,
    setMessages,
    assistantLabel = 'AI Analyst',
    onViewHistory,
    activeChatId,
    onConversationCreated,
    isLoadingChat,
    currentRole,
    canViewHistory,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // Data Context States
    const [availableTables, setAvailableTables] = useState([]);
    const [selectedTables, setSelectedTables] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFetchingTables, setIsFetchingTables] = useState(false);
    const canUseChatFeature = canAccessChat(currentRole);
    const canUseDataContext = canUseChatDataContext(currentRole);

    useEffect(() => {
        if (isMenuOpen && canUseDataContext) {
            fetchAvailableTables();
        }
    }, [isMenuOpen, canUseDataContext]);

    useEffect(() => {
        if (!canUseDataContext) {
            setIsMenuOpen(false);
            setSelectedTables([]);
        }
    }, [canUseDataContext]);

    const fetchAvailableTables = async () => {
        setIsFetchingTables(true);
        try {
            const response = await fetch('/api/schema/tables', {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load schema tables.');
            }

            setAvailableTables(payload.tables || []);
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
        if (!canUseChatFeature || !inputValue.trim() || isLoading) return;

        // Prepare data context string from selected tables
        const dataContext = canUseDataContext && selectedTables.length > 0
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
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                tokenUsage: payload.tokenUsage || {},
                generatedSql: payload.generatedSql || null,
                generatedJson: payload.generatedJson || null,
                resultData: payload.data || null,
                execution: payload.execution || null,
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

    if (!canUseChatFeature) {
        return (
            <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
                <div className="mx-auto max-w-5xl">
                    <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20">
                        <CardHeader>
                            <CardTitle className="text-amber-900 dark:text-amber-100">Access restricted</CardTitle>
                            <CardDescription className="text-amber-800/80 dark:text-amber-200/80">
                                Your current role does not have access to chat.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col relative w-full items-center min-h-0">
            {messages.length === 0 && !activeChatId && !isLoadingChat ? (
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
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onViewHistory}
                        className="group rounded-full gap-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                        disabled={!canViewHistory}
                    >
                        <Clock size={16} className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                        Browse recent chats
                    </Button>
                </div>
            ) : isLoadingChat ? (
                <div className="flex-1 flex items-center justify-center w-full px-6 md:px-12 pb-40">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={32} className="animate-spin text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Loading chat...</span>
                    </div>
                </div>
            ) : (
                <div
                    className="flex-1 overflow-y-auto w-full px-6 md:px-12 pb-40 scroll-smooth"
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                >
                    <div className="max-w-3xl mx-auto space-y-10 py-8">
                        {messages.map((message) => {
                            const tokenUsage = getTokenUsage(message);
                            const responseDuration = getResponseDuration(message);
                            const hasVisualization = message.sender === 'bot' && canVisualizeStructuredResult({
                                execution: message.execution,
                                data: message.resultData,
                                request: message.generatedJson,
                            });
                            const displayText = hasVisualization
                                ? stripVisualizationTableFromMessage(message.text)
                                : message.text;

                            return (
                            <div key={message.id} className="group relative flex items-start gap-5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${message.sender === 'user'
                                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                                    : message.isError
                                        ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                        : 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                                    }`}>
                                    {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <Card
                                    className={`flex-1 overflow-hidden border-border/70 shadow-sm ${
                                        message.sender === 'user'
                                            ? 'bg-muted/40'
                                            : message.isError
                                                ? 'border-red-200 bg-red-50/70 dark:border-red-900/30 dark:bg-red-950/20'
                                                : 'bg-card'
                                    }`}
                                >
                                    <CardContent className="space-y-2 p-4 md:p-5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">
                                                {message.sender === 'user' ? 'You' : assistantLabel}
                                            </span>
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {message.timestamp}
                                            </span>
                                        </div>
                                        {message.sender === 'bot' && (
                                            <ResultVisualization
                                                execution={message.execution}
                                                data={message.resultData}
                                                request={message.generatedJson}
                                            />
                                        )}
                                        <div className={`prose dark:prose-invert max-w-none leading-relaxed text-[15px] ${message.isError ? 'text-red-600 dark:text-red-400 italic' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ node, inline, className, children, ...props }) {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        return !inline && match ? (
                                                            <div className="relative group">
                                                                <div className="absolute right-4 top-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{match[1]}</span>
                                                                </div>
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    className="!m-0 !rounded-2xl !border !border-border !bg-zinc-50 !p-6 dark:!bg-zinc-900/50"
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
                                                    p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                                }}
                                            >
                                                {displayText}
                                            </ReactMarkdown>
                                        </div>
                                        {message.sender === 'bot' && ((tokenUsage && (tokenUsage.promptTokenCount || tokenUsage.candidatesTokenCount || tokenUsage.totalTokenCount)) || responseDuration) && (
                                            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                                                {responseDuration && (
                                                    <span className="font-mono flex items-center gap-1">
                                                        <span>⏱</span>
                                                        <span>Time:</span>
                                                        <span className="font-semibold text-foreground">{formatResponseDuration(responseDuration)}</span>
                                                    </span>
                                                )}
                                                {tokenUsage && (tokenUsage.promptTokenCount || tokenUsage.candidatesTokenCount || tokenUsage.totalTokenCount) && (
                                                    <>
                                                        <span className="font-mono flex items-center gap-1">
                                                            <span>📊</span>
                                                            <span className="text-muted-foreground">Tokens:</span>
                                                        </span>
                                                        {tokenUsage.promptTokenCount && (
                                                            <span className="font-mono">Input: <span className="text-blue-500">{tokenUsage.promptTokenCount}</span></span>
                                                        )}
                                                        {tokenUsage.candidatesTokenCount && (
                                                            <span className="font-mono">Output: <span className="text-green-500">{tokenUsage.candidatesTokenCount}</span></span>
                                                        )}
                                                        {tokenUsage.totalTokenCount && (
                                                            <span className="font-mono">Total: <span className="font-semibold text-purple-500">{tokenUsage.totalTokenCount}</span></span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {message.sender === 'bot' && (message.generatedSql || message.generatedJson) && (
                                            <details className="border-t border-border pt-3">
                                                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                                                    <span>📝</span>
                                                    <span>Generated Request Details</span>
                                                    <span>▼</span>
                                                </summary>
                                                <div className="mt-3 space-y-2">
                                                    {message.generatedJson && (
                                                        <div>
                                                            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Structured Request (JSON):</p>
                                                            <pre className="overflow-x-auto rounded-lg border border-border bg-zinc-900 p-3 text-xs text-zinc-100 dark:bg-zinc-950">
                                                                {JSON.stringify(message.generatedJson, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {message.generatedSql && (
                                                        <div>
                                                            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Generated SQL:</p>
                                                            <pre className="overflow-x-auto rounded-lg border border-blue-800 bg-blue-950 p-3 font-mono text-xs text-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                                                {message.generatedSql}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                            );
                        })}

                        {isLoading && (
                            <div className="flex items-start gap-5">
                                <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
                                    <Bot size={16} className="text-white dark:text-black" />
                                </div>
                                <div className="flex-1 pt-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{assistantLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">The chat is thinking</span>
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>
            )}

            {showScrollButton && (
                <Button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-28 z-20 border border-border/70 bg-card/90 text-muted-foreground shadow-lg backdrop-blur-md hover:bg-muted hover:text-foreground"
                >
                    <ArrowDown size={18} />
                </Button>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#fbfbfb] via-[#fbfbfb]/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 dark:to-transparent pointer-events-none flex justify-center">
                <div className="w-full max-w-3xl pointer-events-auto relative">
                    {/* Selected Tables Chips */}
                    {canUseDataContext && selectedTables.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3 px-2">
                            {selectedTables.map(table => (
                                <div
                                    key={table.name}
                                    className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-xs text-foreground/80 shadow-none"
                                >
                                    <Database size={12} className="text-blue-500" />
                                    <span className="truncate max-w-[120px]">{table.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => setSelectedTables(prev => prev.filter(t => t.name !== table.name))}
                                        className="ml-1 rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                                    >
                                        <X size={12} />
                                        <span className="sr-only">Remove table</span>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table Selection Menu */}
                    {canUseDataContext && isMenuOpen && (
                        <Card className="absolute bottom-full left-0 mb-4 w-80 overflow-hidden border-border/80 shadow-2xl z-[100] pointer-events-auto">
                            <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border bg-muted/20 p-4">
                                <div>
                                    <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                                        Select Database Tables
                                    </CardTitle>
                                    <CardDescription className="mt-1 text-xs">
                                        Add tables to the prompt context.
                                    </CardDescription>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    <X size={16} />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-2">
                                <ScrollArea className="h-64">
                                    <div className="space-y-1 pr-2">
                                        {isFetchingTables ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                                            </div>
                                        ) : availableTables.length === 0 ? (
                                            <div className="px-4 py-8 text-center">
                                                <p className="text-xs text-muted-foreground">
                                                    No tables available. Check your database configuration.
                                                </p>
                                            </div>
                                        ) : (
                                            availableTables.map(table => {
                                                const isSelected = selectedTables.some(t => t.name === table.name);
                                                return (
                                                    <Button
                                                        key={table.name}
                                                        type="button"
                                                        variant={isSelected ? 'secondary' : 'ghost'}
                                                        onClick={() => handleToggleTable(table)}
                                                        className="h-auto w-full justify-between rounded-xl px-3 py-3"
                                                    >
                                                        <div className="flex items-center gap-3 text-left">
                                                            <div className={`flex size-8 items-center justify-center rounded-lg border transition-colors ${isSelected ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground'}`}>
                                                                <Table size={14} />
                                                            </div>
                                                            <div className="flex flex-col items-start">
                                                                <span className={`text-sm font-medium transition-colors truncate max-w-[150px] ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                                                                    {table.name}
                                                                </span>
                                                                <span className="text-[10px] uppercase tracking-tight text-muted-foreground">
                                                                    {table.columns.length} columns
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {isSelected && <Check size={14} className="text-primary" />}
                                                    </Button>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
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
                        className="flex items-center gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/20"
                    >
                        <Button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            variant={isMenuOpen ? 'secondary' : 'ghost'}
                            size="icon"
                            className="shrink-0 rounded-full"
                            disabled={!canUseDataContext}
                        >
                            <Plus size={20} className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-45 text-blue-500' : ''}`} />
                        </Button>
                        <Input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder="Ask anything or analyze data..."
                            className="h-11 flex-1 border-none bg-transparent px-0 text-[15px] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            disabled={!inputValue.trim()}
                            size="icon"
                            className="shrink-0 rounded-full"
                        >
                            <Send size={18} className={inputValue.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        </Button>
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
