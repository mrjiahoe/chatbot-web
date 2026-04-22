import { z } from 'zod';

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const schemaCache = new Map();

function getCacheKey(dataContext) {
    // Simple cache key based on dataContext; if null/empty, use a default key
    return dataContext ? `schema_${Buffer.from(dataContext).toString('base64').slice(0, 50)}` : 'schema_default';
}

function getCachedRegistry(dataContext) {
    const key = getCacheKey(dataContext);
    const cached = schemaCache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.registry;
    }

    // Expired or not found; remove from cache
    if (cached) {
        schemaCache.delete(key);
    }

    return null;
}

function setCachedRegistry(dataContext, registry) {
    const key = getCacheKey(dataContext);
    schemaCache.set(key, {
        registry,
        timestamp: Date.now(),
    });
}

export function clearSchemaCache() {
    schemaCache.clear();
}

const columnConfigSchema = z.union([
    z.string(),
    z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'date', 'unknown']).optional(),
    }),
]);

const joinConfigSchema = z.object({
    table: z.string(),
    source_column: z.string(),
    target_column: z.string(),
    type: z.enum(['inner', 'left']).optional(),
});

const tableConfigSchema = z.object({
    name: z.string(),
    provider: z.enum(['supabase', 'mysql']).optional(),
    source: z.string().optional(),
    columns: z.array(columnConfigSchema).min(1),
    joins: z.array(joinConfigSchema).optional(),
});

const schemaConfigSchema = z.array(tableConfigSchema);

// We normalize names early so matching is case-insensitive and the planner,
// validator, and execution layers all speak the same identifier format.
function normalizeIdentifier(value) {
    return value
        .trim()
        .replace(/\.[^.]+$/, '')
        .replace(/[^A-Za-z0-9_]+/g, '_')
        .replace(/^_+/, '')
        .replace(/_+/g, '_')
        .toLowerCase();
}

function normalizeColumn(column) {
    if (typeof column === 'string') {
        return {
            name: column,
            normalizedName: normalizeIdentifier(column),
            type: 'unknown',
        };
    }

    return {
        name: column.name,
        normalizedName: normalizeIdentifier(column.name),
        type: column.type || 'unknown',
    };
}

function buildTableEntry(table) {
    const normalizedName = normalizeIdentifier(table.name);
    const columns = table.columns
        .map(normalizeColumn)
        .filter((column) => IDENTIFIER_REGEX.test(column.normalizedName));
    const joins = (table.joins || [])
        .map((join) => ({
            table: normalizeIdentifier(join.table),
            sourceColumn: normalizeIdentifier(join.source_column),
            targetColumn: normalizeIdentifier(join.target_column),
            type: join.type || 'inner',
        }))
        .filter((join) =>
            IDENTIFIER_REGEX.test(join.table) &&
            IDENTIFIER_REGEX.test(join.sourceColumn) &&
            IDENTIFIER_REGEX.test(join.targetColumn)
        );

    if (!IDENTIFIER_REGEX.test(normalizedName) || columns.length === 0) {
        return null;
    }

    return {
        name: normalizedName,
        displayName: table.name,
        provider: table.provider || 'supabase',
        source: table.source || normalizedName,
        columns,
        joins,
    };
}

function mergeColumns(existingColumns, incomingColumns) {
    const merged = new Map(
        existingColumns.map((column) => [column.normalizedName, column])
    );

    incomingColumns.forEach((column) => {
        if (!merged.has(column.normalizedName)) {
            merged.set(column.normalizedName, column);
        }
    });

    return Array.from(merged.values());
}

function addTableToRegistry(registry, table) {
    const existing = registry.get(table.name);

    if (!existing) {
        registry.set(table.name, table);
        return;
    }

    registry.set(table.name, {
        ...existing,
        provider: existing.provider || table.provider,
        source: existing.source || table.source,
        columns: mergeColumns(existing.columns, table.columns),
        joins: mergeJoins(existing.joins || [], table.joins || []),
    });
}

function mergeJoins(existingJoins, incomingJoins) {
    const merged = new Map(
        existingJoins.map((join) => [
            `${join.table}:${join.sourceColumn}:${join.targetColumn}:${join.type}`,
            join,
        ])
    );

    incomingJoins.forEach((join) => {
        const key = `${join.table}:${join.sourceColumn}:${join.targetColumn}:${join.type}`;

        if (!merged.has(key)) {
            merged.set(key, join);
        }
    });

    return Array.from(merged.values());
}

function parseSchemaFromEnv() {
    const rawSchema = process.env.CHATBOT_ALLOWED_SCHEMA;

    if (!rawSchema) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawSchema);
        return schemaConfigSchema.parse(parsed)
            .map(buildTableEntry)
            .filter(Boolean);
    } catch (error) {
        console.error('Failed to parse CHATBOT_ALLOWED_SCHEMA:', error);
        return [];
    }
}

async function parseSchemaFromSupabase(supabase) {
    if (!supabase) {
        return [];
    }

    try {
        // `chatbot_schema_registry` is the preferred source because it can be
        // managed centrally and protected with RLS.
        const { data, error } = await supabase
            .from('chatbot_schema_registry')
            .select('table_name, provider, source, column_name, column_type, enabled')
            .eq('enabled', true)
            .order('table_name', { ascending: true })
            .order('column_name', { ascending: true });

        if (error) {
            console.warn('Falling back from Supabase schema registry:', error.message);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        let joinRows = [];
        try {
            // Join metadata is optional. If the table is missing we simply
            // continue without join support rather than failing the whole chat.
            const { data: joinsData, error: joinsError } = await supabase
                .from('chatbot_schema_joins')
                .select('source_table, target_table, source_column, target_column, join_type, enabled')
                .eq('enabled', true);

            if (!joinsError) {
                joinRows = joinsData || [];
            }
        } catch {
            joinRows = [];
        }

        const groupedTables = new Map();

        data.forEach((row) => {
            const key = normalizeIdentifier(row.table_name);

            if (!groupedTables.has(key)) {
                groupedTables.set(key, {
                    name: row.table_name,
                    provider: row.provider,
                    source: row.source,
                    columns: [],
                });
            }

            groupedTables.get(key).columns.push({
                name: row.column_name,
                type: row.column_type || 'unknown',
            });
        });

        joinRows.forEach((row) => {
            const key = normalizeIdentifier(row.source_table);

            if (!groupedTables.has(key)) {
                return;
            }

            const table = groupedTables.get(key);
            table.joins = table.joins || [];
            table.joins.push({
                table: row.target_table,
                source_column: row.source_column,
                target_column: row.target_column,
                type: row.join_type || 'inner',
            });
        });

        return Array.from(groupedTables.values())
            .map(buildTableEntry)
            .filter(Boolean);
    } catch (error) {
        console.warn('Falling back from Supabase schema registry:', error);
        return [];
    }
}

function parseSchemaFromContext(dataContext) {
    if (!dataContext || typeof dataContext !== 'string') {
        return [];
    }

    // File-based context is a temporary schema source created from uploaded
    // files selected in the UI. It is intentionally looser than the registry.
    const matches = [...dataContext.matchAll(/- Table:\s*(.+?)\n\s*Columns:\s*(.+?)(?=\n- Table:|$)/gms)];

    return matches
        .map((match) => {
            const [, tableName, columnLine] = match;
            const columns = columnLine
                .split(',')
                .map((column) => column.trim())
                .filter(Boolean);

            if (columns.length === 0) {
                return null;
            }

            return buildTableEntry({
                name: tableName,
                columns,
                provider: process.env.CHATBOT_DEFAULT_DB_PROVIDER === 'mysql' ? 'mysql' : 'supabase',
            });
        })
        .filter(Boolean);
}

export async function buildSchemaRegistry({ dataContext, supabase }) {
    // Check cache first
    const cached = getCachedRegistry(dataContext);
    if (cached) {
        return cached;
    }

    const registry = new Map();

    // Precedence is: Supabase registry -> .env fallback -> selected file
    // context. Later sources can fill gaps, but approved registry data wins.
    const databaseSchema = await parseSchemaFromSupabase(supabase);
    const envSchema = parseSchemaFromEnv();
    const contextSchema = parseSchemaFromContext(dataContext);

    [...databaseSchema, ...envSchema, ...contextSchema].forEach((table) => {
        addTableToRegistry(registry, table);
    });

    // Cache the built registry
    setCachedRegistry(dataContext, registry);

    return registry;
}

export function getSchemaPrompt(registry) {
    return JSON.stringify(
        Array.from(registry.values()).map((table) => ({
            table: table.name,
            display_name: table.displayName,
            provider: table.provider,
            joins: table.joins.map((join) => ({
                table: join.table,
                source_column: join.sourceColumn,
                target_column: join.targetColumn,
                type: join.type,
            })),
            columns: table.columns.map((column) => ({
                name: column.normalizedName,
                original_name: column.name,
                type: column.type,
            })),
        })),
        null,
        2
    );
}

export function getTableConfig(registry, tableName) {
    return registry.get(normalizeIdentifier(tableName));
}

export function getColumnConfig(tableConfig, columnName) {
    return tableConfig.columns.find(
        (column) => column.normalizedName === normalizeIdentifier(columnName)
    );
}

export function getJoinConfig(tableConfig, targetTableName) {
    return (tableConfig.joins || []).find(
        (join) => join.table === normalizeIdentifier(targetTableName)
    );
}

export function normalizeRequestedName(value) {
    return normalizeIdentifier(value);
}
