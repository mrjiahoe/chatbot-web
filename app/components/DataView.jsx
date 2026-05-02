'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, Eye, Loader2, Rows3, Server } from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { canAccessDataSources, canPreviewDataSources } from '@/lib/roles';

const DataView = ({ currentRole }) => {
    const [tables, setTables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [selectedTableName, setSelectedTableName] = useState('');
    const [error, setError] = useState(null);
    const canViewDataSources = canAccessDataSources(currentRole);
    const canPreviewData = canPreviewDataSources(currentRole);

    useEffect(() => {
        if (!canViewDataSources) {
            setIsLoading(false);
            return;
        }

        fetchTables();
    }, [canViewDataSources]);

    const fetchTables = async () => {
        try {
            const response = await fetch('/api/schema/tables', {
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load schema tables.');
            }

            setTables(payload.tables || []);
        } catch (err) {
            console.error('Error fetching tables:', err);
            setError('Failed to load database tables.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreviewTable = async (table) => {
        if (!canPreviewData) {
            setError('You do not have permission to preview data sources.');
            return;
        }

        setIsPreviewLoading(true);
        setSelectedTableName(table.name);

        try {
            const response = await fetch(
                `/api/schema/preview?table=${encodeURIComponent(table.name)}&limit=25`,
                {
                    cache: 'no-store',
                }
            );
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load table preview.');
            }

            setPreviewData({
                columns: payload.columns || table.columns.map((col) => col.name),
                rows: payload.rows || [],
            });
        } catch (err) {
            console.error('Preview error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load table preview.');
        } finally {
            setIsPreviewLoading(false);
        }
    };

    if (!canViewDataSources) {
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
                                Your current role does not have access to data sources.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-10 animate-fade-in custom-scrollbar">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        {/* <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Data sources
                        </p> */}
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Available Data Sources
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Browse your database tables and preview records before you build a query.
                        </p>
                    </div>

                </div>

                <Card>
                    <CardHeader className="space-y-4 border-b border-border bg-muted/20">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="size-5 text-primary" />
                                    Database Tables
                                </CardTitle>
                                <CardDescription className="pt-1">
                                    Browse each table and preview the first 25 rows.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 md:p-6">
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="size-10 rounded-xl" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-44" />
                                                <Skeleton className="h-3 w-24" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-9 w-24 rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/30 dark:bg-red-900/10">
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
                            </div>
                        ) : tables.length === 0 ? (
                            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
                                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                    <Rows3 className="size-5" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground">No database tables available</h3>
                                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                    Populate `chatbot_schema_registry` or set `CHATBOT_ALLOWED_SCHEMA` so the app knows which tables to expose.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tables.map((table) => (
                                    <div
                                        key={table.name}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handlePreviewTable(table)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handlePreviewTable(table);
                                            }
                                        }}
                                        className="group flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-muted/40 hover:shadow-sm"
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-4">
                                            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <Server className="size-5" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="truncate text-sm font-semibold text-foreground">
                                                        {table.name}
                                                    </h3>
                                                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                        {table.columns.length} columns
                                                    </span>
                                                </div>
                                                {/* <p className="mt-1 text-xs text-muted-foreground">
                                                    Preview the first 25 rows and inspect the schema.
                                                </p> */}
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0 gap-2 cursor-pointer"
                                            disabled={!canPreviewData}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handlePreviewTable(table);
                                            }}
                                        >
                                            <Eye className="size-4" />
                                            {canPreviewData ? 'Preview' : 'No Access'}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {isPreviewLoading && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <Card className="flex items-center gap-4 px-6 py-5 shadow-xl">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="font-medium text-foreground">Loading preview...</span>
                    </Card>
                </div>
            )}

            <FilePreviewModal
                isOpen={!!previewData}
                onClose={() => setPreviewData(null)}
                filename={selectedTableName}
                data={previewData}
            />
        </div>
    );
};

export default DataView;
