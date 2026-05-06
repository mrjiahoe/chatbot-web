import { NextResponse } from 'next/server';
import { clearSchemaCache } from '@/lib/schemaRegistry';
import { resolveTablePlanningMetadata } from '@/lib/schemaRegistry';
import { fetchCurrentAccessProfile } from '@/lib/access';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSupabaseEnv } from '@/lib/supabase-env';
import { getServerSupabaseClient } from '@/lib/serverSupabase';
import { canAccessSchemaRegistry, normalizeRole } from '@/lib/roles';

function trimOrNull(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

function trimOrEmpty(value) {
    return String(value || '').trim();
}

function isMissingVisibilityColumnError(error) {
    const message = String(error?.message || '').toLowerCase();

    return (
        error?.code === '42703' ||
        message.includes('show_in_data_sources')
    );
}

function isMissingPlannerMetadataColumnError(error) {
    const message = String(error?.message || '').toLowerCase();

    return (
        error?.code === '42703' ||
        message.includes('allow_in_planner') ||
        message.includes('table_kind')
    );
}

const HIDDEN_DISCOVERY_TABLES = new Set([
    'chatbot_schema_registry',
    'chatbot_schema_joins',
]);

const HIDDEN_DATA_SOURCE_TABLES = new Set([
    'base_account',
]);

function toRegistryColumnType(property = {}) {
    const format = String(property?.format || '').toLowerCase();
    const type = String(property?.type || '').toLowerCase();

    if (format === 'date' || format.includes('timestamp')) {
        return 'date';
    }

    if (type === 'boolean') {
        return 'boolean';
    }

    if (['integer', 'number'].includes(type)) {
        return 'number';
    }

    if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'decimal', 'double precision'].includes(format)) {
        return 'number';
    }

    if (type === 'string') {
        return 'string';
    }

    return 'unknown';
}

function extractForeignKey(description) {
    const match = String(description || '').match(/<fk table='([^']+)' column='([^']+)'\/>/i);

    if (!match) {
        return null;
    }

    return {
        targetTable: match[1],
        targetColumn: match[2],
    };
}

async function fetchSupabaseOpenApiDocument() {
    const { supabaseUrl } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Automatic discovery requires the service role key.');
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept: 'application/openapi+json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Supabase OpenAPI discovery failed with ${response.status}.`);
    }

    return response.json();
}

function parseDiscoveredSchema(openApiDocument) {
    const definitions = openApiDocument?.definitions || {};
    const discoveredTables = [];
    const joins = new Map();

    Object.entries(definitions).forEach(([tableName, definition]) => {
        if (HIDDEN_DISCOVERY_TABLES.has(tableName)) {
            return;
        }

        const properties = definition?.properties || {};
        const columns = Object.entries(properties).map(([columnName, property]) => {
            const foreignKey = extractForeignKey(property?.description);

            if (foreignKey) {
                const joinKey = `${tableName}:${foreignKey.targetTable}:${columnName}:${foreignKey.targetColumn}`;
                joins.set(joinKey, {
                    sourceTable: tableName,
                    targetTable: foreignKey.targetTable,
                    sourceColumn: columnName,
                    targetColumn: foreignKey.targetColumn,
                    joinType: 'left',
                    enabled: true,
                });
            }

            return {
                name: columnName,
                type: toRegistryColumnType(property),
                enabled: true,
                isScopeKey: ['school_id', 'school_name_id', 'cluster_id'].includes(columnName),
            };
        });

        if (!columns.length) {
            return;
        }

        discoveredTables.push({
            name: tableName,
            provider: 'supabase',
            source: tableName,
            columns: columns.sort((left, right) => left.name.localeCompare(right.name)),
        });
    });

    return {
        tables: discoveredTables.sort((left, right) => left.name.localeCompare(right.name)),
        joins: Array.from(joins.values()).sort((left, right) => {
            const leftKey = `${left.sourceTable}:${left.targetTable}:${left.sourceColumn}:${left.targetColumn}`;
            const rightKey = `${right.sourceTable}:${right.targetTable}:${right.sourceColumn}:${right.targetColumn}`;
            return leftKey.localeCompare(rightKey);
        }),
    };
}

async function requireSchemaRegistryAccess() {
    const supabase = await getServerSupabaseClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }),
        };
    }

    const accessProfile = await fetchCurrentAccessProfile({
        supabase,
        authUser: user,
    });
    const actorRole = normalizeRole(accessProfile.effectiveRole);

    if (!canAccessSchemaRegistry(actorRole)) {
        return {
            error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }),
        };
    }

    return {
        admin: getSupabaseAdminClient(),
    };
}

function groupRegistryRows(rows = []) {
    const grouped = new Map();

    rows.forEach((row) => {
        if (!grouped.has(row.table_name)) {
            grouped.set(row.table_name, {
                name: row.table_name,
                provider: row.provider || 'supabase',
                source: row.source || row.table_name,
                totalColumns: 0,
                enabledColumns: 0,
                isEnabled: false,
                columns: [],
                rawShowInDataSources: row.show_in_data_sources,
                rawAllowInPlanner: row.allow_in_planner,
                rawTableKind: row.table_kind,
            });
        }

        const table = grouped.get(row.table_name);
        table.totalColumns += 1;
        table.enabledColumns += row.enabled ? 1 : 0;
        table.columns.push({
            id: row.id,
            name: row.column_name,
            type: row.column_type || 'unknown',
            enabled: Boolean(row.enabled),
        });
        table.isEnabled = table.enabledColumns > 0;
    });

    return Array.from(grouped.values())
        .map((table) => ({
            ...table,
            ...resolveTablePlanningMetadata({
                tableName: table.name,
                source: table.source,
                columns: table.columns,
                tableKind: table.rawTableKind,
                plannerEnabled: table.rawAllowInPlanner,
            }),
            showInDataSources:
                table.rawShowInDataSources === null || table.rawShowInDataSources === undefined
                    ? !HIDDEN_DATA_SOURCE_TABLES.has(table.name)
                    : Boolean(table.rawShowInDataSources),
            columns: [...table.columns].sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadRegistry(admin) {
    const [registryResponse, joinsResponse] = await Promise.all([
        admin
            .from('chatbot_schema_registry')
            .select('*')
            .order('table_name', { ascending: true })
            .order('column_name', { ascending: true }),
        admin
            .from('chatbot_schema_joins')
            .select('id, source_table, target_table, source_column, target_column, join_type, enabled')
            .order('source_table', { ascending: true })
            .order('target_table', { ascending: true })
            .order('source_column', { ascending: true })
            .order('target_column', { ascending: true }),
    ]);

    if (registryResponse.error) {
        throw registryResponse.error;
    }

    if (joinsResponse.error) {
        throw joinsResponse.error;
    }

    return {
        tables: groupRegistryRows(registryResponse.data || []),
        joins: (joinsResponse.data || []).map((join) => ({
            id: join.id,
            sourceTable: join.source_table,
            targetTable: join.target_table,
            sourceColumn: join.source_column,
            targetColumn: join.target_column,
            joinType: join.join_type || 'inner',
            enabled: Boolean(join.enabled),
        })),
    };
}

export async function GET(request) {
    try {
        const access = await requireSchemaRegistryAccess();

        if (access.error) {
            return access.error;
        }

        const url = new URL(request.url);
        const mode = trimOrEmpty(url.searchParams.get('mode'));

        if (mode === 'discover') {
            const [discovered, currentRegistry] = await Promise.all([
                fetchSupabaseOpenApiDocument().then(parseDiscoveredSchema),
                loadRegistry(access.admin),
            ]);
            const importedTableNames = new Set(currentRegistry.tables.map((table) => table.name));

            return NextResponse.json({
                tables: discovered.tables.map((table) => ({
                    ...table,
                    alreadyImported: importedTableNames.has(table.name),
                })),
                joins: discovered.joins,
            });
        }

        const payload = await loadRegistry(access.admin);
        return NextResponse.json(payload);
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : 'Unable to load schema registry.',
            },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const access = await requireSchemaRegistryAccess();

        if (access.error) {
            return access.error;
        }

        const admin = access.admin;
        const body = await request.json();
        const entryType = trimOrEmpty(body?.entryType);

        if (entryType === 'import_discovery') {
            const selectedTableNames = Array.isArray(body?.tableNames)
                ? body.tableNames.map((value) => trimOrEmpty(value)).filter(Boolean)
                : [];

            if (!selectedTableNames.length) {
                return NextResponse.json(
                    { error: 'Select at least one discovered table to import.' },
                    { status: 400 }
                );
            }

            const discovered = parseDiscoveredSchema(await fetchSupabaseOpenApiDocument());
            const selectedTableSet = new Set(selectedTableNames);
            const selectedTables = discovered.tables.filter((table) => selectedTableSet.has(table.name));

            if (!selectedTables.length) {
                return NextResponse.json(
                    { error: 'Selected tables were not found in the discovery results.' },
                    { status: 400 }
                );
            }

            const registryRows = selectedTables.flatMap((table) =>
                table.columns.map((column) => {
                    const planningMetadata = resolveTablePlanningMetadata({
                        tableName: table.name,
                        source: table.source,
                        columns: table.columns,
                    });

                    return {
                        table_name: table.name,
                        provider: table.provider,
                        source: table.source,
                        column_name: column.name,
                        column_type: column.type,
                        enabled: true,
                        show_in_data_sources: true,
                        allow_in_planner: planningMetadata.plannerEnabled,
                        table_kind: planningMetadata.tableKind,
                    };
                })
            );

            const joinRows = discovered.joins
                .filter((join) => selectedTableSet.has(join.sourceTable) && selectedTableSet.has(join.targetTable))
                .map((join) => ({
                    source_table: join.sourceTable,
                    target_table: join.targetTable,
                    source_column: join.sourceColumn,
                    target_column: join.targetColumn,
                    join_type: join.joinType,
                    enabled: true,
                }));

            const registryUpsert = await admin
                .from('chatbot_schema_registry')
                .upsert(registryRows, { onConflict: 'table_name,column_name' });

            if (registryUpsert.error) {
                if (isMissingVisibilityColumnError(registryUpsert.error)) {
                    const fallbackUpsert = await admin
                        .from('chatbot_schema_registry')
                        .upsert(
                            registryRows.map((row) => {
                                const nextRow = { ...row };
                                delete nextRow.show_in_data_sources;
                                delete nextRow.allow_in_planner;
                                delete nextRow.table_kind;
                                return nextRow;
                            }),
                            { onConflict: 'table_name,column_name' }
                        );

                    if (fallbackUpsert.error) {
                        throw fallbackUpsert.error;
                    }
                } else if (isMissingPlannerMetadataColumnError(registryUpsert.error)) {
                    const fallbackUpsert = await admin
                        .from('chatbot_schema_registry')
                        .upsert(
                            registryRows.map((row) => {
                                const nextRow = { ...row };
                                delete nextRow.allow_in_planner;
                                delete nextRow.table_kind;
                                return nextRow;
                            }),
                            { onConflict: 'table_name,column_name' }
                        );

                    if (fallbackUpsert.error) {
                        throw fallbackUpsert.error;
                    }
                } else {
                    throw registryUpsert.error;
                }
            }

            if (joinRows.length) {
                const joinsUpsert = await admin
                    .from('chatbot_schema_joins')
                    .upsert(joinRows, { onConflict: 'source_table,target_table,source_column,target_column' });

                if (joinsUpsert.error) {
                    throw joinsUpsert.error;
                }
            }
        } else if (entryType === 'column') {
            const tableName = trimOrEmpty(body?.tableName);
            const columnName = trimOrEmpty(body?.columnName);
            const provider = trimOrNull(body?.provider) || 'supabase';
            const source = trimOrNull(body?.source) || tableName;
            const columnType = trimOrNull(body?.columnType) || 'unknown';
            const enabled = body?.enabled !== false;

            if (!tableName || !columnName) {
                return NextResponse.json(
                    { error: 'Table name and column name are required.' },
                    { status: 400 }
                );
            }

            const { error } = await admin
                .from('chatbot_schema_registry')
                .upsert(
                    (() => {
                        const planningMetadata = resolveTablePlanningMetadata({
                            tableName,
                            source,
                            columns: [{ name: columnName }],
                        });

                        return {
                        table_name: tableName,
                        provider,
                        source,
                        column_name: columnName,
                        column_type: columnType,
                        enabled,
                        show_in_data_sources:
                            Object.prototype.hasOwnProperty.call(body || {}, 'showInDataSources')
                                ? Boolean(body?.showInDataSources)
                                : true,
                            allow_in_planner:
                                Object.prototype.hasOwnProperty.call(body || {}, 'allowInPlanner')
                                    ? Boolean(body?.allowInPlanner)
                                    : planningMetadata.plannerEnabled,
                            table_kind:
                                trimOrNull(body?.tableKind) || planningMetadata.tableKind,
                        };
                    })(),
                    { onConflict: 'table_name,column_name' }
                );

            if (error) {
                if (isMissingVisibilityColumnError(error) || isMissingPlannerMetadataColumnError(error)) {
                    const fallback = await admin
                        .from('chatbot_schema_registry')
                        .upsert(
                            {
                                table_name: tableName,
                                provider,
                                source,
                                column_name: columnName,
                                column_type: columnType,
                                enabled,
                            },
                            { onConflict: 'table_name,column_name' }
                        );

                    if (fallback.error) {
                        throw fallback.error;
                    }
                } else {
                    throw error;
                }
            }
        } else if (entryType === 'join') {
            const sourceTable = trimOrEmpty(body?.sourceTable);
            const targetTable = trimOrEmpty(body?.targetTable);
            const sourceColumn = trimOrEmpty(body?.sourceColumn);
            const targetColumn = trimOrEmpty(body?.targetColumn);
            const joinType = trimOrNull(body?.joinType) || 'inner';
            const enabled = body?.enabled !== false;

            if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
                return NextResponse.json(
                    { error: 'Source and target join fields are required.' },
                    { status: 400 }
                );
            }

            const { error } = await admin
                .from('chatbot_schema_joins')
                .upsert(
                    {
                        source_table: sourceTable,
                        target_table: targetTable,
                        source_column: sourceColumn,
                        target_column: targetColumn,
                        join_type: joinType,
                        enabled,
                    },
                    { onConflict: 'source_table,target_table,source_column,target_column' }
                );

            if (error) {
                throw error;
            }
        } else {
            return NextResponse.json(
                { error: 'Unsupported schema registry entry type.' },
                { status: 400 }
            );
        }

        clearSchemaCache();

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : 'Unable to create schema registry entry.',
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request) {
    try {
        const access = await requireSchemaRegistryAccess();

        if (access.error) {
            return access.error;
        }

        const admin = access.admin;
        const body = await request.json();
        const entryType = trimOrEmpty(body?.entryType);

        if (entryType === 'table') {
            const tableName = trimOrEmpty(body?.tableName);
            const updates = {};

            if (!tableName) {
                return NextResponse.json({ error: 'Table name is required.' }, { status: 400 });
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'provider')) {
                updates.provider = trimOrNull(body?.provider) || 'supabase';
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'source')) {
                updates.source = trimOrNull(body?.source) || tableName;
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'enabled')) {
                updates.enabled = Boolean(body?.enabled);
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'showInDataSources')) {
                updates.show_in_data_sources = Boolean(body?.showInDataSources);
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'allowInPlanner')) {
                updates.allow_in_planner = Boolean(body?.allowInPlanner);
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'tableKind')) {
                updates.table_kind = trimOrNull(body?.tableKind) || 'entity';
            }

            if (Object.keys(updates).length === 0) {
                return NextResponse.json(
                    { error: 'At least one table update is required.' },
                    { status: 400 }
                );
            }

            const { error } = await admin
                .from('chatbot_schema_registry')
                .update(updates)
                .eq('table_name', tableName);

            if (error) {
                if (isMissingVisibilityColumnError(error) && Object.prototype.hasOwnProperty.call(updates, 'show_in_data_sources')) {
                    return NextResponse.json(
                        {
                            error: 'This workspace schema registry does not have the `show_in_data_sources` column yet. Run the new SQL migration artifact first.',
                        },
                        { status: 400 }
                    );
                }

                if (
                    isMissingPlannerMetadataColumnError(error) &&
                    (
                        Object.prototype.hasOwnProperty.call(updates, 'allow_in_planner') ||
                        Object.prototype.hasOwnProperty.call(updates, 'table_kind')
                    )
                ) {
                    return NextResponse.json(
                        {
                            error: 'This workspace schema registry does not have the planner metadata columns yet. Run the new SQL migration artifact first.',
                        },
                        { status: 400 }
                    );
                }

                throw error;
            }
        } else if (entryType === 'column') {
            const id = Number(body?.id);
            const updates = {};

            if (!Number.isFinite(id)) {
                return NextResponse.json({ error: 'Column id is required.' }, { status: 400 });
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'columnType')) {
                updates.column_type = trimOrNull(body?.columnType) || 'unknown';
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'enabled')) {
                updates.enabled = Boolean(body?.enabled);
            }

            if (Object.keys(updates).length === 0) {
                return NextResponse.json(
                    { error: 'At least one column update is required.' },
                    { status: 400 }
                );
            }

            const { error } = await admin
                .from('chatbot_schema_registry')
                .update(updates)
                .eq('id', id);

            if (error) {
                throw error;
            }
        } else if (entryType === 'join') {
            const id = Number(body?.id);
            const updates = {};

            if (!Number.isFinite(id)) {
                return NextResponse.json({ error: 'Join id is required.' }, { status: 400 });
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'joinType')) {
                updates.join_type = trimOrNull(body?.joinType) || 'inner';
            }

            if (Object.prototype.hasOwnProperty.call(body || {}, 'enabled')) {
                updates.enabled = Boolean(body?.enabled);
            }

            if (Object.keys(updates).length === 0) {
                return NextResponse.json(
                    { error: 'At least one join update is required.' },
                    { status: 400 }
                );
            }

            const { error } = await admin
                .from('chatbot_schema_joins')
                .update(updates)
                .eq('id', id);

            if (error) {
                throw error;
            }
        } else {
            return NextResponse.json(
                { error: 'Unsupported schema registry entry type.' },
                { status: 400 }
            );
        }

        clearSchemaCache();

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : 'Unable to update schema registry entry.',
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request) {
    try {
        const access = await requireSchemaRegistryAccess();

        if (access.error) {
            return access.error;
        }

        const admin = access.admin;
        const body = await request.json();
        const entryType = trimOrEmpty(body?.entryType);

        if (entryType === 'table') {
            const tableName = trimOrEmpty(body?.tableName);

            if (!tableName) {
                return NextResponse.json({ error: 'Table name is required.' }, { status: 400 });
            }

            const [{ error: registryError }, { error: joinsAsSourceError }, { error: joinsAsTargetError }] = await Promise.all([
                admin.from('chatbot_schema_registry').delete().eq('table_name', tableName),
                admin.from('chatbot_schema_joins').delete().eq('source_table', tableName),
                admin.from('chatbot_schema_joins').delete().eq('target_table', tableName),
            ]);

            if (registryError) {
                throw registryError;
            }

            if (joinsAsSourceError) {
                throw joinsAsSourceError;
            }

            if (joinsAsTargetError) {
                throw joinsAsTargetError;
            }
        } else if (entryType === 'column') {
            const id = Number(body?.id);

            if (!Number.isFinite(id)) {
                return NextResponse.json({ error: 'Column id is required.' }, { status: 400 });
            }

            const { data: existingColumn, error: existingColumnError } = await admin
                .from('chatbot_schema_registry')
                .select('id, table_name')
                .eq('id', id)
                .maybeSingle();

            if (existingColumnError) {
                throw existingColumnError;
            }

            if (!existingColumn) {
                return NextResponse.json({ error: 'Column entry not found.' }, { status: 404 });
            }

            const { error } = await admin
                .from('chatbot_schema_registry')
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }

            const { count, error: countError } = await admin
                .from('chatbot_schema_registry')
                .select('id', { count: 'exact', head: true })
                .eq('table_name', existingColumn.table_name);

            if (countError) {
                throw countError;
            }

            if ((count || 0) === 0) {
                const [{ error: sourceJoinError }, { error: targetJoinError }] = await Promise.all([
                    admin.from('chatbot_schema_joins').delete().eq('source_table', existingColumn.table_name),
                    admin.from('chatbot_schema_joins').delete().eq('target_table', existingColumn.table_name),
                ]);

                if (sourceJoinError) {
                    throw sourceJoinError;
                }

                if (targetJoinError) {
                    throw targetJoinError;
                }
            }
        } else if (entryType === 'join') {
            const id = Number(body?.id);

            if (!Number.isFinite(id)) {
                return NextResponse.json({ error: 'Join id is required.' }, { status: 400 });
            }

            const { error } = await admin
                .from('chatbot_schema_joins')
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }
        } else {
            return NextResponse.json(
                { error: 'Unsupported schema registry entry type.' },
                { status: 400 }
            );
        }

        clearSchemaCache();

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : 'Unable to delete schema registry entry.',
            },
            { status: 500 }
        );
    }
}
