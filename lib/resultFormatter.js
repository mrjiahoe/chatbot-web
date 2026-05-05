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

function humanizeIdentifier(value) {
    return String(value || '')
        .replace(/^base_/, '')
        .replace(/_/g, ' ')
        .trim();
}

function formatColumnLabel(column) {
    const label = column?.outputLabel || column?.column || '';
    return humanizeIdentifier(label);
}

function formatValue(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, {
            maximumFractionDigits: 2,
        });
    }

    return String(value);
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
    const tableLabel = humanizeIdentifier(request.table);

    if (request.operation === 'select' && request.group_by?.length > 0) {
        return `I found ${result.rowCount} unique ${result.rowCount === 1 ? 'row' : 'rows'} in ${tableLabel}.`;
    }

    if (request.operation === 'select') {
        return `I found ${result.rowCount} ${result.rowCount === 1 ? 'row' : 'rows'} in ${tableLabel}.`;
    }

    if (request.group_by?.length > 0 && Array.isArray(result.rows)) {
        const groupLabel = request.group_by.map((column) => formatColumnLabel(column)).join(', ');

        if (request.operation === 'count') {
            return `Here’s the breakdown by ${groupLabel}.`;
        }

        if (request.operation === 'sum') {
            return `Here’s the total grouped by ${groupLabel}.`;
        }

        if (request.operation === 'average') {
            return `Here’s the average grouped by ${groupLabel}.`;
        }
    }

    if (request.operation === 'count') {
        return `I found ${formatValue(result.value ?? result.rowCount ?? 0)} matching ${tableLabel} record${Number(result.value ?? result.rowCount ?? 0) === 1 ? '' : 's'}.`;
    }

    if (request.operation === 'sum') {
        return `The total for ${tableLabel} is ${formatValue(result.value ?? 0)}.`;
    }

    if (request.operation === 'average') {
        return `The average for ${tableLabel} is ${formatValue(result.value ?? 0)}.`;
    }

    return `Here’s what I found in ${tableLabel}.`;
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
