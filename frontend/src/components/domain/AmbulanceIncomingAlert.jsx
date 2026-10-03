/**
 * @file AmbulanceIncomingAlert.jsx
 * Full-width banner: "Ambulance incoming: ETA 8 min | Acuity 1 | Bed ICU-04 reserved".
 * Auto-dismisses after 60 s unless acknowledged. Fed by flow.ambulanceIncoming (liveStore).
 */

import React, { useEffect, useState } from 'react';
import { Ambulance, Check, X } from 'lucide-react';
import { useLiveStore } from '../../store/liveStore.js';

export function AmbulanceIncomingAlert() {
  const amb = useLiveStore((s) => s.flowState.ambulanceIncoming);
  const setFlowState = useLiveStore((s) => s.setFlowState);
  const clearAmbulance = useLiveStore((s) => s.clearAmbulance);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!amb) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [amb]);

  if (!amb) return null;
  const received = new Date(amb.receivedAt).getTime();
  const remaining = Math.max(0, 60 - Math.floor((now - received) / 1000));
  const etaLeft = amb.arrivesAt ? Math.max(0, Math.round((new Date(amb.arrivesAt).getTime() - now) / 60000)) : amb.eta;
  const bedText = amb.bedId ? `Bed ${amb.bedId} ${amb.bedMode === 'releasing' ? 'releasing soon' : 'reserved'}` : 'No bed reserved';

  return (
    <div role="alert" aria-live="assertive" className="relative overflow-hidden rounded-xl bg-[#B91C1C] text-white mb-4">
      {!amb.acknowledged && (
        <div className="absolute bottom-0 left-0 h-1 bg-white/60 transition-all" style={{ width: `${(remaining / 60) * 100}%` }} aria-hidden="true" />
      )}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center animate-pulse shrink-0">
          <Ambulance className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-bold">
            Ambulance incoming: ETA {etaLeft} min | Acuity {amb.acuity} | {bedText}
          </p>
          <p className="text-xs text-white/85">
            {amb.injuryType}
            {amb.probability != null && ` · admission probability ${Math.round(amb.probability * 100)}%`}
            {amb.icuProbability != null && ` · ICU need ${Math.round(amb.icuProbability * 100)}% (model)${amb.requiresIcu ? ', ICU bed prioritised' : ''}`}
            {amb.vitals && Object.keys(amb.vitals).length > 0 && ` · ${Object.entries(amb.vitals).map(([k, v]) => `${k} ${v}`).join(', ')}`}
          </p>
        </div>
        {amb.acknowledged ? (
          <span className="text-xs font-semibold bg-white/15 rounded-full px-2.5 py-1">Acknowledged</span>
        ) : (
          <span className="text-xs text-white/80 tabular-nums">auto-dismiss {remaining}s</span>
        )}
        {!amb.acknowledged && (
          <button type="button" onClick={() => setFlowState({ ambulanceIncoming: { ...amb, acknowledged: true } })} className="flow-btn bg-white text-fg-bad hover:bg-white/90">
            <Check className="w-3.5 h-3.5" aria-hidden="true" /> Acknowledge
          </button>
        )}
        <button type="button" onClick={clearAmbulance} className="flow-btn !p-1.5 text-white hover:bg-white/15" aria-label="Dismiss ambulance alert">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AmbulanceIncomingAlert;
