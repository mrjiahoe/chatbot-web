'use client';
import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, FileText, Download, Table } from 'lucide-react';

const FilePreviewModal = ({ isOpen, onClose, filename, data }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    if (!isOpen || !data) return null;

    const { columns, rows } = data;
    const totalPages = Math.ceil(rows.length / rowsPerPage);

    const startIndex = (currentPage - 1) * rowsPerPage;
    const currentRows = rows.slice(startIndex, startIndex + rowsPerPage);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl max-h-[90vh] rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                            <Table className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white truncate max-w-md">{filename}</h2>
                            <p className="text-sm text-zinc-500">Previewing {rows.length} rows</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6">
                    <div className="min-w-full inline-block align-middle">
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                    <tr>
                                        {columns.map((col, i) => (
                                            <th
                                                key={i}
                                                className="px-6 py-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap"
                                            >
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {currentRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                            {columns.map((col, colIndex) => (
                                                <td key={colIndex} className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                                    {String(row[col] || '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer / Pagination */}
                <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <span className="text-sm text-zinc-500 font-medium">
                        Showing <span className="text-zinc-900 dark:text-white">{startIndex + 1}</span> to <span className="text-zinc-900 dark:text-white">{Math.min(startIndex + rowsPerPage, rows.length)}</span> of <span className="text-zinc-900 dark:text-white">{rows.length}</span> results
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        >
                            <ChevronLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === pageNum ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        >
                            <ChevronRight size={20} className="text-zinc-600 dark:text-zinc-400" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilePreviewModal;
