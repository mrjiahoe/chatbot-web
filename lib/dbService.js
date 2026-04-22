import { executeSupabaseQuery } from './queryBuilder.js';

async function importMysqlDriver() {
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    return dynamicImport('mysql2/promise');
}

async function executeMysqlQuery(plan) {
    let mysql;

    try {
        mysql = await importMysqlDriver();
    } catch (error) {
        throw new Error(
            'Azure MySQL support requires the "mysql2" package. Install it before using a mysql-backed schema.'
        );
    }

    const connection = await mysql.createConnection({
        host: process.env.AZURE_MYSQL_HOST,
        port: Number(process.env.AZURE_MYSQL_PORT || 3306),
        user: process.env.AZURE_MYSQL_USER,
        password: process.env.AZURE_MYSQL_PASSWORD,
        database: process.env.AZURE_MYSQL_DATABASE,
        // Azure MySQL commonly requires SSL in hosted setups, so we default to
        // a permissive SSL config unless explicitly disabled.
        ssl: process.env.AZURE_MYSQL_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    });

    try {
        const [rows] = await connection.execute(plan.sql, plan.values);
        const normalizedRows = Array.isArray(rows) ? rows : [];
        // MySQL returns SQL aliases; we remap them back to the planner-facing
        // labels so both providers produce a consistent API response shape.
        const aliasMap = new Map((plan.outputMap || []).map((entry) => [entry.alias, entry.label]));
        const relabelRows = normalizedRows.map((row) =>
            Object.entries(row).reduce((accumulator, [key, value]) => {
                accumulator[aliasMap.get(key) || key] = value;
                return accumulator;
            }, {})
        );

        if (plan.request.operation === 'select') {
            return {
                rows: relabelRows,
                rowCount: relabelRows.length,
            };
        }

        if (plan.request.group_by?.length > 0) {
            return {
                rows: relabelRows,
                rowCount: relabelRows.length,
            };
        }

        return {
            value: normalizedRows[0]?.value ?? null,
            rowCount: normalizedRows.length,
        };
    } finally {
        await connection.end();
    }
}

export async function executeQueryPlan({ plan, supabase }) {
    // Provider selection happens here so the controller can stay provider-agnostic.
    if (plan.provider === 'supabase') {
        return executeSupabaseQuery(supabase, plan);
    }

    return executeMysqlQuery(plan);
}
