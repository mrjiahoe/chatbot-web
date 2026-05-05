import { NextResponse } from 'next/server';
import { fetchCurrentAccessProfile } from '@/lib/access';
import { canPreviewDataSources, normalizeRole } from '@/lib/roles';
import { buildSchemaRegistry, getTableConfig } from '@/lib/schemaRegistry';
import { getServerSupabaseClient } from '@/lib/serverSupabase';

const DEFAULT_PREVIEW_LIMIT = 25;
const MAX_PREVIEW_LIMIT = 100;
const HIDDEN_DATA_SOURCE_TABLES = new Set(['base_account']);

function isVisibleInDataSources(row) {
    if (row?.show_in_data_sources === null || row?.show_in_data_sources === undefined) {
        return !HIDDEN_DATA_SOURCE_TABLES.has(row?.table_name || '');
    }

    return Boolean(row.show_in_data_sources);
}

export async function GET(request) {
    try {
        const supabase = await getServerSupabaseClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const accessProfile = await fetchCurrentAccessProfile({
            supabase,
            authUser: user,
        });
        const currentRole = normalizeRole(accessProfile.effectiveRole);

        if (!canPreviewDataSources(currentRole)) {
            return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const tableName = searchParams.get('table')?.trim();
        const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), MAX_PREVIEW_LIMIT)
            : DEFAULT_PREVIEW_LIMIT;

        if (!tableName) {
            return NextResponse.json({ error: 'Table name is required.' }, { status: 400 });
        }

        if (HIDDEN_DATA_SOURCE_TABLES.has(tableName)) {
            return NextResponse.json({ error: 'Table not found in allowed schema.' }, { status: 404 });
        }

        let registryVisibilityRow = null;
        try {
            const { data, error } = await supabase
                .from('chatbot_schema_registry')
                .select('*')
                .eq('table_name', tableName)
                .eq('enabled', true)
                .limit(1)
                .maybeSingle();

            if (!error) {
                registryVisibilityRow = data || null;
            }
        } catch {
            registryVisibilityRow = null;
        }

        if (registryVisibilityRow && !isVisibleInDataSources(registryVisibilityRow)) {
            return NextResponse.json({ error: 'Table not found in allowed schema.' }, { status: 404 });
        }

        const registry = await buildSchemaRegistry({
            dataContext: '',
            supabase,
        });
        const tableConfig = getTableConfig(registry, tableName);

        if (!tableConfig || HIDDEN_DATA_SOURCE_TABLES.has(tableConfig.name)) {
            return NextResponse.json({ error: 'Table not found in allowed schema.' }, { status: 404 });
        }

        if (tableConfig.provider !== 'supabase') {
            return NextResponse.json(
                { error: `Preview is not supported for ${tableConfig.provider} tables yet.` },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from(tableConfig.source)
            .select('*')
            .limit(limit);

        if (error) {
            throw error;
        }

        const rows = Array.isArray(data) ? data : [];
        const columns = tableConfig.columns.map((column) => column.name);

        return NextResponse.json({
            table: tableConfig.displayName || tableName,
            source: tableConfig.source,
            columns,
            rows,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to load table preview.',
            },
            { status: 500 }
        );
    }
}
