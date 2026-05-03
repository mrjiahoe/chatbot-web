import { NextResponse } from 'next/server';
import { buildSchemaRegistry } from '@/lib/schemaRegistry';
import { getServerSupabaseClient } from '@/lib/serverSupabase';

const HIDDEN_DATA_SOURCE_TABLES = new Set(['base_account']);

export async function GET() {
    try {
        const supabase = await getServerSupabaseClient();
        const { data: registryRows, error: registryError } = await supabase
            .from('chatbot_schema_registry')
            .select('table_name, provider, source, column_name, column_type, enabled')
            .eq('enabled', true)
            .order('table_name', { ascending: true })
            .order('column_name', { ascending: true });

        if (!registryError && registryRows?.length) {
            const groupedTables = new Map();

            registryRows.forEach((row) => {
                if (!groupedTables.has(row.table_name)) {
                    groupedTables.set(row.table_name, {
                        name: row.table_name,
                        provider: row.provider || 'supabase',
                        source: row.source || row.table_name,
                        columns: [],
                    });
                }

                groupedTables.get(row.table_name).columns.push({
                    name: row.column_name,
                    type: row.column_type || 'unknown',
                });
            });

            const tables = Array.from(groupedTables.values())
                .filter((table) => !HIDDEN_DATA_SOURCE_TABLES.has(table.name))
                .sort((left, right) => left.name.localeCompare(right.name));

            return NextResponse.json({ tables });
        }

        const registry = await buildSchemaRegistry({
            dataContext: '',
            supabase,
        });

        const tables = Array.from(registry.values())
            .map((table) => ({
                name: table.displayName || table.name,
                provider: table.provider,
                source: table.source,
                columns: table.columns.map((column) => ({
                    name: column.name,
                    type: column.type,
                })),
            }))
            .filter((table) => !HIDDEN_DATA_SOURCE_TABLES.has(table.name))
            .sort((left, right) => left.name.localeCompare(right.name));

        return NextResponse.json({ tables });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unable to load schema tables.',
            },
            { status: 500 }
        );
    }
}
