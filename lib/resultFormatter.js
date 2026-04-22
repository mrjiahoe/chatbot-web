function toMarkdownTable(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return '';
    }

    const headers = Object.keys(rows[0]);
    const headerRow = `| ${headers.join(' | ')} |`;
    const dividerRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const bodyRows = rows.map((row) =>
        `| ${headers.map((header) => String(row[header] ?? '')).join(' | ')} |`
    );

    return [headerRow, dividerRow, ...bodyRows].join('\n');
}

function toJsonBlock(value) {
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function buildDiagnosticsMarkdown({ includeDebug = false, request, plan }) {
    if (!includeDebug) {
        return '';
    }

    const sections = [
        '---',
        'Structured request JSON',
        toJsonBlock(request),
    ];

    if (plan?.sql) {
        sections.push('SQL preview', `\`\`\`sql\n${plan.sql}\n\`\`\``);
    } else if (plan) {
        sections.push(
            'Execution plan',
            toJsonBlock({
                provider: plan.provider,
                source: request.source,
                operation: request.operation || 'select',
                columns: request.columns || request.column,
                filters: request.filters || null,
                group_by: request.group_by || null,
                order_by: request.order_by || null,
                limit: request.limit || null,
            })
        );
    }

    return `\n\n${sections.join('\n\n')}`;
}

function summarizeQueryResult(request, result) {
    if (request.operation === 'select') {
        return `Returned ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} from \`${request.table}\`.`;
    }

    if (request.group_by?.length > 0 && Array.isArray(result.rows)) {
        const groupLabel = request.group_by.map((column) => `\`${column.outputLabel}\``).join(', ');
        return `Computed ${request.operation} grouped by ${groupLabel} for \`${request.table}\`.`;
    }

    return `Computed ${request.operation} for \`${request.table}\`.`;
}

export function formatQueryResponse({ request, result, plan, includeDebug = false }) {
    const summary = summarizeQueryResult(request, result);
    const markdown = Array.isArray(result.rows) && result.rows.length > 0
        ? `${summary}\n\n${toMarkdownTable(result.rows.slice(0, 20))}`
        : `${summary}\n\nResult: \`${result.value}\``;
    const diagnostics = buildDiagnosticsMarkdown({ includeDebug, request, plan });

    return {
        message: `${markdown}${diagnostics}`,
        summary,
        data: result,
        execution: {
            type: 'query',
            provider: plan.provider,
            operation: request.operation,
            table: request.table,
        },
    };
}

export function formatAnalysisResponse({
    request,
    result,
    plan = null,
    includeDebug = false,
}) {
    const summary = result.summary || `Completed ${request.analysis} analysis for \`${request.table}\`.`;
    const markdownTable = Array.isArray(result.rows) && result.rows.length > 0
        ? `\n\n${toMarkdownTable(result.rows.slice(0, 20))}`
        : '';
    const diagnostics = buildDiagnosticsMarkdown({ includeDebug, request, plan });

    return {
        message: `${summary}${markdownTable}${diagnostics}`,
        summary,
        data: result,
        execution: {
            type: 'analysis',
            analysis: request.analysis,
            table: request.table,
        },
    };
}
