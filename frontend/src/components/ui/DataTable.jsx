/**
 * @file DataTable.jsx
 * Advanced data table supporting sortable column headers, client-side pagination, empty state, and responsive cards.
 */

import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';

export function DataTable({
  columns = [],
  data = [],
  pageSize = 10,
  searchable = false,
  searchPlaceholder = 'Filter rows...',
  emptyMessage = 'No matching records found',
  onRowClick = null,
  className = '',
  keyExtractor = (item, idx) => item.id || idx,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [page, setPage] = useState(1);

  // Filter
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const q = searchTerm.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      )
    );
  }, [data, searchTerm]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className={clsx('w-full flex flex-col', className)}>
      {searchable && (
        <div className="mb-3.5 flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 text-surface-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-surface-foreground placeholder-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <span className="text-xs text-surface-muted">
            Showing <strong className="text-surface-foreground">{sortedData.length}</strong> entries
          </span>
        </div>
      )}

      {/* Desktop / Tablet Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-elevated shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-sunken/60 border-b border-surface-border text-surface-muted font-semibold uppercase tracking-wider text-[11px]">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={clsx(
                      'px-4 py-3 select-none',
                      col.sortable !== false && 'cursor-pointer hover:text-surface-foreground',
                      col.width && `w-[${col.width}]`
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <span className="text-surface-muted">
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-primary-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
                            )
                          ) : (
                            <span className="opacity-0 group-hover:opacity-100">↕</span>
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-border">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr
                  key={keyExtractor(row, idx)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={clsx(
                    'transition-colors duration-100',
                    onRowClick ? 'hover:bg-primary-500/5 cursor-pointer' : 'hover:bg-surface-sunken/30'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 align-middle text-surface-foreground">
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <EmptyState message={emptyMessage} />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border bg-surface-sunken/30 text-xs text-surface-muted">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataTable;
