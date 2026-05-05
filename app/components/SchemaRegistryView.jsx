'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Database,
    Link2,
    Loader2,
    Plus,
    RefreshCcw,
    Save,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { canAccessSchemaRegistry } from '@/lib/roles';

const COLUMN_TYPE_OPTIONS = ['string', 'number', 'boolean', 'date', 'unknown'];
const PROVIDER_OPTIONS = ['supabase', 'mysql'];
const JOIN_TYPE_OPTIONS = ['inner', 'left'];

function isPotentialScopeColumn(columnName) {
    return ['school_id', 'school_name_id', 'cluster_id'].includes(String(columnName || '').toLowerCase());
}

function createEmptyColumnDraft() {
    return {
        columnName: '',
        columnType: 'string',
        enabled: true,
    };
}

const SchemaRegistryView = ({ currentRole }) => {
    const hasAccess = canAccessSchemaRegistry(currentRole);
    const [tables, setTables] = useState([]);
    const [joins, setJoins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [savingKey, setSavingKey] = useState('');
    const [error, setError] = useState('');
    const [banner, setBanner] = useState({ type: '', text: '' });
    const [discoveredTables, setDiscoveredTables] = useState([]);
    const [discoveredJoins, setDiscoveredJoins] = useState([]);
    const [selectedDiscoveryTables, setSelectedDiscoveryTables] = useState({});
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [newTableDraft, setNewTableDraft] = useState({
        tableName: '',
        provider: 'supabase',
        source: '',
        columnName: '',
        columnType: 'string',
        enabled: true,
    });
    const [tableDrafts, setTableDrafts] = useState({});
    const [newColumnDrafts, setNewColumnDrafts] = useState({});
    const [newJoinDraft, setNewJoinDraft] = useState({
        sourceTable: '',
        targetTable: '',
        sourceColumn: '',
        targetColumn: '',
        joinType: 'left',
        enabled: true,
    });

    const loadRegistry = useCallback(async ({ silent = false } = {}) => {
        if (!hasAccess) {
            setIsLoading(false);
            return;
        }

        if (silent) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        setError('');

        try {
            const response = await fetch('/api/admin/schema-registry', {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to load schema registry.');
            }

            setTables(payload.tables || []);
            setJoins(payload.joins || []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load schema registry.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [hasAccess]);

    useEffect(() => {
        loadRegistry();
    }, [loadRegistry]);

    useEffect(() => {
        setTableDrafts(
            tables.reduce((accumulator, table) => {
                accumulator[table.name] = {
                    provider: table.provider || 'supabase',
                    source: table.source || table.name,
                };
                return accumulator;
            }, {})
        );

        setNewColumnDrafts(
            tables.reduce((accumulator, table) => {
                accumulator[table.name] = createEmptyColumnDraft();
                return accumulator;
            }, {})
        );

        setNewJoinDraft((currentDraft) => {
            const sourceTableStillValid = tables.some((table) => table.name === currentDraft.sourceTable);
            const targetTableStillValid = tables.some((table) => table.name === currentDraft.targetTable);

            return {
                ...currentDraft,
                sourceTable: sourceTableStillValid ? currentDraft.sourceTable : '',
                targetTable: targetTableStillValid ? currentDraft.targetTable : '',
                sourceColumn: sourceTableStillValid ? currentDraft.sourceColumn : '',
                targetColumn: targetTableStillValid ? currentDraft.targetColumn : '',
            };
        });
    }, [tables]);

    const tableNameOptions = useMemo(
        () => tables.map((table) => table.name),
        [tables]
    );

    const availableSourceColumns = useMemo(
        () => tables.find((table) => table.name === newJoinDraft.sourceTable)?.columns || [],
        [newJoinDraft.sourceTable, tables]
    );

    const availableTargetColumns = useMemo(
        () => tables.find((table) => table.name === newJoinDraft.targetTable)?.columns || [],
        [newJoinDraft.targetTable, tables]
    );

    const selectedDiscoveryTableNames = useMemo(
        () => Object.entries(selectedDiscoveryTables)
            .filter(([, checked]) => checked === true)
            .map(([tableName]) => tableName),
        [selectedDiscoveryTables]
    );

    const runMutation = async ({ url, method, body, successMessage, savingToken }) => {
        setSavingKey(savingToken);
        setBanner({ type: '', text: '' });

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Schema update failed.');
            }

            setBanner({
                type: 'success',
                text: successMessage,
            });
            await loadRegistry({ silent: true });
            return true;
        } catch (mutationError) {
            setBanner({
                type: 'error',
                text: mutationError instanceof Error ? mutationError.message : 'Schema update failed.',
            });
            return false;
        } finally {
            setSavingKey('');
        }
    };

    const handleDiscoverSchema = async () => {
        setIsDiscovering(true);
        setBanner({ type: '', text: '' });

        try {
            const response = await fetch('/api/admin/schema-registry?mode=discover', {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to scan Supabase schema.');
            }

            setDiscoveredTables(payload.tables || []);
            setDiscoveredJoins(payload.joins || []);
            setSelectedDiscoveryTables(
                (payload.tables || []).reduce((accumulator, table) => {
                    accumulator[table.name] = !table.alreadyImported;
                    return accumulator;
                }, {})
            );
            setBanner({
                type: 'success',
                text: `Scanned ${payload.tables?.length || 0} tables from the Supabase REST schema.`,
            });
        } catch (discoveryError) {
            setBanner({
                type: 'error',
                text: discoveryError instanceof Error ? discoveryError.message : 'Unable to scan Supabase schema.',
            });
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleImportDiscoveredTables = async () => {
        if (!selectedDiscoveryTableNames.length) {
            setBanner({
                type: 'error',
                text: 'Select at least one discovered table to import.',
            });
            return;
        }

        const ok = await runMutation({
            url: '/api/admin/schema-registry',
            method: 'POST',
            body: {
                entryType: 'import_discovery',
                tableNames: selectedDiscoveryTableNames,
            },
            successMessage: `Imported ${selectedDiscoveryTableNames.length} discovered table${selectedDiscoveryTableNames.length === 1 ? '' : 's'} into the schema registry.`,
            savingToken: 'discover-import',
        });

        if (ok) {
            setDiscoveredTables((currentTables) =>
                currentTables.map((table) => (
                    selectedDiscoveryTableNames.includes(table.name)
                        ? { ...table, alreadyImported: true }
                        : table
                ))
            );
            setSelectedDiscoveryTables((currentSelections) =>
                Object.fromEntries(
                    Object.entries(currentSelections).map(([tableName, checked]) => [
                        tableName,
                        selectedDiscoveryTableNames.includes(tableName) ? false : checked,
                    ])
                )
            );
        }
    };

    const handleCreateTable = async () => {
        const tableName = newTableDraft.tableName.trim();
        const columnName = newTableDraft.columnName.trim();

        if (!tableName || !columnName) {
            setBanner({
                type: 'error',
                text: 'Add a table name and first column name to create a registry entry.',
            });
            return;
        }

        const ok = await runMutation({
            url: '/api/admin/schema-registry',
            method: 'POST',
            body: {
                entryType: 'column',
                tableName,
                provider: newTableDraft.provider,
                source: newTableDraft.source.trim() || tableName,
                columnName,
                columnType: newTableDraft.columnType,
                enabled: newTableDraft.enabled,
            },
            successMessage: `Added ${tableName}.${columnName} to the schema registry.`,
            savingToken: 'create-table',
        });

        if (ok) {
            setNewTableDraft({
                tableName: '',
                provider: 'supabase',
                source: '',
                columnName: '',
                columnType: 'string',
                enabled: true,
            });
        }
    };

    const handleSaveTableMetadata = async (tableName) => {
        const draft = tableDrafts[tableName];

        if (!draft) {
            return;
        }

        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'PATCH',
            body: {
                entryType: 'table',
                tableName,
                provider: draft.provider,
                source: draft.source,
            },
            successMessage: `Updated metadata for ${tableName}.`,
            savingToken: `table-meta:${tableName}`,
        });
    };

    const handleToggleTableEnabled = async (tableName, enabled) => {
        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'PATCH',
            body: {
                entryType: 'table',
                tableName,
                enabled,
            },
            successMessage: `${enabled ? 'Enabled' : 'Disabled'} ${tableName} for the approved schema.`,
            savingToken: `table-enabled:${tableName}`,
        });
    };

    const handleToggleDataSourceVisibility = async (tableName, showInDataSources) => {
        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'PATCH',
            body: {
                entryType: 'table',
                tableName,
                showInDataSources,
            },
            successMessage: `${showInDataSources ? 'Showed' : 'Hid'} ${tableName} in the Data Sources tab.`,
            savingToken: `table-data-sources:${tableName}`,
        });
    };

    const handleDeleteTable = async (tableName) => {
        if (!window.confirm(`Delete the ${tableName} table entry and its related joins from the schema registry?`)) {
            return;
        }

        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'DELETE',
            body: {
                entryType: 'table',
                tableName,
            },
            successMessage: `Removed ${tableName} from the schema registry.`,
            savingToken: `table-delete:${tableName}`,
        });
    };

    const handleCreateColumn = async (tableName) => {
        const draft = newColumnDrafts[tableName] || createEmptyColumnDraft();
        const table = tables.find((entry) => entry.name === tableName);
        const columnName = draft.columnName.trim();

        if (!table || !columnName) {
            setBanner({
                type: 'error',
                text: 'Enter a column name before adding it to the registry.',
            });
            return;
        }

        const ok = await runMutation({
            url: '/api/admin/schema-registry',
            method: 'POST',
            body: {
                entryType: 'column',
                tableName,
                provider: table.provider,
                source: table.source,
                columnName,
                columnType: draft.columnType,
                enabled: draft.enabled,
            },
            successMessage: `Added ${tableName}.${columnName}.`,
            savingToken: `column-create:${tableName}`,
        });

        if (ok) {
            setNewColumnDrafts((currentDrafts) => ({
                ...currentDrafts,
                [tableName]: createEmptyColumnDraft(),
            }));
        }
    };

    const handleUpdateColumn = async ({ id, columnName, enabled, columnType }) => {
        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'PATCH',
            body: {
                entryType: 'column',
                id,
                ...(enabled !== undefined ? { enabled } : {}),
                ...(columnType ? { columnType } : {}),
            },
            successMessage: `Updated ${columnName}.`,
            savingToken: `column:${id}`,
        });
    };

    const handleDeleteColumn = async ({ id, columnName }) => {
        if (!window.confirm(`Delete ${columnName} from the schema registry?`)) {
            return;
        }

        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'DELETE',
            body: {
                entryType: 'column',
                id,
            },
            successMessage: `Removed ${columnName} from the schema registry.`,
            savingToken: `column-delete:${id}`,
        });
    };

    const handleCreateJoin = async () => {
        if (
            !newJoinDraft.sourceTable ||
            !newJoinDraft.targetTable ||
            !newJoinDraft.sourceColumn ||
            !newJoinDraft.targetColumn
        ) {
            setBanner({
                type: 'error',
                text: 'Choose both tables and both columns before adding a join.',
            });
            return;
        }

        const ok = await runMutation({
            url: '/api/admin/schema-registry',
            method: 'POST',
            body: {
                entryType: 'join',
                ...newJoinDraft,
            },
            successMessage: `Added join from ${newJoinDraft.sourceTable} to ${newJoinDraft.targetTable}.`,
            savingToken: 'join-create',
        });

        if (ok) {
            setNewJoinDraft({
                sourceTable: '',
                targetTable: '',
                sourceColumn: '',
                targetColumn: '',
                joinType: 'left',
                enabled: true,
            });
        }
    };

    const handleUpdateJoin = async ({ id, label, enabled, joinType }) => {
        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'PATCH',
            body: {
                entryType: 'join',
                id,
                ...(enabled !== undefined ? { enabled } : {}),
                ...(joinType ? { joinType } : {}),
            },
            successMessage: `Updated ${label}.`,
            savingToken: `join:${id}`,
        });
    };

    const handleDeleteJoin = async ({ id, label }) => {
        if (!window.confirm(`Delete ${label} from the approved joins list?`)) {
            return;
        }

        await runMutation({
            url: '/api/admin/schema-registry',
            method: 'DELETE',
            body: {
                entryType: 'join',
                id,
            },
            successMessage: `Removed ${label}.`,
            savingToken: `join-delete:${id}`,
        });
    };

    if (!hasAccess) {
        return (
            <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
                <div className="mx-auto max-w-5xl">
                    <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                                <AlertTriangle className="size-5" />
                                Access restricted
                            </CardTitle>
                            <CardDescription className="text-amber-800/80 dark:text-amber-200/80">
                                Your current role does not have access to the schema registry manager.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Schema control
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Schema Registry
                        </h1>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            Manage which tables, columns, and joins the chatbot is allowed to use from the Supabase schema registry.
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => loadRegistry({ silent: true })}
                        disabled={isRefreshing || isLoading}
                    >
                        {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                        Refresh
                    </Button>
                </div>

                <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    This manager writes to `chatbot_schema_registry` and `chatbot_schema_joins`. The `.env` fallback still exists, but it is only used when the Supabase registry is empty or unavailable.
                </div>

                {banner.text ? (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                            banner.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                    >
                        {banner.text}
                    </div>
                ) : null}

                <Card>
                    <CardHeader className="border-b border-border bg-muted/20">
                        <CardTitle className="flex items-center gap-2">
                            <RefreshCcw className="size-5 text-primary" />
                            Discover From Supabase
                        </CardTitle>
                        <CardDescription>
                            Scan the Supabase REST OpenAPI schema to find public tables and columns automatically, then import the ones you want into the registry.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 md:p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <p className="max-w-3xl text-sm text-muted-foreground">
                                This scan reflects the REST-exposed public schema, not private Postgres schemas. Foreign-key hints are imported as suggested joins when both related tables are selected.
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handleDiscoverSchema}
                                    disabled={isDiscovering}
                                >
                                    {isDiscovering ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                                    Scan Supabase
                                </Button>
                                <Button
                                    type="button"
                                    className="gap-2"
                                    onClick={handleImportDiscoveredTables}
                                    disabled={savingKey === 'discover-import' || selectedDiscoveryTableNames.length === 0}
                                >
                                    {savingKey === 'discover-import' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                    Import selected
                                </Button>
                            </div>
                        </div>

                        {discoveredTables.length ? (
                            <div className="overflow-hidden rounded-xl border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">Import</TableHead>
                                            <TableHead>Table</TableHead>
                                            <TableHead>Columns</TableHead>
                                            <TableHead>Detected joins</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {discoveredTables.map((table) => {
                                            const joinCount = discoveredJoins.filter(
                                                (join) => join.sourceTable === table.name || join.targetTable === table.name
                                            ).length;

                                            return (
                                                <TableRow key={table.name}>
                                                    <TableCell>
                                                        <Switch
                                                            checked={Boolean(selectedDiscoveryTables[table.name])}
                                                            onCheckedChange={(checked) =>
                                                                setSelectedDiscoveryTables((current) => ({
                                                                    ...current,
                                                                    [table.name]: checked === true,
                                                                }))
                                                            }
                                                            disabled={table.alreadyImported || savingKey === 'discover-import'}
                                                            aria-label={`Select ${table.name} for import`}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium text-foreground">{table.name}</div>
                                                        <div className="text-xs text-muted-foreground">{table.source}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {table.columns.length}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {joinCount}
                                                    </TableCell>
                                                    <TableCell>
                                                        {table.alreadyImported ? (
                                                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                                Already imported
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                                                New
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-border bg-muted/20">
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="size-5 text-primary" />
                            Add Table Entry
                        </CardTitle>
                        <CardDescription>
                            Create a new approved table by adding its first column to the registry.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(160px,1fr)_minmax(120px,0.8fr)_minmax(180px,1fr)_minmax(160px,1fr)_minmax(140px,0.8fr)_auto] md:p-6">
                        <Input
                            value={newTableDraft.tableName}
                            onChange={(event) => setNewTableDraft((current) => ({ ...current, tableName: event.target.value }))}
                            placeholder="table_name"
                            aria-label="Table name"
                        />
                        <Select
                            value={newTableDraft.provider}
                            onValueChange={(value) => setNewTableDraft((current) => ({ ...current, provider: value }))}
                        >
                            <SelectTrigger aria-label="Provider">
                                <SelectValue placeholder="Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {PROVIDER_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            value={newTableDraft.source}
                            onChange={(event) => setNewTableDraft((current) => ({ ...current, source: event.target.value }))}
                            placeholder="source table"
                            aria-label="Source table"
                        />
                        <Input
                            value={newTableDraft.columnName}
                            onChange={(event) => setNewTableDraft((current) => ({ ...current, columnName: event.target.value }))}
                            placeholder="first_column"
                            aria-label="First column name"
                        />
                        <Select
                            value={newTableDraft.columnType}
                            onValueChange={(value) => setNewTableDraft((current) => ({ ...current, columnType: value }))}
                        >
                            <SelectTrigger aria-label="Column type">
                                <SelectValue placeholder="Column type" />
                            </SelectTrigger>
                            <SelectContent>
                                {COLUMN_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            className="gap-2"
                            onClick={handleCreateTable}
                            disabled={savingKey === 'create-table'}
                        >
                            {savingKey === 'create-table' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            Add
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-border bg-muted/20">
                        <CardTitle className="flex items-center gap-2">
                            <Database className="size-5 text-primary" />
                            Approved Tables
                        </CardTitle>
                        <CardDescription>
                            Enable or disable tables, tune their metadata, and control column visibility for structured analytics.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 md:p-6">
                        {isLoading ? (
                            <div className="space-y-4">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div key={index} className="space-y-3 rounded-xl border border-border p-4">
                                        <Skeleton className="h-5 w-48" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-32 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/30 dark:bg-red-900/10">
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
                            </div>
                        ) : tables.length === 0 ? (
                            <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                                <p className="text-base font-semibold text-foreground">No schema registry entries yet</p>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    Add a table above to start managing approved schema metadata from the UI.
                                </p>
                            </div>
                        ) : (
                            tables.map((table) => {
                                const tableDraft = tableDrafts[table.name] || {
                                    provider: table.provider || 'supabase',
                                    source: table.source || table.name,
                                };
                                const columnDraft = newColumnDrafts[table.name] || createEmptyColumnDraft();
                                const tableSaving = savingKey.startsWith(`table-${table.name}`) || savingKey.includes(`:${table.name}`);

                                return (
                                    <div key={table.name} className="rounded-2xl border border-border bg-background shadow-sm">
                                        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 md:flex-row md:items-start md:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-semibold text-foreground">{table.name}</h3>
                                                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                        {table.enabledColumns}/{table.totalColumns} columns enabled
                                                    </span>
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        table.isEnabled
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                                    }`}>
                                                        {table.isEnabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Update provider and source metadata, then control which columns stay available to the chatbot.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <span>Show in Data Sources</span>
                                                    <Switch
                                                        checked={table.showInDataSources !== false}
                                                        onCheckedChange={(checked) => handleToggleDataSourceVisibility(table.name, checked === true)}
                                                        disabled={Boolean(savingKey)}
                                                        aria-label={`Show ${table.name} in Data Sources`}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <span>Enable table</span>
                                                    <Switch
                                                        checked={table.isEnabled}
                                                        onCheckedChange={(checked) => handleToggleTableEnabled(table.name, checked === true)}
                                                        disabled={Boolean(savingKey)}
                                                        aria-label={`Enable ${table.name}`}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700"
                                                    onClick={() => handleDeleteTable(table.name)}
                                                    disabled={Boolean(savingKey)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 p-4">
                                            <div className="grid gap-3 md:grid-cols-[minmax(120px,0.7fr)_minmax(220px,1fr)_auto]">
                                                <Select
                                                    value={tableDraft.provider}
                                                    onValueChange={(value) =>
                                                        setTableDrafts((current) => ({
                                                            ...current,
                                                            [table.name]: {
                                                                ...current[table.name],
                                                                provider: value,
                                                            },
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger aria-label={`Provider for ${table.name}`}>
                                                        <SelectValue placeholder="Provider" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PROVIDER_OPTIONS.map((option) => (
                                                            <SelectItem key={option} value={option}>
                                                                {option}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    value={tableDraft.source}
                                                    onChange={(event) =>
                                                        setTableDrafts((current) => ({
                                                            ...current,
                                                            [table.name]: {
                                                                ...current[table.name],
                                                                source: event.target.value,
                                                            },
                                                        }))
                                                    }
                                                    placeholder="Source table name"
                                                    aria-label={`Source for ${table.name}`}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() => handleSaveTableMetadata(table.name)}
                                                    disabled={Boolean(savingKey)}
                                                >
                                                    {tableSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                                    Save metadata
                                                </Button>
                                            </div>

                                            <div className="overflow-hidden rounded-xl border border-border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Column</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead>Enabled</TableHead>
                                                            <TableHead className="w-[80px] text-right">Action</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {table.columns.map((column) => {
                                                            const columnSaving = savingKey === `column:${column.id}` || savingKey === `column-delete:${column.id}`;

                                                            return (
                                                                <TableRow key={column.id}>
                                                                    <TableCell>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className="font-medium text-foreground">{column.name}</span>
                                                                            {isPotentialScopeColumn(column.name) ? (
                                                                                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                                                                                    Scope key
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Select
                                                                            value={column.type}
                                                                            onValueChange={(value) =>
                                                                                handleUpdateColumn({
                                                                                    id: column.id,
                                                                                    columnName: `${table.name}.${column.name}`,
                                                                                    columnType: value,
                                                                                })
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 w-[140px]" aria-label={`Type for ${column.name}`}>
                                                                                <SelectValue placeholder="Type" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {COLUMN_TYPE_OPTIONS.map((option) => (
                                                                                    <SelectItem key={option} value={option}>
                                                                                        {option}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Switch
                                                                            checked={column.enabled}
                                                                            onCheckedChange={(checked) =>
                                                                                handleUpdateColumn({
                                                                                    id: column.id,
                                                                                    columnName: `${table.name}.${column.name}`,
                                                                                    enabled: checked === true,
                                                                                })
                                                                            }
                                                                            disabled={Boolean(savingKey)}
                                                                            aria-label={`Enable ${column.name}`}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-red-600 hover:text-red-700"
                                                                            onClick={() =>
                                                                                handleDeleteColumn({
                                                                                    id: column.id,
                                                                                    columnName: `${table.name}.${column.name}`,
                                                                                })
                                                                            }
                                                                            disabled={columnSaving || Boolean(savingKey)}
                                                                        >
                                                                            {columnSaving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                        <TableRow>
                                                            <TableCell>
                                                                <Input
                                                                    value={columnDraft.columnName}
                                                                    onChange={(event) =>
                                                                        setNewColumnDrafts((current) => ({
                                                                            ...current,
                                                                            [table.name]: {
                                                                                ...(current[table.name] || createEmptyColumnDraft()),
                                                                                columnName: event.target.value,
                                                                            },
                                                                        }))
                                                                    }
                                                                    placeholder="new_column"
                                                                    aria-label={`New column for ${table.name}`}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Select
                                                                    value={columnDraft.columnType}
                                                                    onValueChange={(value) =>
                                                                        setNewColumnDrafts((current) => ({
                                                                            ...current,
                                                                            [table.name]: {
                                                                                ...(current[table.name] || createEmptyColumnDraft()),
                                                                                columnType: value,
                                                                            },
                                                                        }))
                                                                    }
                                                                >
                                                                    <SelectTrigger className="h-8 w-[140px]" aria-label={`New column type for ${table.name}`}>
                                                                        <SelectValue placeholder="Type" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {COLUMN_TYPE_OPTIONS.map((option) => (
                                                                            <SelectItem key={option} value={option}>
                                                                                {option}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Switch
                                                                    checked={columnDraft.enabled}
                                                                    onCheckedChange={(checked) =>
                                                                        setNewColumnDrafts((current) => ({
                                                                            ...current,
                                                                            [table.name]: {
                                                                                ...(current[table.name] || createEmptyColumnDraft()),
                                                                                enabled: checked === true,
                                                                            },
                                                                        }))
                                                                    }
                                                                    aria-label={`Enable new column for ${table.name}`}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                    onClick={() => handleCreateColumn(table.name)}
                                                                    disabled={Boolean(savingKey)}
                                                                >
                                                                    <Plus className="size-4" />
                                                                    Add
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-border bg-muted/20">
                        <CardTitle className="flex items-center gap-2">
                            <Link2 className="size-5 text-primary" />
                            Approved Joins
                        </CardTitle>
                        <CardDescription>
                            Define which joins the structured query planner is allowed to use between approved tables.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 md:p-6">
                        <div className="grid gap-3 md:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_minmax(150px,1fr)_minmax(160px,1fr)_minmax(120px,0.8fr)_auto]">
                            <Select
                                value={newJoinDraft.sourceTable || undefined}
                                onValueChange={(value) =>
                                    setNewJoinDraft((current) => ({
                                        ...current,
                                        sourceTable: value,
                                        sourceColumn: '',
                                    }))
                                }
                            >
                                <SelectTrigger aria-label="Source table">
                                    <SelectValue placeholder="Source table" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tableNameOptions.map((tableName) => (
                                        <SelectItem key={tableName} value={tableName}>
                                            {tableName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={newJoinDraft.sourceColumn || undefined}
                                onValueChange={(value) =>
                                    setNewJoinDraft((current) => ({
                                        ...current,
                                        sourceColumn: value,
                                    }))
                                }
                                disabled={!newJoinDraft.sourceTable}
                            >
                                <SelectTrigger aria-label="Source column">
                                    <SelectValue placeholder="Source column" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSourceColumns.map((column) => (
                                        <SelectItem key={`${newJoinDraft.sourceTable}:${column.name}`} value={column.name}>
                                            {column.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={newJoinDraft.targetTable || undefined}
                                onValueChange={(value) =>
                                    setNewJoinDraft((current) => ({
                                        ...current,
                                        targetTable: value,
                                        targetColumn: '',
                                    }))
                                }
                            >
                                <SelectTrigger aria-label="Target table">
                                    <SelectValue placeholder="Target table" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tableNameOptions.map((tableName) => (
                                        <SelectItem key={tableName} value={tableName}>
                                            {tableName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={newJoinDraft.targetColumn || undefined}
                                onValueChange={(value) =>
                                    setNewJoinDraft((current) => ({
                                        ...current,
                                        targetColumn: value,
                                    }))
                                }
                                disabled={!newJoinDraft.targetTable}
                            >
                                <SelectTrigger aria-label="Target column">
                                    <SelectValue placeholder="Target column" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTargetColumns.map((column) => (
                                        <SelectItem key={`${newJoinDraft.targetTable}:${column.name}`} value={column.name}>
                                            {column.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={newJoinDraft.joinType}
                                onValueChange={(value) =>
                                    setNewJoinDraft((current) => ({
                                        ...current,
                                        joinType: value,
                                    }))
                                }
                            >
                                <SelectTrigger aria-label="Join type">
                                    <SelectValue placeholder="Join type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {JOIN_TYPE_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                className="gap-2"
                                onClick={handleCreateJoin}
                                disabled={savingKey === 'join-create'}
                            >
                                {savingKey === 'join-create' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                                Add join
                            </Button>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Join</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Enabled</TableHead>
                                        <TableHead className="w-[80px] text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {joins.length ? (
                                        joins.map((join) => {
                                            const label = `${join.sourceTable}.${join.sourceColumn} -> ${join.targetTable}.${join.targetColumn}`;
                                            const joinSaving = savingKey === `join:${join.id}` || savingKey === `join-delete:${join.id}`;

                                            return (
                                                <TableRow key={join.id}>
                                                    <TableCell>
                                                        <div className="font-medium text-foreground">{label}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={join.joinType}
                                                            onValueChange={(value) =>
                                                                handleUpdateJoin({
                                                                    id: join.id,
                                                                    label,
                                                                    joinType: value,
                                                                })
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 w-[120px]" aria-label={`Join type for ${label}`}>
                                                                <SelectValue placeholder="Type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {JOIN_TYPE_OPTIONS.map((option) => (
                                                                    <SelectItem key={option} value={option}>
                                                                        {option}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch
                                                            checked={join.enabled}
                                                            onCheckedChange={(checked) =>
                                                                handleUpdateJoin({
                                                                    id: join.id,
                                                                    label,
                                                                    enabled: checked === true,
                                                                })
                                                            }
                                                            disabled={Boolean(savingKey)}
                                                            aria-label={`Enable ${label}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => handleDeleteJoin({ id: join.id, label })}
                                                            disabled={joinSaving || Boolean(savingKey)}
                                                        >
                                                            {joinSaving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                                                No joins configured yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SchemaRegistryView;
