import { NextResponse } from 'next/server';
import { clearSchemaCache } from '@/lib/schemaRegistry';
import { fetchCurrentAccessProfile } from '@/lib/access';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { getServerSupabaseClient } from '@/lib/serverSupabase';
import { canAccessRoleDashboard, normalizeRole } from '@/lib/roles';

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

    if (!canAccessRoleDashboard(actorRole)) {
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
            columns: [...table.columns].sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadRegistry(admin) {
    const [registryResponse, joinsResponse] = await Promise.all([
        admin
            .from('chatbot_schema_registry')
            .select('id, table_name, provider, source, column_name, column_type, enabled')
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

export async function GET() {
    try {
        const access = await requireSchemaRegistryAccess();

        if (access.error) {
            return access.error;
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

        if (entryType === 'column') {
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

            if (error) {
                throw error;
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
