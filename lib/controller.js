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
        'how many',
        'number of',
        'show me',
        'list',
        'find',
        'give me',
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
        'tables',
        'column',
        'columns',
        'schema',
        'dataset',
        'student',
        'students',
        'teacher',
        'teachers',
        'school',
        'schools',
        'finance',
        'academic',
        'risk',
        'support',
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

function isLikelyExternalWorldQuestion(message) {
    const normalizedMessage = (message || '').trim().toLowerCase();

    if (!normalizedMessage) {
        return false;
    }

    const externalWorldKeywords = [
        'weather',
        'temperature',
        'rain',
        'forecast',
        'tomorrow',
        'today',
        'news',
        'headline',
        'stock',
        'bitcoin',
        'price',
        'exchange rate',
        'football',
        'soccer',
        'nba',
        'movie',
        'restaurant',
        'flight',
        'hotel',
        'traffic',
        'earthquake',
    ];

    return externalWorldKeywords.some((keyword) => normalizedMessage.includes(keyword));
}

function isClearlyGeneralConversation(message) {
    const normalizedMessage = (message || '').trim().toLowerCase();

    if (!normalizedMessage) {
        return true;
    }

    const generalPatterns = [
        /^hi\b/,
        /^hello\b/,
        /^hey\b/,
        /^how are you\b/,
        /^who are you\b/,
        /^tell me a joke\b/,
        /^write (me )?(an?|the)\b/,
        /^draft (me )?(an?|the)\b/,
        /^improve this sentence\b/,
        /^translate\b/,
        /^proofread\b/,
    ];

    return generalPatterns.some((pattern) => pattern.test(normalizedMessage));
}

function shouldIncludeDebugPayload(message) {
    const normalizedMessage = (message || '').toLowerCase();
    const asksForJson = /\bjson\b/.test(normalizedMessage);
    const asksForSql = /\bsql\b|\bquery\b/.test(normalizedMessage);
    const asksForRequest = /\bstructured request\b|\brequest payload\b/.test(normalizedMessage);
    return asksForJson || asksForSql || asksForRequest;
}

function isGenderBreakdownQuestion(message) {
    return /\bmale\b|\bfemale\b|\bgender\b|\bsex\b/i.test(message || '');
}

function normalizeColumnReferenceName(columnRef) {
    if (!columnRef) {
        return '';
    }

    const rawValue = typeof columnRef === 'string'
        ? columnRef
        : (columnRef.outputLabel || columnRef.column || columnRef.sourceColumn || '');

    return String(rawValue).split('.').pop().toLowerCase();
}

function requestIncludesGenderDimension(request) {
    if (!request) {
        return false;
    }

    if (request.type === 'query') {
        return [
            ...(request.group_by || []),
            ...(request.columns || []),
            ...(request.order_by || []).map((order) => order.column),
        ].some((columnRef) => ['gender', 'sex'].includes(normalizeColumnReferenceName(columnRef)));
    }

    return [
        request.column,
        request.group_by,
        request.second_column,
    ].some((columnRef) => ['gender', 'sex'].includes(normalizeColumnReferenceName(columnRef)));
}

function requestSchemaSupportsGenderDimension(request, schemaRegistry) {
    if (!request) {
        return false;
    }

    const tableNames = request.type === 'query'
        ? [request.table, ...(request.joins || []).map((join) => join.table)]
        : [request.table];

    return tableNames.some((tableName) => {
        const tableConfig = schemaRegistry.get(tableName);
        return tableConfig?.columns?.some((column) => ['gender', 'sex'].includes(column.normalizedName));
    });
}

function shouldConvertAnalysisToCountQuery(request) {
    if (!request || request.type !== 'analysis') {
        return false;
    }

    if (!request.group_by) {
        return false;
    }

    if (!['comparison', 'trend', 'composition', 'period_change'].includes(request.analysis)) {
        return false;
    }

    const metricColumn = request.column || '';
    return metricColumn === 'id' || metricColumn.endsWith('_id');
}

function convertAnalysisToCountQuery(request, schemaRegistry) {
    const tableConfig = schemaRegistry.get(request.table);

    if (!tableConfig) {
        throw new Error(`Unsupported table "${request.table}".`);
    }

    const joinedTables = new Map([[request.table, tableConfig]]);
    const groupColumn = {
        kind: 'column',
        table: request.table,
        source: request.source,
        sourceColumn: request.group_by,
        column: request.group_by,
        outputLabel: request.group_by,
        outputAlias: `${request.table}__${request.group_by}`,
    };

    return {
        type: 'query',
        table: request.table,
        operation: 'count',
        provider: request.provider,
        source: request.source,
        joins: [],
        joinedTables,
        columns: [],
        filters: request.filters,
        group_by: [groupColumn],
        order_by: [
            {
                column: {
                    kind: 'aggregate',
                    outputLabel: 'value',
                    outputAlias: 'value',
                    table: null,
                    column: 'value',
                },
                direction: 'desc',
            },
        ],
        limit: Number(process.env.CHATBOT_QUERY_ROW_LIMIT || 100),
    };
}

function buildStructuredValidationFallbackMessage(message, error) {
    const normalizedMessage = (message || '').trim().toLowerCase();
    const errorMessage = error instanceof Error ? error.message : '';

    if (
        errorMessage.includes('Join from the approved schema') &&
        /\bschool\b|\bschools\b/.test(normalizedMessage) &&
        /\btotal\b|\bnumber\b|\bcount\b/.test(normalizedMessage)
    ) {
        return 'I can help with school data, but that request is ambiguous about what should be counted. Try one of these instead: "list all schools", "count total schools", "number of students by school", or "number of teachers by school".';
    }

    if (errorMessage.includes('Join from the approved schema')) {
        return 'I found a relevant dataset, but the requested join is not available in the approved schema for this workspace. Please rephrase with a more specific table target, or ask for a simpler breakdown.';
    }

    return null;
}

export async function handleStructuredChat({
    message,
    history,
    dataContext,
    supabase,
    registrySupabase = null,
}) {
    // Schema can come from the Supabase registry, .env fallback, or selected
    // file context. The controller does not care which source won.
    const schemaRegistry = await buildSchemaRegistry({
        dataContext,
        supabase,
        registrySupabase,
        skipCache: true,
    });

    if (schemaRegistry.size === 0) {
        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
            registry: schemaRegistry,
        });

        return buildGeneralResponse(responseText, usage);
    }

    if (isClearlyGeneralConversation(message) || isLikelyExternalWorldQuestion(message)) {
        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
            registry: schemaRegistry,
        });

        return buildGeneralResponse(responseText, usage);
    }
    const shouldPreferStructured = Boolean(dataContext) || isLikelyAnalyticsQuestion(message, schemaRegistry);
    const includeDebug = shouldIncludeDebugPayload(message);
    let validatedRequest = null;
    let planningUsage = {};

    try {
        const { request: aiPayload, usage } = await planStructuredRequest({
            question: message,
            history,
            registry: schemaRegistry,
        });
        planningUsage = usage;

        // The planner can only suggest a request. Validation is the security gate
        // that enforces the approved schema and allowed operations.
        validatedRequest = validateStructuredRequest(aiPayload, schemaRegistry);
    } catch (error) {
        const fallbackMessage = buildStructuredValidationFallbackMessage(message, error);

        if (fallbackMessage) {
            return buildGeneralResponse(fallbackMessage, planningUsage);
        }

        if (shouldPreferStructured) {
            throw error;
        }

        const { message: responseText, usage } = await generateGeneralChatResponse({
            question: message,
            history,
            registry: schemaRegistry,
        });

        return buildGeneralResponse(responseText, usage);
    }

    if (isGenderBreakdownQuestion(message) && !requestIncludesGenderDimension(validatedRequest)) {
        if (!requestSchemaSupportsGenderDimension(validatedRequest, schemaRegistry)) {
            return buildGeneralResponse(
                'I can show totals for that teacher breakdown, but I cannot split it into male and female counts because the approved schema for this workspace does not expose a gender field for that dataset.',
                planningUsage
            );
        }

        return buildGeneralResponse(
            'I found the right dataset, but the generated request dropped the gender breakdown. Please try the question again, or ask for counts grouped by school and gender.',
            planningUsage
        );
    }

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

    if (shouldConvertAnalysisToCountQuery(validatedRequest)) {
        const countQueryRequest = convertAnalysisToCountQuery(validatedRequest, schemaRegistry);
        const countPlan = buildQueryPlan(countQueryRequest);
        const countResult = await executeQueryPlan({ plan: countPlan, supabase });

        return {
            structuredRequest: countQueryRequest,
            ...formatQueryResponse({
                request: countQueryRequest,
                result: countResult,
                plan: countPlan,
                includeDebug,
            }),
            tokenUsage: planningUsage,
            generatedSql: countPlan.sql || null,
            generatedJson: countQueryRequest,
        };
    }

    const analysisTable = schemaRegistry.get(validatedRequest.table);
    const analysisColumns = validatedRequest.analysis === 'data_quality' && !validatedRequest.column
        ? analysisTable.columns.map((column) => ({
            kind: 'column',
            table: validatedRequest.table,
            source: validatedRequest.source,
            column: column.normalizedName,
            outputLabel: column.normalizedName,
            outputAlias: `${validatedRequest.table}__${column.normalizedName}`,
        }))
        : [
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
            ...(validatedRequest.column
                ? [{
                    kind: 'column',
                    table: validatedRequest.table,
                    source: validatedRequest.source,
                    column: validatedRequest.column,
                    outputLabel: validatedRequest.column,
                    outputAlias: `${validatedRequest.table}__${validatedRequest.column}`,
                }]
                : []),
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
        ];
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
        columns: analysisColumns,
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
