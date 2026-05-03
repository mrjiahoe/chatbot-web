import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCurrentAccessProfile } from '../../../lib/access.js';
import { isLoopbackBaseUrl, normalizeAiConfig } from '../../../lib/aiConfig.js';
import { handleStructuredChat } from '../../../lib/controller.js';
import { generateTitle } from '../../../lib/aiService.js';
import { getServerSupabaseClient } from '../../../lib/serverSupabase.js';
import { getSupabaseAdminClient } from '../../../lib/supabase-admin.js';
import { canAccessChat, canUseChatDataContext } from '../../../lib/roles.js';
import {
    CHAT_DATA_CONTEXT_TOO_LONG,
    CHAT_HISTORY_COUNT_TOO_HIGH,
    CHAT_HISTORY_MESSAGE_TOO_LONG,
    CHAT_MAX_DATA_CONTEXT_CHARS,
    CHAT_MAX_HISTORY_MESSAGES,
    CHAT_MAX_MESSAGE_CHARS,
    CHAT_MESSAGE_TOO_LONG,
} from '../../../lib/chatLimits.js';

export const runtime = 'nodejs';

// This route is the single entry point for the chat UI.
// It validates the request, ensures a conversation exists, delegates to the
// hybrid controller, then persists both sides of the exchange.
const chatSchema = z.object({
    message: z.string().min(1, 'Message is required').max(CHAT_MAX_MESSAGE_CHARS, CHAT_MESSAGE_TOO_LONG),
    conversationId: z.string().uuid().optional(),
    dataContext: z
        .string()
        .max(CHAT_MAX_DATA_CONTEXT_CHARS, CHAT_DATA_CONTEXT_TOO_LONG)
        .optional(),
    history: z
        .array(
            z.object({
                role: z.enum(['user', 'model']),
                parts: z.array(
                    z.object({
                        text: z.string().max(CHAT_MAX_MESSAGE_CHARS, CHAT_HISTORY_MESSAGE_TOO_LONG),
                    })
                ),
            })
        )
        .max(CHAT_MAX_HISTORY_MESSAGES, CHAT_HISTORY_COUNT_TOO_HIGH)
        .optional(),
    aiConfig: z.object({
        provider: z.enum(['gemini', 'local']).optional(),
        geminiModel: z.string().optional(),
        localBaseUrl: z.string().optional(),
        localModel: z.string().optional(),
    }).optional(),
}).strict();

function firstValidationMessage(zodError) {
    const issue = zodError.issues[0];
    return issue?.message ?? 'Invalid request data';
}

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function buildPersistedGeneratedJson(responsePayload) {
    if (!responsePayload?.generatedJson) {
        return null;
    }

    return {
        request: responsePayload.generatedJson,
        execution: responsePayload.execution || null,
        data: responsePayload.data || null,
    };
}

function attachResponseTiming(responsePayload, durationMs) {
    return {
        ...responsePayload,
        execution: {
            ...(responsePayload.execution || {}),
            durationMs,
        },
    };
}

async function ensureConversation({ supabase, conversationId, message, userId, aiConfig }) {
    if (conversationId) {
        const { data, error } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', conversationId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            throw new Error(`Unable to verify conversation: ${error.message}`);
        }

        if (!data) {
            throw httpError(404, 'Conversation not found');
        }

        return data.id;
    }

    // New chats get a lightweight AI-generated title, but we fall back to the
    // first message if the title generation call fails.
    let title = message.slice(0, 50);

    try {
        title = await generateTitle(message, aiConfig);
    } catch (error) {
        console.error('Error generating conversation title:', error);
    }

    const { data, error } = await supabase
        .from('conversations')
        .insert({
            title,
            user_id: userId,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Unable to create conversation: ${error.message}`);
    }

    return data.id;
}

async function persistMessage({
    supabase,
    conversationId,
    role,
    content,
    tokenUsage = null,
    generatedSql = null,
    generatedJson = null,
    executionTimeMs = null,
}) {
    if (!conversationId) {
        return;
    }

    // Message persistence is intentionally best-effort so the user still gets a
    // response even if chat history storage has a transient problem.
    const fullPayload = {
        conversation_id: conversationId,
        role,
        content,
        token_usage: tokenUsage,
        generated_sql: generatedSql,
        generated_json: generatedJson,
        execution_time_ms: executionTimeMs,
    };
    let { error } = await supabase
        .from('messages')
        .insert(fullPayload);

    if (error?.code === 'PGRST204') {
        console.warn(
            `messages table is missing one or more chat diagnostics columns; falling back to plain ${role} message insert.`,
            {
                expectedColumns: ['token_usage', 'generated_sql', 'generated_json', 'execution_time_ms'],
                error,
            }
        );
        const fallbackPayload = {
            conversation_id: conversationId,
            role,
            content,
        };

        const retry = await supabase
            .from('messages')
            .insert(fallbackPayload);
        error = retry.error;
    }

    if (error) {
        console.error(`Failed to save ${role} message:`, error);
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const result = chatSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: firstValidationMessage(result.error),
                    code: 'VALIDATION_ERROR',
                },
                { status: 400 }
            );
        }

        const { message, history = [], conversationId, dataContext = '', aiConfig: rawAiConfig } = result.data;
        const aiConfig = normalizeAiConfig(rawAiConfig);

        if (aiConfig.provider === 'local' && !isLoopbackBaseUrl(aiConfig.localBaseUrl)) {
            throw httpError(400, 'Local LLM mode only supports localhost or loopback API URLs.');
        }

        const supabase = await getServerSupabaseClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
            throw httpError(401, 'Authentication required');
        }

        const accessProfile = await fetchCurrentAccessProfile({
            supabase,
            authUser: user,
        });
        const currentRole = accessProfile.effectiveRole;

        if (!canAccessChat(currentRole)) {
            throw httpError(403, 'You do not have permission to use chat.');
        }

        if (dataContext && !canUseChatDataContext(currentRole)) {
            throw httpError(403, 'You do not have permission to add database context to chat.');
        }

        let registrySupabase = supabase;
        try {
            registrySupabase = getSupabaseAdminClient();
        } catch (registryError) {
            console.warn('Falling back to session client for schema registry:', registryError);
        }

        // We always persist into a conversation thread so the frontend can keep
        // using the existing chat-history UX regardless of response type.
        const currentConversationId = await ensureConversation({
            supabase,
            conversationId,
            message,
            userId: user.id,
            aiConfig,
        });

        await persistMessage({
            supabase,
            conversationId: currentConversationId,
            role: 'user',
            content: message,
        });

        // The controller decides whether this message should be answered as a
        // general AI reply or as a structured analytics request.
        const responseStartedAt = Date.now();
        const responsePayload = await handleStructuredChat({
            message,
            history,
            dataContext,
            supabase,
            registrySupabase,
            aiConfig,
        });
        const timedResponsePayload = attachResponseTiming(
            responsePayload,
            Date.now() - responseStartedAt
        );

        await persistMessage({
            supabase,
            conversationId: currentConversationId,
            role: 'model',
            content: timedResponsePayload.message,
            tokenUsage: timedResponsePayload.tokenUsage || null,
            generatedSql: timedResponsePayload.generatedSql || null,
            generatedJson: buildPersistedGeneratedJson(timedResponsePayload),
            executionTimeMs: timedResponsePayload.execution?.durationMs ?? null,
        });

        return NextResponse.json(
            {
                conversationId: currentConversationId,
                ...timedResponsePayload,
            },
            {
                status: 200,
                headers: {
                    'X-Conversation-Id': currentConversationId,
                },
            }
        );
    } catch (error) {
        console.error('Structured chat API error:', error);
        const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
        if (status === 401 || status === 403 || status === 404) {
            return NextResponse.json({ error: error.message }, { status });
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
