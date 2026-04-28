import { z } from 'zod';
import {
    getColumnConfig,
    getJoinConfig,
    getTableConfig,
    normalizeRequestedName,
} from './schemaRegistry.js';

const primitiveValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const filterOperatorSchema = z.enum(['=', '!=', '>', '>=', '<', '<=', 'in']);
const sortDirectionSchema = z.enum(['asc', 'desc']);

const legacyFilterSchema = z.record(
    z.string(),
    z.object({
        operator: filterOperatorSchema,
        value: z.union([primitiveValueSchema, z.array(primitiveValueSchema)]),
    })
);

const filterConditionSchema = z.object({
    column: z.string().min(1),
    operator: filterOperatorSchema,
    value: z.union([primitiveValueSchema, z.array(primitiveValueSchema)]),
}).strict();

const filterGroupSchema = z.lazy(() =>
    z.object({
        logic: z.enum(['and', 'or']),
        conditions: z.array(z.union([filterConditionSchema, filterGroupSchema])),
    }).strict()
);

const joinRequestSchema = z.object({
    table: z.string().min(1),
    type: z.enum(['inner', 'left']).optional(),
}).strict();

const orderBySchema = z.object({
    column: z.string().min(1),
    direction: sortDirectionSchema.optional().default('asc'),
}).strict();

const querySchema = z.object({
    type: z.literal('query'),
    table: z.string().min(1),
    operation: z.enum(['select', 'count', 'average', 'sum']),
    joins: z.array(joinRequestSchema).max(5).optional().default([]),
    columns: z.array(z.string().min(1)).max(20).optional().default([]),
    filters: z.union([legacyFilterSchema, filterGroupSchema, z.null()]).optional(),
    group_by: z.union([z.string().min(1), z.array(z.string().min(1)).max(5)]).optional().nullable(),
    order_by: z.array(orderBySchema).max(5).optional().default([]),
    limit: z.number().int().positive().max(500).optional().nullable(),
}).strict();

const analysisSchema = z.object({
    type: z.literal('analysis'),
    analysis: z.enum([
        'trend',
        'comparison',
        'distribution',
        'composition',
        'outlier',
        'correlation',
    ]),
    table: z.string().min(1),
    column: z.string().min(1),
    second_column: z.string().min(1).optional().nullable(),
    group_by: z.string().min(1).optional().nullable(),
    filters: z.union([legacyFilterSchema, filterGroupSchema, z.null()]).optional(),
}).strict();

export const structuredRequestSchema = z.discriminatedUnion('type', [
    querySchema,
    analysisSchema,
]);

// Validation here is the main safety barrier between model output and database
// execution. The model proposes a request shape; this file decides whether that
// request is actually allowed.
function assertTable(registry, tableName) {
    const tableConfig = getTableConfig(registry, tableName);

    if (!tableConfig) {
        throw new Error(`Unsupported table "${tableName}".`);
    }

    return tableConfig;
}

function assertColumn(tableConfig, columnName) {
    const columnConfig = getColumnConfig(tableConfig, columnName);

    if (!columnConfig) {
        throw new Error(
            `Unsupported column "${columnName}" for table "${tableConfig.displayName}".`
        );
    }

    return columnConfig;
}

function toFilterGroup(filters) {
    if (!filters) {
        return null;
    }

    if ('logic' in filters && 'conditions' in filters) {
        const parsedFilterGroup = filterGroupSchema.parse(filters);
        return parsedFilterGroup.conditions.length > 0 ? parsedFilterGroup : null;
    }

    const legacyFilters = legacyFilterSchema.parse(filters);
    const conditions = Object.entries(legacyFilters).map(([column, filter]) => ({
        column,
        operator: filter.operator,
        value: filter.value,
    }));

    return conditions.length > 0
        ? {
            logic: 'and',
            conditions,
        }
        : null;
}

function resolveJoinRequests(baseTableConfig, joinRequests, registry) {
    const tables = new Map([[baseTableConfig.name, baseTableConfig]]);
    const joins = [];

    // Joins are only allowed if they are explicitly declared in schema
    // metadata. We never infer ad-hoc joins from model output alone.
    joinRequests.forEach((joinRequest) => {
        const targetTable = assertTable(registry, joinRequest.table);

        if (tables.has(targetTable.name)) {
            return;
        }

        if (targetTable.provider !== baseTableConfig.provider) {
            throw new Error('Joined tables must use the same database provider.');
        }

        let resolvedJoin = null;

        Array.from(tables.values()).forEach((currentTable) => {
            if (resolvedJoin) {
                return;
            }

            const directJoin = getJoinConfig(currentTable, targetTable.name);
            if (directJoin) {
                resolvedJoin = {
                    fromTable: currentTable.name,
                    table: targetTable.name,
                    type: joinRequest.type || directJoin.type,
                    leftColumn: directJoin.sourceColumn,
                    rightColumn: directJoin.targetColumn,
                };
                return;
            }

            const reverseJoin = getJoinConfig(targetTable, currentTable.name);
            if (reverseJoin) {
                resolvedJoin = {
                    fromTable: currentTable.name,
                    table: targetTable.name,
                    type: joinRequest.type || reverseJoin.type,
                    leftColumn: reverseJoin.targetColumn,
                    rightColumn: reverseJoin.sourceColumn,
                };
            }
        });

        if (!resolvedJoin) {
            throw new Error(
                `Join from the approved schema to "${targetTable.displayName}" is not configured.`
            );
        }

        joins.push(resolvedJoin);
        tables.set(targetTable.name, targetTable);
    });

    return {
        joins,
        tables,
    };
}

function resolveColumnReference(reference, baseTableConfig, joinedTables, options = {}) {
    if (reference === 'value' && options.allowAggregateValue) {
        return {
            kind: 'aggregate',
            outputLabel: 'value',
            outputAlias: 'value',
            table: null,
            column: 'value',
        };
    }

    const [maybeTable, maybeColumn] = reference.split('.');
    const hasExplicitTable = Boolean(maybeColumn);
    const tableName = hasExplicitTable ? maybeTable : baseTableConfig.name;
    const columnName = hasExplicitTable ? maybeColumn : maybeTable;
    const tableConfig = joinedTables.get(normalizeRequestedName(tableName));

    if (!tableConfig) {
        throw new Error(`Unsupported table reference "${tableName}" in column "${reference}".`);
    }

    const columnConfig = assertColumn(tableConfig, columnName);
    const shouldQualify = hasExplicitTable || joinedTables.size > 1;

    return {
        kind: 'column',
        table: tableConfig.name,
        source: tableConfig.source,
        sourceColumn: columnConfig.name,
        column: columnConfig.normalizedName,
        outputLabel: shouldQualify
            ? `${tableConfig.name}.${columnConfig.normalizedName}`
            : columnConfig.normalizedName,
        outputAlias: `${tableConfig.name}__${columnConfig.normalizedName}`,
    };
}

function normalizeFilterGroup(filterGroup, baseTableConfig, joinedTables) {
    if (!filterGroup) {
        return null;
    }

    return {
        logic: filterGroup.logic,
        conditions: filterGroup.conditions.map((condition) => {
            if ('logic' in condition && 'conditions' in condition) {
                return normalizeFilterGroup(condition, baseTableConfig, joinedTables);
            }

            return {
                type: 'condition',
                column: resolveColumnReference(condition.column, baseTableConfig, joinedTables),
                operator: condition.operator,
                value: condition.value,
            };
        }),
    };
}

function normalizeGroupBy(groupByInput, baseTableConfig, joinedTables) {
    const groupByValues = !groupByInput
        ? []
        : Array.isArray(groupByInput)
            ? groupByInput
            : [groupByInput];

    return groupByValues.map((value) =>
        resolveColumnReference(value, baseTableConfig, joinedTables)
    );
}

function normalizeOrderBy(orderByInput, baseTableConfig, joinedTables, allowAggregateValue = false) {
    return (orderByInput || []).map((order) => ({
        column: resolveColumnReference(order.column, baseTableConfig, joinedTables, {
            allowAggregateValue,
        }),
        direction: order.direction || 'asc',
    }));
}

function getRequestLimit(limit) {
    const defaultLimit = Number(process.env.CHATBOT_QUERY_ROW_LIMIT || 100);

    if (!limit) {
        return defaultLimit;
    }

    return Math.min(limit, defaultLimit);
}

function getDefaultSelectColumns(baseTableConfig) {
    return baseTableConfig.columns.map((column) => ({
        kind: 'column',
        table: baseTableConfig.name,
        source: baseTableConfig.source,
        column: column.normalizedName,
        outputLabel: column.normalizedName,
        outputAlias: `${baseTableConfig.name}__${column.normalizedName}`,
    }));
}

function sanitizeFilterGroup(filterGroup) {
    if (!filterGroup || typeof filterGroup !== 'object') {
        return null;
    }

    if (!('logic' in filterGroup) || !('conditions' in filterGroup)) {
        return filterGroup;
    }

    if (!Array.isArray(filterGroup.conditions)) {
        return null;
    }

    const sanitizedConditions = filterGroup.conditions
        .map((condition) => sanitizeFilterGroup(condition))
        .filter(Boolean);

    if (sanitizedConditions.length === 0) {
        return null;
    }

    return {
        logic: filterGroup.logic,
        conditions: sanitizedConditions,
    };
}

function sanitizeStructuredPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    return {
        ...payload,
        filters: sanitizeFilterGroup(payload.filters),
    };
}

export function validateStructuredRequest(payload, registry) {
    const parsed = structuredRequestSchema.parse(sanitizeStructuredPayload(payload));
    const tableConfig = assertTable(registry, parsed.table);

    if (parsed.type === 'query') {
        // Query requests are normalized into an execution-friendly internal
        // shape that uses resolved table/column metadata rather than raw names.
        const { joins, tables } = resolveJoinRequests(tableConfig, parsed.joins, registry);
        const rawColumns = parsed.columns.length === 0
            ? getDefaultSelectColumns(tableConfig)
            : parsed.columns.map((column) =>
                resolveColumnReference(column, tableConfig, tables)
            );
        const groupBy = normalizeGroupBy(parsed.group_by, tableConfig, tables);
        const filters = normalizeFilterGroup(toFilterGroup(parsed.filters), tableConfig, tables);
        const orderBy = normalizeOrderBy(
            parsed.order_by,
            tableConfig,
            tables,
            parsed.operation !== 'select'
        );
        const limit = getRequestLimit(parsed.limit);

        // A select with group_by is treated as a distinct list request.
        // The model often uses this shape for "list the values" prompts.
        const columns = parsed.operation === 'select' && groupBy.length > 0
            ? groupBy
            : rawColumns;

        if ((parsed.operation === 'average' || parsed.operation === 'sum') && columns.length !== 1) {
            throw new Error(`${parsed.operation} requests must specify exactly one metric column.`);
        }

        if (parsed.operation !== 'select' && columns.some((column) => column.kind !== 'column')) {
            throw new Error('Aggregate queries must target regular columns.');
        }

        return {
            ...parsed,
            table: tableConfig.name,
            provider: tableConfig.provider,
            source: tableConfig.source,
            joins,
            joinedTables: tables,
            columns,
            filters,
            group_by: groupBy,
            order_by: orderBy,
            limit,
        };
    }

    const metricColumn = assertColumn(tableConfig, parsed.column).normalizedName;
    const secondColumn = parsed.second_column
        ? assertColumn(tableConfig, parsed.second_column).normalizedName
        : null;
    const groupBy = parsed.group_by
        ? assertColumn(tableConfig, parsed.group_by).normalizedName
        : null;

    if (
        (parsed.analysis === 'trend' ||
            parsed.analysis === 'comparison' ||
            parsed.analysis === 'composition') &&
        !groupBy
    ) {
        throw new Error(`${parsed.analysis} analysis requires a group_by column.`);
    }

    if (parsed.analysis === 'correlation' && !secondColumn) {
        throw new Error('correlation analysis requires a second_column.');
    }

    if (parsed.analysis !== 'correlation' && secondColumn) {
        throw new Error(`${parsed.analysis} analysis does not support second_column.`);
    }

    if (parsed.analysis === 'correlation' && metricColumn === secondColumn) {
        throw new Error('correlation analysis requires two different columns.');
    }

    return {
        ...parsed,
        table: tableConfig.name,
        column: metricColumn,
        second_column: secondColumn,
        filters: normalizeFilterGroup(
            toFilterGroup(parsed.filters),
            tableConfig,
            new Map([[tableConfig.name, tableConfig]])
        ),
        group_by: groupBy,
        provider: tableConfig.provider,
        source: tableConfig.source,
    };
}

function buildTableAliases(request) {
    const aliases = new Map();
    let index = 0;

    aliases.set(request.table, `t${index}`);

    request.joins.forEach((join) => {
        index += 1;
        aliases.set(join.table, `t${index}`);
    });

    return aliases;
}

function compileSqlColumn(columnRef, tableAliases) {
    if (columnRef.kind === 'aggregate') {
        return 'value';
    }

    return `${tableAliases.get(columnRef.table)}.\`${columnRef.sourceColumn || columnRef.column}\``;
}

function buildMysqlFilterClause(filterGroup, tableAliases) {
    if (!filterGroup || filterGroup.conditions.length === 0) {
        return { sql: '', values: [] };
    }

    const values = [];

    const sql = filterGroup.conditions.map((condition) => {
        if ('logic' in condition) {
            const nested = buildMysqlFilterClause(condition, tableAliases);
            values.push(...nested.values);
            return `(${nested.sql})`;
        }

        const sqlColumn = compileSqlColumn(condition.column, tableAliases);

        if (condition.operator === 'in') {
            if (!Array.isArray(condition.value) || condition.value.length === 0) {
                throw new Error(`Filter "${condition.column.outputLabel}" requires a non-empty array for "in".`);
            }

            values.push(...condition.value);
            return `${sqlColumn} IN (${condition.value.map(() => '?').join(', ')})`;
        }

        values.push(condition.value);
        return `${sqlColumn} ${condition.operator} ?`;
    }).join(` ${filterGroup.logic.toUpperCase()} `);

    return { sql, values };
}

function buildJoinClause(request, tableAliases) {
    return request.joins.map((join) => {
        const fromAlias = tableAliases.get(join.fromTable);
        const targetAlias = tableAliases.get(join.table);
        const targetSource = request.joinedTables.get(join.table).source;
        const joinType = join.type === 'left' ? 'LEFT JOIN' : 'INNER JOIN';

        return `${joinType} \`${targetSource}\` ${targetAlias} ON ${fromAlias}.\`${join.leftColumn}\` = ${targetAlias}.\`${join.rightColumn}\``;
    }).join(' ');
}

function buildSelectClause(request, tableAliases) {
    if (request.operation === 'select') {
        return request.columns
            .map((column) => `${compileSqlColumn(column, tableAliases)} AS \`${column.outputAlias}\``)
            .join(', ');
    }

    const groupByColumns = request.group_by
        .map((column) => `${compileSqlColumn(column, tableAliases)} AS \`${column.outputAlias}\``)
        .join(', ');

    const metricColumn = request.columns[0];
    let aggregateSql = 'COUNT(*) AS `value`';

    if (request.operation === 'sum') {
        aggregateSql = `SUM(${compileSqlColumn(metricColumn, tableAliases)}) AS \`value\``;
    }

    if (request.operation === 'average') {
        aggregateSql = `AVG(${compileSqlColumn(metricColumn, tableAliases)}) AS \`value\``;
    }

    return [groupByColumns, aggregateSql].filter(Boolean).join(', ');
}

function buildOrderByClause(request, tableAliases) {
    if (!request.order_by || request.order_by.length === 0) {
        return '';
    }

    const orderBySql = request.order_by
        .map((order) => `${compileSqlColumn(order.column, tableAliases)} ${order.direction.toUpperCase()}`)
        .join(', ');

    return ` ORDER BY ${orderBySql}`;
}

export function buildQueryPlan(validatedRequest) {
    if (validatedRequest.type !== 'query') {
        throw new Error('Query plans can only be created for query requests.');
    }

    if (validatedRequest.provider === 'mysql') {
        // MySQL gets a real parameterized SQL string because joins and richer
        // SQL features are easier to express safely this way.
        const tableAliases = buildTableAliases(validatedRequest);
        const whereClause = buildMysqlFilterClause(validatedRequest.filters, tableAliases);
        const joinClause = buildJoinClause(validatedRequest, tableAliases);
        const groupBySql = validatedRequest.group_by.length > 0
            ? ` GROUP BY ${validatedRequest.group_by
                .map((column) => compileSqlColumn(column, tableAliases))
                .join(', ')}`
            : '';
        const orderBySql = buildOrderByClause(validatedRequest, tableAliases);
        const limitSql = validatedRequest.limit ? ` LIMIT ${validatedRequest.limit}` : '';
        const baseAlias = tableAliases.get(validatedRequest.table);

        return {
            provider: 'mysql',
            sql: `SELECT ${buildSelectClause(validatedRequest, tableAliases)} FROM \`${validatedRequest.source}\` ${baseAlias}${joinClause ? ` ${joinClause}` : ''}${whereClause.sql ? ` WHERE ${whereClause.sql}` : ''}${groupBySql}${orderBySql}${limitSql}`,
            values: whereClause.values,
            request: validatedRequest,
            outputMap: [
                ...validatedRequest.columns.map((column) => ({
                    alias: column.outputAlias,
                    label: column.outputLabel,
                })),
                ...validatedRequest.group_by.map((column) => ({
                    alias: column.outputAlias,
                    label: column.outputLabel,
                })),
            ],
        };
    }

    return {
        provider: 'supabase',
        request: validatedRequest,
    };
}

function getColumnValue(row, columnRef) {
    return row[columnRef.sourceColumn] ?? row[columnRef.column] ?? row[columnRef.outputLabel];
}

function matchesCondition(row, condition) {
    const leftValue = getColumnValue(row, condition.column);

    if (condition.operator === '=') return leftValue === condition.value;
    if (condition.operator === '!=') return leftValue !== condition.value;
    if (condition.operator === '>') return leftValue > condition.value;
    if (condition.operator === '>=') return leftValue >= condition.value;
    if (condition.operator === '<') return leftValue < condition.value;
    if (condition.operator === '<=') return leftValue <= condition.value;
    if (condition.operator === 'in') {
        return Array.isArray(condition.value) && condition.value.includes(leftValue);
    }

    return false;
}

function matchesFilterGroup(row, filterGroup) {
    if (!filterGroup) {
        return true;
    }

    if (filterGroup.logic === 'and') {
        return filterGroup.conditions.every((condition) =>
            'logic' in condition
                ? matchesFilterGroup(row, condition)
                : matchesCondition(row, condition)
        );
    }

    return filterGroup.conditions.some((condition) =>
        'logic' in condition
            ? matchesFilterGroup(row, condition)
            : matchesCondition(row, condition)
    );
}

function compareValues(left, right, direction) {
    if (left === right) {
        return 0;
    }

    if (left == null) {
        return direction === 'asc' ? 1 : -1;
    }

    if (right == null) {
        return direction === 'asc' ? -1 : 1;
    }

    if (left > right) {
        return direction === 'asc' ? 1 : -1;
    }

    return direction === 'asc' ? -1 : 1;
}

function sortRows(rows, orderBy, valueResolver) {
    if (!orderBy || orderBy.length === 0) {
        return rows;
    }

    return [...rows].sort((leftRow, rightRow) => {
        for (const order of orderBy) {
            const comparison = compareValues(
                valueResolver(leftRow, order.column),
                valueResolver(rightRow, order.column),
                order.direction
            );

            if (comparison !== 0) {
                return comparison;
            }
        }

        return 0;
    });
}

function buildGroupKey(row, groupColumns) {
    return JSON.stringify(
        groupColumns.map((column) => getColumnValue(row, column))
    );
}

function aggregateRows(rows, request) {
    // Supabase execution currently fetches a safe subset of rows and performs
    // grouping/sorting in Node for the supported structured operations.
    if (request.operation === 'select') {
        const filteredRows = rows.filter((row) => matchesFilterGroup(row, request.filters));
        const sortedRows = sortRows(filteredRows, request.order_by, (row, column) =>
            getColumnValue(row, column)
        );
        const projectedRows = sortedRows.map((row) =>
            request.columns.reduce((accumulator, column) => {
                accumulator[column.outputLabel] = getColumnValue(row, column);
                return accumulator;
            }, {})
        );

        const uniqueRows = request.group_by.length > 0
            ? (() => {
                const seen = new Set();
                return projectedRows.filter((row) => {
                    const key = JSON.stringify(row);
                    if (seen.has(key)) {
                        return false;
                    }
                    seen.add(key);
                    return true;
                });
            })()
            : projectedRows;

        const limitedRows = uniqueRows.slice(0, request.limit || uniqueRows.length);

        return {
            rows: limitedRows,
            rowCount: uniqueRows.length,
        };
    }

    const filteredRows = rows.filter((row) => matchesFilterGroup(row, request.filters));

    if (request.group_by.length === 0 && request.operation === 'count') {
        return {
            value: filteredRows.length,
            rowCount: filteredRows.length,
        };
    }

    const metricColumn = request.columns[0];
    const groups = new Map();

    filteredRows.forEach((row) => {
        const key = request.group_by.length > 0
            ? buildGroupKey(row, request.group_by)
            : '__single__';

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(row);
    });

    const records = Array.from(groups.entries()).map(([key, groupRows]) => {
        const record = {};

        if (request.group_by.length > 0) {
            const groupValues = JSON.parse(key);
            request.group_by.forEach((groupColumn, index) => {
                record[groupColumn.outputLabel] = groupValues[index];
            });
        }

        if (request.operation === 'count') {
            record.value = groupRows.length;
            return record;
        }

        const numericValues = groupRows
            .map((row) => Number(getColumnValue(row, metricColumn)))
            .filter((value) => Number.isFinite(value));
        const total = numericValues.reduce((sum, value) => sum + value, 0);

        record.value = request.operation === 'sum'
            ? total
            : numericValues.length > 0
                ? total / numericValues.length
                : null;

        return record;
    });

    const sortedRecords = sortRows(records, request.order_by, (row, column) =>
        row[column.outputLabel]
    );
    const limitedRecords = sortedRecords.slice(0, request.limit || sortedRecords.length);

    return request.group_by.length > 0
        ? { rows: limitedRecords, rowCount: filteredRows.length }
        : { value: limitedRecords[0]?.value ?? null, rowCount: filteredRows.length };
}

export async function executeSupabaseQuery(supabase, plan) {
    const { request } = plan;

    if (request.joins.length > 0) {
        throw new Error('Joined structured queries are currently supported only for mysql-backed tables.');
    }

    // We only select columns that the request actually needs for projection,
    // filtering, grouping, or ordering.
    const selectColumns = new Map();

    request.columns.forEach((column) => {
        if (column.kind === 'column') {
            selectColumns.set(column.sourceColumn || column.column, column.sourceColumn || column.column);
        }
    });

    request.group_by.forEach((column) => {
        if (column.kind === 'column') {
            selectColumns.set(column.sourceColumn || column.column, column.sourceColumn || column.column);
        }
    });

    request.order_by.forEach((order) => {
        if (order.column.kind === 'column') {
            selectColumns.set(order.column.sourceColumn || order.column.column, order.column.sourceColumn || order.column.column);
        }
    });

    const addFilterColumns = (filterGroup) => {
        if (!filterGroup) {
            return;
        }

        filterGroup.conditions.forEach((condition) => {
            if ('logic' in condition) {
                addFilterColumns(condition);
                return;
            }

            if (condition.column.kind === 'column') {
                selectColumns.set(
                    condition.column.sourceColumn || condition.column.column,
                    condition.column.sourceColumn || condition.column.column
                );
            }
        });
    };

    addFilterColumns(request.filters);

    const selectClause = Array.from(selectColumns.values())
        .map((columnName) => `"${columnName.replace(/"/g, '""')}"`)
        .join(', ');

    const { data, error } = await supabase
        .from(request.source)
        .select(selectClause || '*');

    if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
    }

    return aggregateRows(data || [], request);
}

export function getRequestPreview(validatedRequest) {
    return {
        type: validatedRequest.type,
        table: normalizeRequestedName(validatedRequest.table),
        operation: validatedRequest.operation,
        analysis: validatedRequest.analysis,
        joins: validatedRequest.joins?.map((join) => ({
            from: join.fromTable,
            table: join.table,
            type: join.type,
        })),
        columns: validatedRequest.columns?.map((column) => column.outputLabel) || [],
        column: validatedRequest.column,
        second_column: validatedRequest.second_column,
        filters: validatedRequest.filters,
        group_by: Array.isArray(validatedRequest.group_by) 
            ? validatedRequest.group_by.map((column) => column.outputLabel) 
            : (validatedRequest.group_by ? [validatedRequest.group_by] : []),
        order_by: validatedRequest.order_by?.map((order) => ({
            column: order.column.outputLabel,
            direction: order.direction,
        })) || [],
        limit: validatedRequest.limit,
    };
}
