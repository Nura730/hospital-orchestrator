/**
 * @file RawDataTable.jsx
 * Exact values behind a chart or panel, with CSV export. Horizontal scroll on small screens.
 */

import React from 'react';
import clsx from 'clsx';
import { Download } from 'lucide-react';
import { exportCsv } from '../../utils/flowFormat.js';

/**
 * @param {{ rows: object[], columns: {key: string, label: string, render?: Function, csv?: Function, align?: string}[], exportName?: string, maxHeight?: string, emptyText?: string, title?: string }} props
 */
export function RawDataTable({ rows = [], columns = [], exportName, maxHeight = 'max-h-72', emptyText = 'No rows', title, compact = false }) {
  return (
    <div className="rounded-xl border border-cream-200 bg-cream-50 overflow-hidden">
      {(title || exportName) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-cream-200 bg-cream-100">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title || 'Raw data'} · {rows.length} rows</span>
          {exportName && (
            <button type="button" className="flow-btn-secondary !py-1 !px-2" onClick={() => exportCsv(exportName, columns, rows)} disabled={!rows.length}>
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export CSV
            </button>
          )}
        </div>
      )}
      <div className={clsx('overflow-auto scrollbar-thin', maxHeight)}>
        <table className="flow-table w-full">
          <thead className="sticky top-0 bg-cream-50 z-10">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={clsx(c.align === 'right' && '!text-right', compact && '!py-1.5')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="!text-center !text-ink-500 !py-6">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx(c.align === 'right' && '!text-right tabular-nums', compact && '!py-1.5')}>
                    {c.render ? c.render(r) : r[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RawDataTable;
