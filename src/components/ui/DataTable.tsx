"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { EmptyState } from "./Card";

export interface Column<T> {
  key:       string;
  header:    string;
  cell:      (row: T) => React.ReactNode;
  sortable?: boolean;
  width?:    string;
  className?: string;
}

interface DataTableProps<T> {
  data:         T[];
  columns:      Column<T>[];
  keyExtractor: (row: T) => string;
  loading?:     boolean;
  emptyTitle?:  string;
  emptyDesc?:   string;
  emptyAction?: React.ReactNode;
  // Pagination
  page?:        number;
  totalPages?:  number;
  onPageChange?: (page: number) => void;
  // Sort
  sortKey?:     string;
  sortOrder?:   "asc" | "desc";
  onSort?:      (key: string, order: "asc" | "desc") => void;
}

export function DataTable<T>({
  data, columns, keyExtractor, loading,
  emptyTitle = "No results", emptyDesc, emptyAction,
  page = 1, totalPages = 1, onPageChange,
  sortKey, sortOrder, onSort,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSort(key, "asc");
    }
  };

  return (
    <div>
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn("table-header", col.width, col.sortable && "cursor-pointer select-none hover:bg-surface-100")}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className="text-gray-300">
                          {sortKey === col.key
                            ? sortOrder === "asc"
                              ? <ChevronUp size={12} className="text-brand-500" />
                              : <ChevronDown size={12} className="text-brand-500" />
                            : <ChevronsUpDown size={12} />
                          }
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    {columns.map((col) => (
                      <td key={col.key} className="table-cell">
                        <div className="skeleton h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title={emptyTitle} description={emptyDesc} action={emptyAction} />
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={keyExtractor(row)} className="table-row">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("table-cell", col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
