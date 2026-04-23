'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Table, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const rowsPerPage = 10;

const FilePreviewModal = ({ isOpen, onClose, filename, data }) => {
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (isOpen) {
            setCurrentPage(1);
        }
    }, [isOpen, filename, data]);

    const { columns, rows, totalPages, currentRows, startIndex, endIndex } = useMemo(() => {
        if (!data) {
            return {
                columns: [],
                rows: [],
                totalPages: 1,
                currentRows: [],
                startIndex: 0,
                endIndex: 0,
            };
        }

        const safeRows = Array.isArray(data.rows) ? data.rows : [];
        const safeColumns = Array.isArray(data.columns) ? data.columns : [];
        const computedTotalPages = Math.max(1, Math.ceil(safeRows.length / rowsPerPage));
        const safePage = Math.min(currentPage, computedTotalPages);
        const computedStartIndex = safeRows.length ? (safePage - 1) * rowsPerPage : 0;
        const computedCurrentRows = safeRows.slice(computedStartIndex, computedStartIndex + rowsPerPage);
        const computedEndIndex = safeRows.length
            ? Math.min(computedStartIndex + rowsPerPage, safeRows.length)
            : 0;

        return {
            columns: safeColumns,
            rows: safeRows,
            totalPages: computedTotalPages,
            currentRows: computedCurrentRows,
            startIndex: computedStartIndex,
            endIndex: computedEndIndex,
        };
    }, [data, currentPage]);

    if (!isOpen || !data) return null;

    const pageNumbers = (() => {
        const visiblePages = Math.min(5, totalPages);

        if (totalPages <= 5) {
            return Array.from({ length: visiblePages }, (_, index) => index + 1);
        }

        if (currentPage <= 3) {
            return [1, 2, 3, 4, 5];
        }

        if (currentPage >= totalPages - 2) {
            return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
        }

        return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    })();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-6xl gap-0 overflow-hidden p-0">
                <DialogHeader className="flex flex-row items-start justify-between gap-4 border-b border-border bg-muted/30 px-6 py-5 md:px-8">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Table className="size-6" />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="truncate text-xl md:text-2xl">
                                {filename}
                            </DialogTitle>
                            <DialogDescription className="flex items-center gap-2">
                                <FileText className="size-4" />
                                Previewing {rows.length} row{rows.length === 1 ? '' : 's'}
                            </DialogDescription>
                        </div>
                    </div>

                    <DialogClose asChild>
                        <Button variant="ghost" size="icon-sm" className="shrink-0">
                            <X className="size-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <div className="max-h-[72vh] overflow-auto p-6 md:p-8">
                    <div className="horizontal-scrollbar overflow-x-scroll rounded-xl border border-border">
                        <table className="min-w-max w-full">
                            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                                <tr>
                                    {columns.map((col) => (
                                        <th
                                            key={col}
                                            className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-40"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-background">
                                {currentRows.length > 0 ? (
                                    currentRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="transition-colors hover:bg-muted/50">
                                            {columns.map((col) => (
                                                <td key={col} className="whitespace-nowrap px-5 py-3 text-sm text-foreground/80 min-w-40">
                                                    {String(row[col] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={Math.max(columns.length, 1)}
                                            className="px-6 py-16 text-center text-sm text-muted-foreground"
                                        >
                                            No rows available in this file.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border-t border-border bg-muted/30 px-6 py-4 md:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {rows.length ? startIndex + 1 : 0} to {endIndex} of {rows.length} result{rows.length === 1 ? '' : 's'}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="size-4" />
                                <span className="sr-only">Previous page</span>
                            </Button>

                            <div className="flex items-center gap-1">
                                {pageNumbers.map((pageNum) => (
                                    <Button
                                        key={pageNum}
                                        type="button"
                                        variant={currentPage === pageNum ? 'default' : 'outline'}
                                        size="sm"
                                        className="min-w-10 px-3"
                                        onClick={() => setCurrentPage(pageNum)}
                                    >
                                        {pageNum}
                                    </Button>
                                ))}
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="size-4" />
                                <span className="sr-only">Next page</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default FilePreviewModal;
