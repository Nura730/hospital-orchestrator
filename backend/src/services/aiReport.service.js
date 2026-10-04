/**
 * AI-generated operations report. The browser never calls the AI provider; this service does.
 * Provider order: configured AI_PROVIDER → the other free provider → deterministic local template.
 * Snapshots contain aliases/IDs only — never patient names.
 */
const crypto = require('crypto');
const db = require('../config/db');
const flowConfig = require('../config/flowConfig');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const dashboard = require('./flowDashboard.service');
const bottleneck = require('./bottleneckEngine.service');
const prediction = require('./predictionEngine.service');

const SYSTEM_PROMPT =
  'You are a hospital operations analyst. Using ONLY the JSON provided, write a report with these sections: ' +
  '1) Situation summary (2-3 sentences), 2) Key numbers (bullet list), 3) Root cause and cascade, ' +
  '4) Predicted next 2-4 hours, 5) Recommended actions (numbered, with expected impact), 6) Risks and confidence. ' +
  'Do not invent numbers. If data is missing, say so. Plain language, no medical diagnosis.';

const HANDOVER_PROMPT =
  'You are a hospital operations analyst writing a shift handover. Using ONLY the JSON provided, write: ' +
  '1) What changed in the last 8 hours, 2) Current key numbers (bullet list), 3) Open risks, ' +
  '4) Pending discharges and who owns them, 5) First actions for the incoming shift (numbered). ' +
  'Do not invent numbers. If data is missing, say so. Plain language, no medical diagnosis.';

// Explainable-AI format (default): every claim must cite the evidence and the rule that produced it
const EXPLAIN_PROMPT =
  'You are an explainable-AI hospital operations analyst. Using ONLY the JSON provided, write a report in Markdown ' +
  'with these sections: 1) Situation summary (2-3 sentences). 2) Key numbers (bullet list, exact values from the JSON). ' +
  '3) Root cause and cascade: name the root-cause department and the cascade, and under a line starting "Why:" cite the ' +
  'utilization, predicted gap and the threshold rule from methodology that made it the root cause. ' +
  '4) Predicted next 2-4 hours: give the predicted numbers and, under "How this was predicted:", explain the forecast ' +
  'method from methodology in one or two plain sentences. 5) Recommended actions: numbered; for each give the action, ' +
  '"Because:" (the evidence from its why field and the numbers behind it) and "Expected impact:". ' +
  '6) Risks and confidence: state the confidence values present in the JSON, what the model cannot see, and what a human ' +
  'should verify before acting. 7) Evidence used: a short bullet list of the JSON fields you relied on. ' +
  'Never invent numbers or causes. If data is missing, say so explicitly. Plain language, no medical diagnosis.';

const TIMEOUT_MS = 15000;
const RATE_LIMIT_PER_MIN = 5;
const CACHE_TTL_MS = 2 * 60 * 1000;

const rateBuckets = new Map(); // userId → [timestamps]
const cache = new Map(); // hash → { at, value }

function checkRateLimit(userId) {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) || []).filter((t) => now - t < 60000);
  if (hits.length >= RATE_LIMIT_PER_MIN) {
    throw new AppError('AI report rate limit reached (5 per minute). Please wait a moment.', 429, 'RATE_LIMIT_EXCEEDED');
  }
  hits.push(now);
  rateBuckets.set(userId, hits);
}

/* ───────────────────────── snapshots ───────────────────────── */

/** The rules behind every number, sent with each snapshot so the AI can explain rather than guess. */
function methodology() {
  const warn = Math.round(flowConfig.BOTTLENECK_WARN_THRESHOLD * 100);
  const danger = Math.round(flowConfig.BOTTLENECK_DANGER_THRESHOLD * 100);
  return {
    thresholds: { warnPct: warn, dangerPct: danger, source: flowConfig.thresholdSource },
    severityRule: `HIGH if utilization > ${danger}% or predicted 2h bed gap > 0; MEDIUM if utilization > ${warn}%; otherwise LOW`,
    dependencyChain: 'Emergency → Radiology → General Ward → HDU → ICU → OT',
    rootCauseRule: 'The root cause is the earliest department in the chain at the worst severity present (HIGH outranks MEDIUM); the cascade is the unbroken run of MEDIUM/HIGH departments right after it',
    forecastMethod: 'Arrivals per hour = weighted average of the same hour and weekday over the last 4 weeks (weights 4,3,2,1, most recent first); 80% band = ±1.28 × standard deviation',
    bedDemandMethod: 'Demand = beds occupied now + forecast arrivals × admission rate − discharges expected in the window (weighted by release confidence); gap = demand − capacity',
    admissionRule: 'Base by acuity 1:95% 2:80% 3:60% 4:30% 5:10%; +10% ICU need, +5% isolation, +15% night arrival (22:00-06:00); cap 99%',
    readinessRule: `+40 acuity ≥4, +20 no pending imaging, +30 expected discharge within 4h, +10 discharge date set; ready at ≥ ${Math.round(flowConfig.DISCHARGE_NUDGE_THRESHOLD * 100)}`,
    losRule: 'Average length of stay of discharged patients with the same acuity and department; confidence = min(0.92, 0.5 + samples/100)',
  };
}

async function lastSimulation() {
  const res = await db.query(`SELECT params, result, created_at FROM simulation_runs ORDER BY created_at DESC LIMIT 1`);
  if (!res.rows[0]) return null;
  const r = res.rows[0].result;
  return {
    at: res.rows[0].created_at,
    params: res.rows[0].params,
    scenarioA: { avgWaitMin: r.scenarioA.avgWaitMin, bedShortage: r.scenarioA.bedShortage, nurseShortage: r.scenarioA.nurseShortage },
    scenarioC: { avgWaitMin: r.scenarioC.avgWaitMin, bedShortage: r.scenarioC.bedShortage, nurseShortage: r.scenarioC.nurseShortage },
    expectedWaitReduction: r.expectedWaitReduction,
    waitReductionPct: r.waitReductionPct,
  };
}

async function adminSnapshot() {
  const [summary, analysis, sim] = await Promise.all([dashboard.getStateSummary(), bottleneck.detectBottlenecks(), lastSimulation()]);
  return {
    scope: 'admin',
    generatedAt: new Date().toISOString(),
    occupancy: summary.occupancy,
    icu: summary.icu,
    departments: analysis.departments.map((d) => ({
      department: d.department,
      occupied: d.occupied,
      capacity: d.capacity,
      utilizationPct: Math.round(d.utilization * 100),
      predicted2hPct: Math.round((d.predicted[2] || 0) * 100),
      predicted4hPct: Math.round((d.predicted[4] || 0) * 100),
      gap2hBeds: d.predictedGap,
      gap4hBeds: d.demand ? (d.demand.find((x) => x.horizon === 4) || {}).gap ?? null : null,
      severity: d.severity,
      severityReason:
        d.severity === 'LOW'
          ? 'within thresholds'
          : d.utilization > flowConfig.BOTTLENECK_DANGER_THRESHOLD
            ? `utilization ${Math.round(d.utilization * 100)}% > danger ${Math.round(flowConfig.BOTTLENECK_DANGER_THRESHOLD * 100)}%`
            : d.predictedGap > 0
              ? `predicted 2h gap ${d.predictedGap} beds > 0`
              : `utilization ${Math.round(d.utilization * 100)}% > warn ${Math.round(flowConfig.BOTTLENECK_WARN_THRESHOLD * 100)}%`,
      dirtyBeds: d.cleaning,
      dischargeReady: d.dischargeReady,
      forecastConfidence: d.demand && d.demand[0] ? d.demand[0].confidence : null,
    })),
    dirtyBeds: summary.dirtyBeds,
    dischargeReady: summary.dischargeReady,
    bottleneck: { rootCause: analysis.rootCause, cascade: analysis.cascade },
    thresholds: analysis.thresholds,
    topActions: analysis.departments
      .flatMap((d) => d.recommendedActions)
      .slice(0, 6)
      .map((a) => ({ action: a.text, impact: a.impact, why: a.why || null, department: a.department })),
    lastSimulation: sim,
    ambulanceIncoming: summary.ambulance ? { eta: summary.ambulance.eta, acuity: summary.ambulance.acuity, bedId: summary.ambulance.bedId } : null,
  };
}

async function doctorSnapshot(doctorId) {
  const patients = await dashboard.getDoctorPatients(doctorId);
  return {
    scope: 'doctor',
    generatedAt: new Date().toISOString(),
    patientCount: patients.length,
    criticalCount: patients.filter((p) => (p.acuity || 5) <= 2).length,
    dischargeReadyCount: patients.filter((p) => p.readiness.score >= flowConfig.DISCHARGE_NUDGE_THRESHOLD * 100).length,
    dischargeReadyAliases: patients.filter((p) => p.readiness.score >= flowConfig.DISCHARGE_NUDGE_THRESHOLD * 100).map((p) => p.alias),
    patients: patients.map((p) => ({
      alias: p.alias,
      status: p.status,
      acuity: p.acuity,
      bed: p.bedId,
      ward: p.ward,
      admissionProbabilityPct: Math.round(p.admissionProbability * 100),
      predictedLosHours: p.los.predictedHours,
      losConfidence: p.los.confidence,
      expectedDischarge: p.expectedDischarge,
      dischargeReadiness: p.readiness.score,
      blockingFactors: p.readiness.blockingFactors,
      admissionFactors: p.factors.map((f) => `${f.factor} (+${Math.round(f.impact * 100)}%)`),
      losSampleCount: p.los.sampleCount,
    })),
  };
}

async function otSnapshot() {
  const impact = await dashboard.getOtImpact();
  const postOp = await db.query(`SELECT status, COUNT(*)::int AS n FROM beds WHERE type = 'post_op' GROUP BY status`);
  return {
    scope: 'ot',
    generatedAt: new Date().toISOString(),
    inProgress: impact.inProgress.map((c) => ({ case: c.caseNumber, procedure: c.procedure, room: c.room, expectedEnd: c.expectedEnd, postOpType: c.postOpType, postOpBed: c.postOpBedId })),
    upcoming: impact.upcoming.map((c) => ({ case: c.caseNumber, procedure: c.procedure, start: c.scheduledStart, urgency: c.urgency, postOpBedAvailable: c.availability, risk: c.risk })),
    postOpBeds: Object.fromEntries(postOp.rows.map((r) => [r.status, r.n])),
    icuOverflow: impact.overflow,
  };
}

async function handoverSnapshot() {
  const [admin, events, alerts, candidates] = await Promise.all([
    adminSnapshot(),
    db.query(`SELECT event_type, COUNT(*)::int AS n FROM flow_events WHERE created_at > NOW() - INTERVAL '8 hours' GROUP BY event_type ORDER BY n DESC`),
    db.query(`SELECT severity, title, department_name FROM alerts WHERE status IN ('open', 'escalated') ORDER BY created_at DESC LIMIT 10`),
    prediction.getDischargeCandidates(),
  ]);
  return {
    ...admin,
    scope: 'handover',
    last8hEvents: events.rows,
    openAlerts: alerts.rows.map((a) => ({ severity: a.severity, title: a.title, department: a.department_name })),
    pendingDischarges: candidates.candidates
      .filter((c) => c.ready)
      .map((c) => ({ alias: c.alias, bed: c.bedId, readiness: c.score, doctor: c.doctorName, blocking: c.blockingFactors })),
  };
}

async function buildSnapshot(scope, format, user) {
  const role = user.role || user.userType;
  if (format === 'handover') {
    if (role !== 'admin') throw new AppError('Handover report requires admin', 403, 'FORBIDDEN');
    return handoverSnapshot();
  }
  if (scope === 'admin') {
    if (role !== 'admin') throw new AppError('Admin report requires admin', 403, 'FORBIDDEN');
    return adminSnapshot();
  }
  if (scope === 'doctor') {
    if (role !== 'doctor' && role !== 'admin') throw new AppError('Doctor report not permitted', 403, 'FORBIDDEN');
    const doctorId = role === 'doctor' ? user.id : user.targetDoctorId;
    if (!doctorId) throw new AppError('doctorId required', 400, 'VALIDATION_ERROR');
    return doctorSnapshot(doctorId);
  }
  if (scope === 'ot') {
    if (role !== 'ot_manager' && role !== 'admin') throw new AppError('OT report not permitted', 403, 'FORBIDDEN');
    return otSnapshot();
  }
  throw new AppError('scope must be admin, doctor or ot', 400, 'VALIDATION_ERROR');
}

/* ───────────────────────── providers ───────────────────────── */

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err: err.message }, 'AI provider call failed, retrying once');
    return fn();
  }
}

/** Comma-separated keys are tried in order (e.g. a second free-tier key when the first is rate limited). */
function keyList(raw) {
  return String(raw || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

async function tryKeys(raw, name, fn) {
  const keys = keyList(raw);
  if (!keys.length) throw new Error(`${name} key not set`);
  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await fn(keys[i]);
    } catch (err) {
      lastErr = err;
      logger.warn({ provider: name, keyIndex: i + 1, err: err.message }, 'AI key failed; trying next key');
    }
  }
  throw lastErr;
}

async function callGemini(systemPrompt, snapshot, format, maxTokens = flowConfig.AI_REPORT_MAX_TOKENS) {
  return tryKeys(flowConfig.GEMINI_API_KEY, 'gemini', async (key) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(flowConfig.GEMINI_MODEL)}:generateContent`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `${format === 'short' ? 'Keep it brief. ' : ''}${JSON.stringify(snapshot)}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!text.trim()) throw new Error('Gemini returned empty text');
    return { reportText: text.trim(), provider: 'gemini', model: flowConfig.GEMINI_MODEL };
  });
}

async function callGroq(systemPrompt, snapshot, format, maxTokens = flowConfig.AI_REPORT_MAX_TOKENS) {
  return tryKeys(flowConfig.GROQ_API_KEY, 'groq', async (key) => {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: flowConfig.GROQ_MODEL,
        temperature: 0.3,
        max_tokens: maxTokens,
        // gpt-oss models reason before answering; keep that short so the token budget goes to the report
        ...(/gpt-oss/i.test(flowConfig.GROQ_MODEL) ? { reasoning_effort: 'low' } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${format === 'short' ? 'Keep it brief. ' : ''}${JSON.stringify(snapshot)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || '';
    if (!text.trim()) throw new Error('Groq returned empty text');
    return { reportText: text.trim(), provider: 'groq', model: flowConfig.GROQ_MODEL };
  });
}

/* ───────────────────────── local template fallback ───────────────────────── */

function bullet(label, value) {
  return `- ${label}: ${value === null || value === undefined ? 'data not available' : value}`;
}

function templateAdmin(s, handover, explain = false) {
  const depts = s.departments || [];
  const root = s.bottleneck && s.bottleneck.rootCause;
  const cascade = (s.bottleneck && s.bottleneck.cascade) || [];
  const short2h = depts.filter((d) => d.gap2hBeds > 0);
  const lines = [];
  if (handover) {
    lines.push('## 1) What changed in the last 8 hours');
    lines.push(s.last8hEvents && s.last8hEvents.length ? s.last8hEvents.map((e) => `- ${e.event_type}: ${e.n}`).join('\n') : '- No flow events recorded in the last 8 hours.');
    lines.push('');
  }
  lines.push(handover ? '## 2) Current key numbers' : '## 1) Situation summary');
  if (!handover) {
    lines.push(
      `Hospital occupancy is ${s.occupancy.pct}% (${s.occupancy.occupied}/${s.occupancy.capacity} beds) and ICU is at ${s.icu.pct}%. ` +
        (root ? `${root} is the current root-cause bottleneck${cascade.length ? `, cascading to ${cascade.join(', ')}` : ''}. ` : 'No department is above the warning threshold. ') +
        `${s.dirtyBeds} beds are waiting for cleaning and ${s.dischargeReady} patients are ready for discharge.`
    );
    lines.push('');
    lines.push('## 2) Key numbers');
  }
  lines.push(bullet('Occupancy', `${s.occupancy.pct}% (${s.occupancy.occupied}/${s.occupancy.capacity})`));
  lines.push(bullet('ICU', `${s.icu.pct}% (${s.icu.occupied}/${s.icu.total})`));
  for (const d of depts) lines.push(bullet(d.department, `${d.utilizationPct}% now → ${d.predicted2hPct}% in 2h (${d.severity})`));
  lines.push(bullet('Dirty beds', s.dirtyBeds));
  lines.push(bullet('Discharge-ready patients', s.dischargeReady));
  lines.push('');
  if (handover) {
    lines.push('## 3) Open risks');
    lines.push(s.openAlerts && s.openAlerts.length ? s.openAlerts.map((a) => `- [${a.severity}] ${a.title}${a.department ? ` (${a.department})` : ''}`).join('\n') : '- No open alerts.');
    if (root) lines.push(`- Bottleneck: ${root}${cascade.length ? ` → ${cascade.join(' → ')}` : ''}`);
    lines.push('');
    lines.push('## 4) Pending discharges');
    lines.push(s.pendingDischarges && s.pendingDischarges.length
      ? s.pendingDischarges.map((p) => `- ${p.alias} (${p.bed}), readiness ${p.readiness}, owner ${p.doctor || 'unassigned'}${p.blocking.length ? `; blocked by: ${p.blocking.join(', ')}` : ''}`).join('\n')
      : '- None.');
    lines.push('');
    lines.push('## 5) First actions for the incoming shift');
  } else {
    lines.push('## 3) Root cause and cascade');
    lines.push(root ? `${root} is the most severe bottleneck in the flow chain (Emergency → Radiology → General Ward → HDU → ICU → OT).${cascade.length ? ` Downstream impact: ${cascade.join(', ')}.` : ' No downstream cascade detected.'}` : 'No root cause: all departments are within thresholds.');
    if (explain && root) {
      const r = depts.find((d) => d.department === root);
      const cascadeWhy = cascade
        .map((c) => {
          const d = depts.find((x) => x.department === c);
          return d ? `${c}: ${d.severityReason}.` : '';
        })
        .join(' ');
      lines.push(`Why: ${root} has ${r ? r.severityReason : 'crossed a threshold'}, and no department before it in the chain is more severe. ${cascadeWhy}`.trim());
    }
    lines.push('');
    lines.push('## 4) Predicted next 2-4 hours');
    lines.push(short2h.length ? short2h.map((d) => `- ${d.department}: short by ${d.gap2hBeds} beds in 2h${d.gap4hBeds != null ? `, ${d.gap4hBeds} in 4h` : ''}`).join('\n') : '- No bed shortage predicted in the next 2 hours.');
    for (const d of depts.filter((x) => x.predicted4hPct > x.utilizationPct)) lines.push(`- ${d.department} rising to ${d.predicted4hPct}% within 4h`);
    if (explain && s.methodology) lines.push(`How this was predicted: ${s.methodology.forecastMethod}. ${s.methodology.bedDemandMethod}.`);
    if (s.ambulanceIncoming) lines.push(`- Ambulance incoming: ETA ${s.ambulanceIncoming.eta} min, acuity ${s.ambulanceIncoming.acuity}${s.ambulanceIncoming.bedId ? `, bed ${s.ambulanceIncoming.bedId} reserved` : ''}`);
    lines.push('');
    lines.push('## 5) Recommended actions');
  }
  lines.push(
    (s.topActions || []).length
      ? s.topActions
          .map((a, i) =>
            explain
              ? `${i + 1}. ${a.action}\n   - Because: ${a.why || 'derived from the department numbers above'}\n   - Expected impact: ${a.impact}`
              : `${i + 1}. ${a.action} (expected impact: ${a.impact})`
          )
          .join('\n')
      : '1. No actions required right now.'
  );
  if (!handover) {
    lines.push('');
    lines.push('## 6) Risks and confidence');
    if (s.lastSimulation) lines.push(`- Last simulation: do nothing ${s.lastSimulation.scenarioA.avgWaitMin} min wait vs full orchestration ${s.lastSimulation.scenarioC.avgWaitMin} min (${s.lastSimulation.waitReductionPct}% reduction).`);
    lines.push(`- Thresholds: warn ${Math.round(s.thresholds.warn * 100)}%, danger ${Math.round(s.thresholds.danger * 100)}% (${s.thresholds.source}).`);
    lines.push('- Forecasts use 4 weeks of same-hour history; confidence drops when history is sparse.');
    if (explain) {
      const confs = depts.map((d) => d.forecastConfidence).filter((c) => c != null);
      if (confs.length) lines.push(`- Forecast confidence: ${Math.round(Math.min(...confs) * 100)}–${Math.round(Math.max(...confs) * 100)}%.`);
      lines.push('- The model cannot see staff skill mix, patient preferences or transport availability. Verify before acting.');
      lines.push('');
      lines.push('## 7) Evidence used');
      lines.push('- occupancy, icu, departments[].utilizationPct / predicted2hPct / gap2hBeds / severityReason');
      lines.push('- bottleneck.rootCause / cascade, topActions[].why, methodology.*, lastSimulation');
    }
  }
  return lines.join('\n');
}

function templateDoctor(s) {
  const critical = s.patients.filter((p) => p.acuity <= 2);
  const ready = s.patients.filter((p) => p.dischargeReadiness >= 60);
  return [
    '## 1) Situation summary',
    `You have ${s.patientCount} active patients: ${critical.length} critical (acuity 1-2) and ${ready.length} close to discharge.`,
    '',
    '## 2) Key numbers',
    ...s.patients.map((p) => `- ${p.alias} (${p.bed || 'no bed'}): acuity ${p.acuity}, admission probability ${p.admissionProbabilityPct}%, predicted LOS ${p.predictedLosHours}h, readiness ${p.dischargeReadiness}/100`),
    '',
    '## 3) Root cause and cascade',
    'Not applicable at the individual patient level.',
    '',
    '## 4) Predicted next 2-4 hours',
    ready.length ? ready.map((p) => `- ${p.alias} expected discharge ${p.expectedDischarge ? new Date(p.expectedDischarge).toISOString().slice(0, 16).replace('T', ' ') : 'unknown'} UTC`).join('\n') : '- No discharges expected.',
    '',
    '## 5) Recommended actions',
    ready.length ? ready.map((p, i) => `${i + 1}. Review discharge for ${p.alias}${p.blockingFactors.length ? `; clear: ${p.blockingFactors.join(', ')}` : ''} (frees ${p.bed})`).join('\n') : '1. No discharge actions right now.',
    '',
    '## 6) Risks and confidence',
    critical.length ? `- Watch ${critical.map((p) => p.alias).join(', ')} closely.` : '- No critical patients.',
    '- LOS predictions are based on historical averages for the same acuity and department.',
  ].join('\n');
}

function templateOt(s) {
  const no = s.upcoming.filter((c) => c.postOpBedAvailable === 'NO');
  return [
    '## 1) Situation summary',
    `${s.inProgress.length} surgeries in progress, ${s.upcoming.length} upcoming in the next 12h. ${s.icuOverflow.label}.`,
    '',
    '## 2) Key numbers',
    `- Post-op beds: ${Object.entries(s.postOpBeds).map(([k, v]) => `${k} ${v}`).join(', ') || 'data not available'}`,
    `- ICU demand from OT (3h): ${s.icuOverflow.icuDemand}, ICU available: ${s.icuOverflow.icuAvailable}`,
    `- Cases without a post-op bed: ${no.length}`,
    '',
    '## 3) Root cause and cascade',
    s.icuOverflow.shortageRisk ? 'ICU capacity is the constraint for post-op flow.' : 'No OT-driven bottleneck detected.',
    '',
    '## 4) Predicted next 2-4 hours',
    ...s.upcoming.slice(0, 6).map((c) => `- ${c.case} ${c.procedure} at ${new Date(c.start).toISOString().slice(11, 16)} UTC: post-op bed ${c.postOpBedAvailable}`),
    '',
    '## 5) Recommended actions',
    no.length ? no.map((c, i) => `${i + 1}. ${c.urgency === 'elective' ? 'Consider deferring' : 'Secure a bed for'} ${c.case} (${c.procedure})`).join('\n') : '1. No changes needed.',
    '',
    '## 6) Risks and confidence',
    ...s.upcoming.filter((c) => c.risk).map((c) => `- ${c.case}: ${c.risk}`),
    '- Bed availability relies on predicted release times.',
  ].join('\n');
}

function localTemplate(snapshot) {
  let body;
  if (snapshot.scope === 'doctor') body = templateDoctor(snapshot);
  else if (snapshot.scope === 'ot') body = templateOt(snapshot);
  else body = templateAdmin(snapshot, snapshot.scope === 'handover', snapshot.format === 'explain');
  return { reportText: body, provider: 'local-template', model: 'deterministic-v1' };
}

/* ───────────────────────── public API ───────────────────────── */

function snapshotSummary(s) {
  if (s.scope === 'doctor') return { patients: s.patientCount };
  if (s.scope === 'ot') return { inProgress: s.inProgress.length, upcoming: s.upcoming.length, icuShortageRisk: s.icuOverflow.shortageRisk };
  return {
    occupancyPct: s.occupancy.pct,
    icuPct: s.icu.pct,
    dirtyBeds: s.dirtyBeds,
    dischargeReady: s.dischargeReady,
    rootCause: s.bottleneck.rootCause,
    cascade: s.bottleneck.cascade,
  };
}

/**
 * @param {{ scope: 'admin'|'doctor'|'ot', format: 'short'|'detailed'|'explain'|'handover', doctorId?: string }} body
 * @param {{ id: string, role: string }} user
 */
async function generateReport(body, user) {
  const scope = body.scope || 'admin';
  const format = ['short', 'detailed', 'explain', 'handover'].includes(body.format) ? body.format : 'explain';
  checkRateLimit(user.id);

  const snapshot = await buildSnapshot(scope, format, { ...user, targetDoctorId: body.doctorId });
  snapshot.format = format;
  snapshot.methodology = methodology();
  const hashInput = JSON.stringify({ scope, format, s: { ...snapshot, generatedAt: undefined } });
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const cached = cache.get(hash);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { ...cached.value, cached: true };

  const SCOPE_HINTS = {
    admin: 'Gaps are in beds (gap2hBeds, gap4hBeds); a negative gap means spare beds.',
    doctor:
      'This is ONE doctor\'s patient list. Use criticalCount and dischargeReadyCount as given. In section 3 write "Not applicable at the patient level". ' +
      'In section 5 give one action per discharge-ready or critical patient, citing its readiness score, blockingFactors and admissionFactors.',
    ot: 'Focus on post-op bed availability (YES / NO / PREDICTED_FREE) and ICU overflow; cite each case number.',
  };
  const basePrompt = format === 'handover' ? HANDOVER_PROMPT : format === 'explain' ? EXPLAIN_PROMPT : SYSTEM_PROMPT;
  const systemPrompt = `${basePrompt} ${SCOPE_HINTS[scope] || ''}`.trim();
  // Explanations need room: the explain format gets at least 2500 output tokens
  const maxTokens = format === 'explain' ? Math.max(flowConfig.AI_REPORT_MAX_TOKENS, 2500) : flowConfig.AI_REPORT_MAX_TOKENS;
  const order = flowConfig.AI_PROVIDER === 'groq' ? [callGroq, callGemini] : [callGemini, callGroq];
  let out = null;
  const errors = [];
  for (const call of order) {
    try {
      out = await withRetry(() => call(systemPrompt, snapshot, format, maxTokens));
      break;
    } catch (err) {
      errors.push(err.message);
    }
  }
  if (!out) {
    if (errors.length) logger.info({ errors }, 'AI providers unavailable; using local template report');
    out = localTemplate(snapshot);
  }

  const saved = await db.query(
    `INSERT INTO ai_reports (scope, input_snapshot, report_text, provider, model, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
    [format === 'handover' ? 'handover' : scope, JSON.stringify(snapshot), out.reportText, out.provider, out.model, user.id]
  );

  const value = {
    id: saved.rows[0].id,
    reportText: out.reportText,
    provider: out.provider,
    model: out.model,
    generatedAt: saved.rows[0].created_at,
    scope,
    format,
    snapshotSummary: snapshotSummary(snapshot),
    snapshot,
    methodology: snapshot.methodology,
    providerErrors: out.provider === 'local-template' ? errors : undefined,
  };
  cache.set(hash, { at: Date.now(), value });
  return { ...value, cached: false };
}

module.exports = { generateReport, localTemplate, methodology, SYSTEM_PROMPT, EXPLAIN_PROMPT };
