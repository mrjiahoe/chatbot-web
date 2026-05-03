import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import {
    DEFAULT_GEMINI_MODEL,
    normalizeAiConfig,
} from './aiConfig.js';
import { getSchemaPrompt } from './schemaRegistry.js';

// Only initialize the Gemini client if the API key is present.
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Get the configured Gemini model instance.
 * Throws if the API key is missing so caller can fail fast.
 */
function getGeminiModel(aiConfig, systemInstruction = null) {
    if (!genAI) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured. Switch to Local LLM in Settings or add the Gemini API key.');
    }

    const normalizedAiConfig = normalizeAiConfig(aiConfig);
    const config = {
        model: normalizedAiConfig.geminiModel || DEFAULT_GEMINI_MODEL,
    };

    if (systemInstruction) {
        config.systemInstruction = systemInstruction;
    }

    return genAI.getGenerativeModel(config);
}

// Validate conversation history shape before sending it to the Gemini chat API.
const historySchema = z.array(
    z.object({
        role: z.enum(['user', 'model']),
        parts: z.array(
            z.object({
                text: z.string(),
            })
        ),
    })
);

/**
 * Convert Gemini output that may be wrapped in Markdown code fences into raw JSON text.
 * Gemini sometimes returns JSON inside ```json or ``` blocks even when asked for JSON.
 */
function sanitizeModelJson(text) {
    const trimmed = text.trim();

    if (trimmed.startsWith('```')) {
        return trimmed
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '');
    }

    return trimmed;
}

function normalizeUsageMetadata(usage = {}) {
    return {
        promptTokenCount:
            usage.promptTokenCount ?? usage.prompt_token_count ?? usage.prompt_tokens ?? null,
        candidatesTokenCount:
            usage.candidatesTokenCount ??
            usage.candidates_token_count ??
            usage.completion_tokens ??
            null,
        totalTokenCount:
            usage.totalTokenCount ?? usage.total_token_count ?? usage.total_tokens ?? null,
        cachedContentTokenCount:
            usage.cachedContentTokenCount ?? usage.cached_content_token_count ?? null,
    };
}

function convertHistoryToLocalMessages(history = []) {
    return historySchema.parse(history).slice(-12).map((entry) => ({
        role: entry.role === 'model' ? 'assistant' : 'user',
        content: entry.parts.map((part) => part.text).join('\n\n'),
    }));
}

function extractLocalMessageContent(payload) {
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }

                return part?.text || '';
            })
            .join('')
            .trim();
    }

    throw new Error('Local LLM response did not include message content.');
}

async function callLocalChatCompletion({
    aiConfig,
    systemInstruction = '',
    messages = [],
    temperature = 0.2,
    maxTokens,
}) {
    const normalizedAiConfig = normalizeAiConfig(aiConfig);
    const endpoint = `${normalizedAiConfig.localBaseUrl}/chat/completions`;
    const requestBody = {
        model: normalizedAiConfig.localModel,
        messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            ...messages,
        ],
        temperature,
    };

    if (typeof maxTokens === 'number') {
        requestBody.max_tokens = maxTokens;
    }

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            cache: 'no-store',
        });
    } catch {
        throw new Error(
            `Unable to reach the local LLM at ${normalizedAiConfig.localBaseUrl}. Make sure Ollama or LM Studio is running locally.`
        );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const providerMessage =
            payload?.error?.message ||
            payload?.error ||
            payload?.message ||
            response.statusText;
        throw new Error(`Local LLM request failed: ${providerMessage}`);
    }

    return {
        text: extractLocalMessageContent(payload),
        usage: normalizeUsageMetadata(payload?.usage || {}),
    };
}

/**
 * Build the dynamic part of the planner prompt (schema + context + question).
 * The static instructions are now in the model's systemInstruction.
 */
function buildPlannerPrompt({ question, history, registry }) {
    const recentHistory = historySchema.parse(history || []).slice(-6);
    const transcript = recentHistory
        .map((entry) => `${entry.role}: ${entry.parts.map((part) => part.text).join(' ')}`)
        .join('\n');

    return `
Allowed schema:
${getSchemaPrompt(registry)}

Conversation context:
${transcript || 'No prior history.'}

User question:
${question}
`.trim();
}

function buildGeneralSchemaSummary(registry) {
    const tables = Array.from(registry.values());

    if (tables.length === 0) {
        return 'No approved database schema is currently available.';
    }

    return tables
        .slice(0, 12)
        .map((table) => {
            const columns = table.columns
                .slice(0, 8)
                .map((column) => column.normalizedName)
                .join(', ');

            return `- ${table.name}: ${columns}`;
        })
        .join('\n');
}

/**
 * Ask Gemini to create a structured request for the backend.
 *
 * Returns { request, usage } where request is the JSON plan and usage contains token counts.
 */
export async function planStructuredRequest({ question, history, registry, aiConfig }) {
    const systemInstruction = `
You are a query planner for a hybrid AI-to-data analytics chatbot.
Return exactly one JSON object and nothing else.
Do not write SQL.
Only use the tables and columns provided below.
If the question asks for records or aggregates, return a "query" object.
If the question asks for trends, comparisons, distributions, composition/share-of-total, outliers/anomalies, correlations, period-over-period change, percentage change, missing data, or data quality checks, return an "analysis" object.
If the user asks for "how many", "number of", totals by category, or a visualization of counts per group, prefer a "query" object with operation "count" and an appropriate "group_by" instead of an "analysis" object.

Allowed query operations: select, count, average, sum
Allowed analysis types: trend, comparison, distribution, composition, outlier, correlation, period_change, data_quality
Allowed filter operators: =, !=, >, >=, <, <=, in
Use qualified columns like "orders.amount" when a query joins multiple tables.
Only add joins if they are supported by the allowed schema.
For a request asking for a list of unique values, you may use a "select" query
with one or more columns and a matching "group_by" so the backend returns a
distinct list.
For requests about the number of rows per category, use a "count" query grouped by the category column.
If the question asks for a breakdown across multiple categories, preserve every requested dimension in "group_by" instead of collapsing to one total. For example, counts of male and female teachers in each school should group by both school and gender so the response can be pivoted into a table.
Use "second_column" only for correlation analysis.
Use "group_by" for trend, comparison, composition, and period_change analyses.
For data_quality, you may omit "column" to check the whole table, or include "column" to focus on one field.

Query JSON format:
{
  "type": "query",
  "table": "<table_name>",
  "joins": [
    {
      "table": "<joined_table>",
      "type": "<inner | left>"
    }
  ],
  "operation": "<select | count | average | sum>",
  "columns": ["<column1>", "<joined_table.column2>"],
  "filters": {
    "logic": "<and | or>",
    "conditions": [
      {
        "column": "<column>",
        "operator": "=",
        "value": "<value>"
      }
    ]
  },
  "group_by": ["<column>"],
  "order_by": [
    {
      "column": "<column | value>",
      "direction": "<asc | desc>"
    }
  ],
  "limit": 25
}

Analysis JSON format:
{
  "type": "analysis",
  "analysis": "<trend | comparison | distribution | composition | outlier | correlation | period_change | data_quality>",
  "table": "<table_name>",
  "column": "<column>",
  "group_by": "<column>",
  "second_column": "<column>",
  "filters": {
    "logic": "<and | or>",
    "conditions": [
      {
        "column": "<column>",
        "operator": "=",
        "value": "<value>"
      }
    ]
  }
}
`.trim();

    const normalizedAiConfig = normalizeAiConfig(aiConfig);
    const prompt = buildPlannerPrompt({ question, history, registry });

    if (normalizedAiConfig.provider === 'local') {
        const { text, usage } = await callLocalChatCompletion({
            aiConfig: normalizedAiConfig,
            systemInstruction,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
        });

        return {
            request: JSON.parse(sanitizeModelJson(text)),
            usage,
        };
    }

    const model = getGeminiModel(normalizedAiConfig, systemInstruction);
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: 'application/json',
        },
    });
    const response = await result.response;
    const text = sanitizeModelJson(response.text());

    return {
        request: JSON.parse(text),
        usage: normalizeUsageMetadata(response.usageMetadata || {}),
    };
}

/**
 * Generate a natural language response for non-structured chat questions.
 *
 * Returns { message, usage } where message is the text response and usage contains token counts.
 */
export async function generateGeneralChatResponse({
    question,
    history = [],
    registry = new Map(),
    aiConfig,
}) {
    const systemInstruction = `
You are a helpful assistant inside an education analytics chatbot.
Answer naturally and clearly, but stay grounded in the approved workspace data when relevant.
If the user asks about available data, tables, columns, or what they can analyze, answer using the schema below instead of behaving like a generic chatbot.
If the user asks for actual counts, records, comparisons, trends, or analysis, be explicit that you can help analyze the approved dataset and encourage a data-focused prompt.
If the user asks about live or external-world topics such as weather, breaking news, sports scores, market prices, or travel conditions, do not pretend that the database contains that information. Say that this workspace is connected to the education dataset and can only answer those topics if they exist in the approved tables below.

Approved schema summary:
${buildGeneralSchemaSummary(registry)}
`.trim();
    const normalizedAiConfig = normalizeAiConfig(aiConfig);

    if (normalizedAiConfig.provider === 'local') {
        const { text, usage } = await callLocalChatCompletion({
            aiConfig: normalizedAiConfig,
            systemInstruction,
            messages: [
                ...convertHistoryToLocalMessages(history),
                { role: 'user', content: question },
            ],
            temperature: 0.4,
        });

        return {
            message: text,
            usage,
        };
    }

    const model = getGeminiModel(normalizedAiConfig, systemInstruction);
    const chat = model.startChat({
        history: historySchema.parse(history).slice(-12),
    });
    const result = await chat.sendMessage(question);
    const response = await result.response;

    return {
        message: response.text().trim(),
        usage: normalizeUsageMetadata(response.usageMetadata || {}),
    };
}

/**
 * Create a short title for a chat conversation based on the first message.
 */
export async function generateTitle(firstMessage, aiConfig) {
    const normalizedAiConfig = normalizeAiConfig(aiConfig);
    const prompt = `Generate a very short, concise title (max 5 words) for a chat conversation that begins with this message: "${firstMessage}". Respond with ONLY the title text, no quotes or punctuation.`;

    if (normalizedAiConfig.provider === 'local') {
        const { text } = await callLocalChatCompletion({
            aiConfig: normalizedAiConfig,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            maxTokens: 24,
        });

        return text.trim();
    }

    const model = getGeminiModel(normalizedAiConfig);
    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text().trim();
}
