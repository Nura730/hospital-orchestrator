/**
 * @file AiReportPopup.jsx
 * Explainable AI report: loading state, formatted sections with "Why / Because / How this was predicted"
 * explanations highlighted, a "Numbers used" view (raw snapshot + methodology), Copy, Download TXT/PDF,
 * Regenerate, and an "AI-generated, verify before acting" badge.
 */

import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Sparkles, Copy, FileText, FileDown, RefreshCw, ChevronDown, ShieldAlert, Lightbulb } from 'lucide-react';
import { FlowModal, FlowError } from './FlowUi.jsx';
import RawDataTable from './RawDataTable.jsx';
import flowApi from '../../api/flowApi.js';
import { useLiveStore } from '../../store/liveStore.js';
import { errorText } from '../../hooks/useFlowPolling.js';
import { dateTime, downloadText } from '../../utils/flowFormat.js';

const FORMATS = [
  { value: 'explain', label: 'Explainable' },
  { value: 'short', label: 'Short' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'handover', label: 'Shift handover', adminOnly: true },
];

const EXPLAIN_PREFIX = /^(\s*[-*]?\s*)(\*\*)?(Why|Because|How this was predicted|Expected impact)(:)?(\*\*)?:?/i;

function inline(text) {
  // **bold** and `code`; everything else is plain text (no HTML injection)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="px-1 rounded bg-cream-200 text-[11px]">{p.slice(1, -1)}</code>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

/** Minimal, safe Markdown renderer for report text. */
export function ReportBody({ text }) {
  const lines = (text || '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push(
        <div key={`t${i}`} className="overflow-x-auto my-2">
          <table className="flow-table w-full border border-cream-200 rounded-lg">
            <thead>
              <tr>{rows[0].map((c, k) => <th key={k}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, k) => (
                <tr key={k}>{r.map((c, m) => <td key={m} className="!whitespace-normal">{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^#{1,4}\s/.test(trimmed)) {
      out.push(
        <h4 key={i} className="text-sm font-bold text-royal-900 mt-4 mb-1.5 pb-1 border-b border-cream-200">
          {inline(trimmed.replace(/^#{1,4}\s/, ''))}
        </h4>
      );
    } else if (EXPLAIN_PREFIX.test(trimmed)) {
      const m = trimmed.match(EXPLAIN_PREFIX);
      const label = m[3];
      const rest = trimmed.slice(m[0].length).trim();
      const impact = /expected impact/i.test(label);
      out.push(
        <div key={i} className={clsx('my-1 ml-4 rounded-lg border-l-4 px-3 py-1.5 text-xs', impact ? 'border-[#10B981] bg-[#10B981]/10' : 'border-royal-500 bg-royal-100')}>
          <span className={clsx('font-bold mr-1', impact ? 'text-fg-ok' : 'text-royal-700')}>{label}:</span>
          {inline(rest)}
        </div>
      );
    } else if (/^[-*•]\s/.test(trimmed)) {
      out.push(
        <p key={i} className={clsx('text-xs text-ink-900 leading-relaxed flex gap-2', line.startsWith('   ') || line.startsWith('\t') ? 'ml-8' : 'ml-2')}>
          <span className="text-royal-500" aria-hidden="true">•</span>
          <span>{inline(trimmed.replace(/^[-*•]\s/, ''))}</span>
        </p>
      );
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      const n = trimmed.match(/^(\d+)[.)]\s/)[1];
      out.push(
        <p key={i} className="text-xs text-ink-900 leading-relaxed flex gap-2 mt-2 ml-1">
          <span className="w-5 h-5 rounded-full bg-royal-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{n}</span>
          <span className="font-medium">{inline(trimmed.replace(/^\d+[.)]\s/, ''))}</span>
        </p>
      );
    } else {
      out.push(
        <p key={i} className="text-xs text-ink-900 leading-relaxed my-1">
          {inline(trimmed)}
        </p>
      );
    }
    i++;
  }
  return <div>{out}</div>;
}

function printPdf(title, text) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) {
    toast.error('Allow pop-ups to download the PDF');
    return;
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
    <style>body{font-family:Inter,Arial,sans-serif;color:#0F1B2D;padding:32px;max-width:760px;margin:auto}
    h1{color:#014BAA;font-size:20px;margin:0 0 4px}.meta{color:#5B6B80;font-size:12px;margin-bottom:16px}
    .badge{display:inline-block;background:#FFE9A8;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600}
    pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.55}</style></head>
    <body><h1>${esc(title)}</h1><div class="meta">Generated ${esc(new Date().toLocaleString())}</div>
    <div class="badge">AI-generated, verify before acting</div><pre>${esc(text)}</pre></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function AiReportPopup({ open, onClose, scope = 'admin', defaultFormat = 'explain', isAdmin = scope === 'admin' }) {
  const [format, setFormat] = useState(defaultFormat);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const setFlowState = useLiveStore((s) => s.setFlowState);

  const generate = useCallback(
    async (fmt = format) => {
      setLoading(true);
      setError(null);
      try {
        const r = await flowApi.aiReport(scope, fmt);
        setReport(r);
        setFlowState({ lastAiReport: r });
      } catch (e) {
        setError(errorText(e, 'Could not generate the report'));
      } finally {
        setLoading(false);
      }
    },
    [scope, format, setFlowState]
  );

  useEffect(() => {
    if (open) generate(format);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const title = `${scope === 'ot' ? 'OT' : scope === 'doctor' ? 'Doctor' : 'Hospital'} ${format === 'handover' ? 'shift handover' : 'operations report'}`;
  const methodologyRows = report?.methodology ? Object.entries(report.methodology).filter(([k]) => k !== 'thresholds').map(([k, v]) => ({ id: k, rule: k.replace(/([A-Z])/g, ' $1').toLowerCase(), value: String(v) })) : [];

  return (
    <FlowModal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      subtitle="Plain-English explanation of the live numbers: what is happening, why, and what to do"
      footer={
        <>
          <button type="button" className="flow-btn-ghost" disabled={!report} onClick={() => navigator.clipboard.writeText(report.reportText).then(() => toast.success('Report copied'))}>
            <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy
          </button>
          <button type="button" className="flow-btn-secondary" disabled={!report} onClick={() => downloadText(`mediorchestra-${scope}-report.txt`, report.reportText)}>
            <FileText className="w-3.5 h-3.5" aria-hidden="true" /> TXT
          </button>
          <button type="button" className="flow-btn-secondary" disabled={!report} onClick={() => printPdf(title, report.reportText)}>
            <FileDown className="w-3.5 h-3.5" aria-hidden="true" /> PDF
          </button>
          <button type="button" className="flow-btn-primary" disabled={loading} onClick={() => generate(format)}>
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} aria-hidden="true" /> Regenerate
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex rounded-xl bg-cream-100 p-1 border border-cream-200" role="tablist" aria-label="Report format">
          {FORMATS.filter((f) => !f.adminOnly || isAdmin).map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={format === f.value}
              onClick={() => {
                setFormat(f.value);
                generate(f.value);
              }}
              className={clsx('px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors', format === f.value ? 'bg-royal-500 text-white' : 'text-ink-500 hover:text-royal-500')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-highlight text-fg-warn px-2.5 py-1 text-[11px] font-semibold">
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" /> AI-generated, verify before acting
        </span>
        {report && (
          <span className="text-[10px] text-ink-500 ml-auto">
            {report.provider === 'local-template' ? 'Local template (AI provider unavailable)' : `${report.provider} · ${report.model}`} · {dateTime(report.generatedAt)}
            {report.cached ? ' · cached' : ''}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-14 gap-3" role="status">
          <Sparkles className="w-8 h-8 text-royal-500 animate-pulse" aria-hidden="true" />
          <p className="text-sm font-semibold text-royal-900">Analyzing hospital data...</p>
          <p className="text-xs text-ink-500">Building a snapshot from live numbers and explaining it</p>
        </div>
      )}
      {error && !loading && <FlowError message={error} onRetry={() => generate(format)} />}

      {report && !loading && (
        <>
          {format === 'explain' && (
            <p className="flex items-center gap-1.5 text-[11px] text-royal-700 bg-royal-100 rounded-lg px-3 py-1.5 mb-3">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Blue boxes show <b>why</b>: the evidence and rule behind each finding. Green boxes show the expected impact.
            </p>
          )}
          <article className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-2">
            <ReportBody text={report.reportText} />
          </article>

          <div className="mt-3">
            <button type="button" className="flow-btn-ghost w-full justify-between" onClick={() => setShowNumbers((v) => !v)} aria-expanded={showNumbers}>
              <span>Numbers used (snapshot sent to the AI) and how they are calculated</span>
              <ChevronDown className={clsx('w-4 h-4 transition-transform', showNumbers && 'rotate-180')} aria-hidden="true" />
            </button>
            {showNumbers && (
              <div className="mt-2 space-y-3">
                {methodologyRows.length > 0 && (
                  <RawDataTable
                    title="Methodology"
                    rows={methodologyRows}
                    columns={[
                      { key: 'rule', label: 'Rule' },
                      { key: 'value', label: 'How it works', render: (r) => <span className="whitespace-normal block max-w-[520px]">{r.value}</span> },
                    ]}
                    compact
                  />
                )}
                <pre className="text-[11px] bg-[#0B1220] text-[#CBD5E1] rounded-xl p-3 overflow-auto max-h-72 scrollbar-thin">{JSON.stringify(report.snapshot, null, 2)}</pre>
              </div>
            )}
          </div>
        </>
      )}
    </FlowModal>
  );
}

export default AiReportPopup;
