/**
 * @file DemoControls.jsx
 * Admin-only demo buttons: Reset demo data, Trigger ambulance, Inject surge.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, Ambulance, TrendingUp, FlaskConical } from 'lucide-react';
import flowApi from '../../api/flowApi.js';
import { errorText } from '../../hooks/useFlowPolling.js';

export function DemoControls({ onChanged, compact = false }) {
  const [busy, setBusy] = useState(null);

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(success(res));
      onChanged?.(key, res);
    } catch (e) {
      toast.error(errorText(e, 'Demo action failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'flow-card-pad'}>
      {!compact && (
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-4 h-4 text-royal-500" aria-hidden="true" />
          <h3 className="text-xs font-bold text-royal-900 uppercase tracking-wide">Demo controls</h3>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="flow-btn-secondary" disabled={!!busy} onClick={() => run('reset', flowApi.demoReset, () => 'Demo data reset')}>
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'reset' ? 'Resetting…' : 'Reset demo data'}
        </button>
        <button type="button" className="flow-btn-danger" disabled={!!busy} onClick={() => run('ambulance', () => flowApi.demoAmbulance({}), (r) => `Ambulance event processed${r?.result?.bedId ? `: ${r.result.bedId} reserved` : ''}`)}>
          <Ambulance className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'ambulance' ? 'Sending…' : 'Trigger ambulance'}
        </button>
        <button type="button" className="flow-btn-secondary" disabled={!!busy} onClick={() => run('surge', flowApi.demoSurge, (r) => `Surge injected (${r?.injected ?? 0} patients)`)}>
          <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'surge' ? 'Injecting…' : 'Inject surge'}
        </button>
      </div>
    </div>
  );
}

export default DemoControls;
