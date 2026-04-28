import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { getSchemaPrompt } from './schemaRegistry.js';

// Only initialize the Gemini client if the API key is present.
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Get the configured Gemini model instance.
 * Throws if the API key is missing so caller can fail fast.
 */
function getModel(systemInstruction = null) {
    if (!genAI) {
        throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured.');
    }

    const config = {
        model: process.env.NEXT_PUBLIC_AI_MODEL_NAME || 'gemini-3-flash-preview',
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

/**
 * Ask Gemini to create a structured request for the backend.
 *
 * Returns { request, usage } where request is the JSON plan and usage contains token counts.
 */
export async function planStructuredRequest({ question, history, registry }) {
    const systemInstruction = `
You are a query planner for a hybrid AI-to-data analytics chatbot.
Return exactly one JSON object and nothing else.
Do not write SQL.
Only use the tables and columns provided below.
If the question asks for records or aggregates, return a "query" object.
If the question asks for trends, comparisons, distributions, composition/share-of-total, outliers/anomalies, correlations, or analysis that is better handled in Python, return an "analysis" object.

Allowed query operations: select, count, average, sum
Allowed analysis types: trend, comparison, distribution, composition, outlier, correlation
Allowed filter operators: =, !=, >, >=, <, <=, in
Use qualified columns like "orders.amount" when a query joins multiple tables.
Only add joins if they are supported by the allowed schema.
For a request asking for a list of unique values, you may use a "select" query
with one or more columns and a matching "group_by" so the backend returns a
distinct list.
Use "second_column" only for correlation analysis.
Use "group_by" for trend, comparison, and composition analyses.

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
  "analysis": "<trend | comparison | distribution | composition | outlier | correlation>",
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

    const model = getModel(systemInstruction);
    const prompt = buildPlannerPrompt({ question, history, registry });

    // Request JSON output, but still sanitize and parse it because model output
    // may contain formatting artifacts.
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
        usage: response.usageMetadata || {},
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
}) {
    const systemInstruction = 'You are a helpful assistant in a hybrid analytics chatbot. If the user asks a general question, answer naturally and clearly.';
    const model = getModel(systemInstruction);

    const chat = model.startChat({
        history: historySchema.parse(history).slice(-12),
    });
    const result = await chat.sendMessage(question);
    const response = await result.response;

    return {
        message: response.text().trim(),
        usage: response.usageMetadata || {},
    };
}

/**
 * Create a short title for a chat conversation based on the first message.
 */
export async function generateTitle(firstMessage) {
    const model = getModel();
    const prompt = `Generate a very short, concise title (max 5 words) for a chat conversation that begins with this message: "${firstMessage}". Respond with ONLY the title text, no quotes or punctuation.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text().trim();
}
