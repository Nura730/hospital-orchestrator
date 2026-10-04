/**
 * @file ExperimentalOutlook.jsx
 * Experimental 24-hour utilization outlook from the trained pressure_utilization models (src/ml/outlook.js).
 * Display only: it never changes severity, alarms or recommendations. Hidden if the models cannot load.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { loadOutlookModels, predictOutlook, isOutlookLoaded, OUTLOOK_HORIZONS } from '../../ml/outlook.js';

const tone = (pct) => (pct > 90 ? { bg: 'rgba(239,68,68,0.14)', text: '#991B1B' } : pct >= 70 ? { bg: 'rgba(245,158,11,0.18)', text: '#92400E' } : { bg: 'rgba(16,185,129,0.14)', text: '#046C4E' });

export function ExperimentalOutlook({ departments = [] }) {
  const [ready, setReady] = useState(isOutlookLoaded());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadOutlookModels()
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!ready) return [];
    try {
      return predictOutlook(departments.map((d) => ({ department: d.department, capacity: d.capacity, occupied: d.occupied })));
    } catch {
      return [];
    }
  }, [ready, departments]);

  if (failed || (ready && !rows.length)) return null;

  return (
    <section className="flow-card p-5" aria-label="Experimental model outlook">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-ink-900">Model outlook, next 24 hours</h2>
          <p className="text-sm text-ink-500">Forecast from the trained occupancy models. For comparison only; alerts and actions above do not use it.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED]/10 px-2.5 py-1 text-xs font-bold text-[#6D28D9]">
          <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Experimental
        </span>
      </div>
      {!ready ? (
        <p className="text-sm text-ink-500 py-6 text-center">Loading the models</p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Model outlook table">
          <table className="mo-table">
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col" className="text-center">
                  Now
                </th>
                {OUTLOOK_HORIZONS.map(([key, , label]) => (
                  <th key={key} scope="col" className="text-center">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.department}>
                  <td className="!text-sm font-semibold">{r.department}</td>
                  {['now', ...OUTLOOK_HORIZONS.map(([key]) => key)].map((k) => {
                    const pct = Math.round(r[k]);
                    const t = tone(pct);
                    return (
                      <td key={k} className="text-center">
                        <span className="inline-block min-w-[56px] rounded-lg px-2 py-1 text-sm font-bold tabular-nums" style={{ backgroundColor: t.bg, color: t.text }}>
                          {pct}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-500 mt-3">
        Trained on another hospital's data and assumes the current state held steady, so it reads low for very full departments (it cannot tell 85% from 100%). It will improve once it is retrained on this hospital's hourly history.
      </p>
    </section>
  );
}

export default ExperimentalOutlook;
