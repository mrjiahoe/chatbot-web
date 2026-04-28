import {
    generateGeneralChatResponse,
    planStructuredRequest,
} from './aiService.js';
import { runPythonAnalysis } from './analysisRunner.js';
import { executeQueryPlan } from './dbService.js';
import { formatAnalysisResponse, formatQueryResponse } from './resultFormatter.js';
import { buildSchemaRegistry } from './schemaRegistry.js';
import {
    buildQueryPlan,
    getRequestPreview,
    validateStructuredRequest,
} from './queryBuilder.js';

// Normal chat replies and structured analytics replies share the same API
// shape so the frontend can render both without branching on transport format.
function buildGeneralResponse(message, usage = {}) {
    return {
        structuredRequest: null,
        message,
        summary: 'General AI response generated.',
        data: null,
        execution: {
            type: 'general_ai',
        },
        tokenUsage: usage,
    };
}

function isLikelyAnalyticsQuestion(message, schemaRegistry) {
    if (schemaRegistry.size === 0) {
        return false;
    }

    // This is a lightweight router, not a second model call. We bias toward
    // obvious analytics wording plus known table/column names from the active
    // schema registry.
    const normalizedMessage = message.toLowerCase();
    const analyticsKeywords = [
        'count',
        'sum',
        'total',
        'average',
        'avg',
        'group by',
        'trend',
        'distribution',
        'compare',
        'comparison',
        'highest',
        'lowest',
        'top ',
        'bottom ',
        'filter',
        'rows',
        'records',
        'table',
        'dataset',
        'sales',
        'revenue',
    ];

    if (analyticsKeywords.some((keyword) => normalizedMessage.includes(keyword))) {
        return true;
    }

    return Array.from(schemaRegistry.values()).some((table) => {
        if (normalizedMessage.includes(table.name.replace(/_/g, ' '))) {
            return true;
        }

        return table.columns.some((column) =>
            normalizedMessage.includes(column.normalizedName.replace(/_/g, ' '))
        );
    });
}

function shouldIncludeDebugPayload(message) {
    const normalizedMessage = (message || '').toLowerCase();
    const asksForJson = /\bjson\b/.test(normalizedMessage);
    const asksForSql = /\bsql\b|\bquery\b/.test(normalizedMessage);
    const asksForRequest = /\bstructured request\b|\brequest payload\b/.test(normalizedMessage);
    return asksForJson || asksForSql || asksForRequest;
}

export async function handleStructuredChat({
    message,
    history,
    dataContext,
    supabase,
}) {
    // Schema can come from the Supabase registry, .env fallback, or selected
    // file context. The controller does not care which source won.
    const schemaRegistry = await buildSchemaRegistry({
        dataContext,
        supabase,
    });

    if (schemaRegistry.size === 0) {
        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
        });

        return buildGeneralResponse(responseText, usage);
    }

    if (!isLikelyAnalyticsQuestion(message, schemaRegistry)) {
        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
        });

        return buildGeneralResponse(responseText, usage);
    }

    const { request: aiPayload, usage: planningUsage } = await planStructuredRequest({
        question: message,
        history,
        registry: schemaRegistry,
    });
    const includeDebug = shouldIncludeDebugPayload(message);

    // The planner can only suggest a request. Validation is the security gate
    // that enforces the approved schema and allowed operations.
    const validatedRequest = validateStructuredRequest(aiPayload, schemaRegistry);
    console.log('Structured chat request:', getRequestPreview(validatedRequest));

    if (validatedRequest.type === 'query') {
        // Query requests stay inside Node and return tabular/aggregate data.
        const plan = buildQueryPlan(validatedRequest);
        const result = await executeQueryPlan({ plan, supabase });

        return {
            structuredRequest: validatedRequest,
            ...formatQueryResponse({
                request: validatedRequest,
                result,
                plan,
                includeDebug,
            }),
            tokenUsage: planningUsage,
            generatedSql: plan.sql || null,
            generatedJson: validatedRequest,
        };
    }

    const analysisTable = schemaRegistry.get(validatedRequest.table);
    // Analysis requests first fetch raw rows through the same safe query layer,
    // then hand the reduced dataset to Python/pandas.
    const analysisPlan = buildQueryPlan({
        type: 'query',
        table: validatedRequest.table,
        operation: 'select',
        provider: validatedRequest.provider,
        source: validatedRequest.source,
        joins: [],
        joinedTables: new Map([[validatedRequest.table, analysisTable]]),
        columns: [
            ...(validatedRequest.group_by
                ? [{
                    kind: 'column',
                    table: validatedRequest.table,
                    source: validatedRequest.source,
                    column: validatedRequest.group_by,
                    outputLabel: validatedRequest.group_by,
                    outputAlias: `${validatedRequest.table}__${validatedRequest.group_by}`,
                }]
                : []),
            {
                kind: 'column',
                table: validatedRequest.table,
                source: validatedRequest.source,
                column: validatedRequest.column,
                outputLabel: validatedRequest.column,
                outputAlias: `${validatedRequest.table}__${validatedRequest.column}`,
            },
            ...(validatedRequest.second_column
                ? [{
                    kind: 'column',
                    table: validatedRequest.table,
                    source: validatedRequest.source,
                    column: validatedRequest.second_column,
                    outputLabel: validatedRequest.second_column,
                    outputAlias: `${validatedRequest.table}__${validatedRequest.second_column}`,
                }]
                : []),
        ],
        filters: validatedRequest.filters,
        group_by: [],
        order_by: [],
        limit: Number(process.env.CHATBOT_QUERY_ROW_LIMIT || 100),
    });

    const rawData = await executeQueryPlan({
        plan: analysisPlan,
        supabase,
    });

    const result = await runPythonAnalysis({
        request: {
            analysis: validatedRequest.analysis,
            table: validatedRequest.table,
            column: validatedRequest.column,
            second_column: validatedRequest.second_column,
            group_by: validatedRequest.group_by,
        },
        rows: rawData.rows || [],
    });

    return {
        structuredRequest: validatedRequest,
        ...formatAnalysisResponse({
            request: validatedRequest,
            result,
            plan: analysisPlan,
            includeDebug,
        }),
        tokenUsage: planningUsage,
        generatedSql: analysisPlan.sql || null,
        generatedJson: validatedRequest,
    };
}
