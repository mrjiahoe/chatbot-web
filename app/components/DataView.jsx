import React, { useState, useEffect } from 'react';
import { Database, Server, Loader2, Eye, Columns3, Rows3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FilePreviewModal from './FilePreviewModal';

const DataView = () => {
    const [tables, setTables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [selectedTableName, setSelectedTableName] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            const { data, error } = await supabase
                .from('chatbot_schema_registry')
                .select('table_name, column_name, column_type')
                .eq('enabled', true)
                .order('table_name', { ascending: true })
                .order('column_name', { ascending: true });

            if (error) throw error;

            // Group columns by table
            const groupedTables = new Map();
            data?.forEach((row) => {
                const tableName = row.table_name;
                if (!groupedTables.has(tableName)) {
                    groupedTables.set(tableName, {
                        name: tableName,
                        columns: []
                    });
                }
                groupedTables.get(tableName).columns.push({
                    name: row.column_name,
                    type: row.column_type
                });
            });

            setTables(Array.from(groupedTables.values()));
        } catch (err) {
            console.error('Error fetching tables:', err);
            setError('Failed to load database tables.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreviewTable = async (table) => {
        setIsPreviewLoading(true);
        setSelectedTableName(table.name);

        try {
            // Fetch first 25 rows from the table for preview
            const { data, error } = await supabase
                .from(table.name)
                .select('*')
                .limit(25);

            if (error) throw error;

            setPreviewData({
                columns: table.columns.map(col => col.name),
                rows: data || []
            });
        } catch (err) {
            console.error('Preview error:', err);
            setError('Failed to load table preview.');
        } finally {
            setIsPreviewLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full animate-fade-in w-full pb-20 pt-8">
            <div className="max-w-3xl mx-auto w-full px-6 md:px-8">
                <div className="mb-10">
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">Available Data</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Browse your database tables and preview the data to get ideas for your queries.</p>
                </div>

                <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4 ml-1">Database Tables</h2>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                            <Loader2 size={24} className="animate-spin mb-2" />
                            <span className="text-sm">Loading tables...</span>
                        </div>
                    ) : error ? (
                        <div className="p-10 rounded-3xl border border-red-200 dark:border-red-800/30 bg-red-50 dark:bg-red-900/10 flex flex-col items-center">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    ) : tables.length === 0 ? (
                        <div className="p-10 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                            <Database size={32} className="text-zinc-300 dark:text-zinc-700 mb-4" />
                            <p className="text-sm text-zinc-500">No database tables available.</p>
                        </div>
                    ) : (
                        tables.map((table) => (
                            <div onClick={() => handlePreviewTable(table)} key={table.name} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all group">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-sm">
                                        <Server size={18} className="text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{table.name}</span>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-tight mt-1">
                                            <Columns3 size={12} />
                                            <span>{table.columns.length} columns</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handlePreviewTable(table)}
                                    className="p-2 text-zinc-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Preview table data"
                                >
                                    <Eye size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isPreviewLoading && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Loading preview...</span>
                    </div>
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
