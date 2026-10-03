/**
 * Read models for the Flow Intelligence UI. Every number shown in the UI comes from here.
 */
const db = require('../config/db');
const flowRepo = require('../repositories/flow.repo');
const flowConfig = require('../config/flowConfig');
const prediction = require('./predictionEngine.service');
const bottleneck = require('./bottleneckEngine.service');
const AppError = require('../utils/AppError');
const { BED_ZONES } = require('../config/constants');

let lastAnalysisAt = null;
function setLastAnalysisAt(ts) {
  lastAnalysisAt = ts;
}
function getLastAnalysisAt() {
  return lastAnalysisAt;
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

/* ───────────────────────── state summary ───────────────────────── */

async function getActiveAmbulance() {
  const res = await db.query(
    `SELECT id, result, created_at FROM flow_events
     WHERE event_type = 'AMBULANCE_INCOMING' AND processed = TRUE AND created_at > NOW() - INTERVAL '60 seconds'
     ORDER BY created_at DESC LIMIT 1`
  );
  return res.rows[0] ? { eventId: res.rows[0].id, ...res.rows[0].result } : null;
}

async function getStateSummary() {
  const [analysis, totals, ambulance] = await Promise.all([
    bottleneck.detectBottlenecks(),
    flowRepo.getHospitalBedTotals(),
    getActiveAmbulance(),
  ]);
  const departments = analysis.departments.map((d) => ({
    department: d.department,
    departmentId: d.departmentId,
    utilization: d.utilization,
    utilizationPct: Math.round(d.utilization * 100),
    predicted2h: d.predicted[2],
    predicted2hPct: Math.round((d.predicted[2] || 0) * 100),
    predictedGap: d.predictedGap,
    severity: d.severity,
    rootCause: d.rootCause,
    isCascade: d.isCascade,
    capacity: d.capacity,
    occupied: d.occupied,
  }));
  const root = analysis.departments.find((d) => d.rootCause);
  const allActions = analysis.departments.flatMap((d) => d.recommendedActions);
  const topAction = (root && root.recommendedActions[0]) || allActions[0] || null;
  const worstGap = analysis.departments
    .filter((d) => d.department !== 'OT')
    .sort((a, b) => b.predictedGap - a.predictedGap)[0];
  const confRes = await db.query(
    `SELECT AVG(confidence)::float AS c FROM predictions WHERE created_at > NOW() - INTERVAL '15 minutes'`
  );

  return {
    generatedAt: new Date().toISOString(),
    lastAnalysisAt: lastAnalysisAt || analysis.analyzedAt,
    occupancy: {
      occupied: totals.occupied,
      capacity: totals.capacity,
      total: totals.total,
      pct: pct(totals.occupied, totals.capacity),
    },
    icu: { occupied: totals.icu_occupied, total: totals.icu_total, pct: pct(totals.icu_occupied, totals.icu_total - totals.icu_maintenance) },
    dirtyBeds: totals.cleaning,
    reservedBeds: totals.reserved,
    availableBeds: totals.available,
    dischargeReady: analysis.dischargeCandidates.readyCount,
    departments,
    rootCause: analysis.rootCause,
    cascade: analysis.cascade,
    topAction,
    actionsCount: allActions.length,
    shortage2h: worstGap
      ? {
          department: worstGap.department,
          gap: worstGap.predictedGap,
          shortage: worstGap.predictedGap > 0,
          confidence: confRes.rows[0].c != null ? Math.round(confRes.rows[0].c * 100) / 100 : null,
        }
      : null,
    thresholds: analysis.thresholds,
    ambulance,
  };
}

/* ───────────────────────── bed map ───────────────────────── */

const MAP_STATUS = { available: 'available', occupied: 'occupied', cleaning: 'cleaning', reserved: 'reserved', maintenance: 'blocked' };
const OT_STATUS = { available: 'available', in_surgery: 'occupied', emergency: 'occupied', cleaning: 'cleaning', reserved: 'reserved', maintenance: 'blocked' };

function emptyCounts() {
  return { available: 0, occupied: 0, cleaning: 0, reserved: 0, blocked: 0, total: 0 };
}

async function getBedMap() {
  const [bedsRes, roomsRes, staffing, equipRes] = await Promise.all([
    db.query(`
      SELECT b.id, b.status, b.type, b.ward, b.floor, b.room_number, b.department_id, d.name AS department,
             ${flowRepo.ZONE_SQL} AS zone,
             b.expected_release_time, b.release_confidence, b.last_cleaned_at, b.updated_at,
             p.id AS patient_uuid, p.patient_id AS patient_alias, p.acuity, p.admission_date, p.status AS patient_status,
             u.full_name AS doctor_name
      FROM beds b
      LEFT JOIN departments d ON d.id = b.department_id
      LEFT JOIN patients p ON p.id = b.patient_id
      LEFT JOIN users u ON u.id = p.assigned_doctor_id
      ORDER BY b.id
    `),
    db.query(`
      SELECT r.id, r.name, r.status, r.floor, r.next_available, r.last_cleaned_at,
             c.case_number, c.procedure_name, c.scheduled_end, c.urgency, su.full_name AS surgeon_name,
             p.patient_id AS patient_alias, p.acuity
      FROM ot_rooms r
      LEFT JOIN ot_cases c ON c.ot_room_id = r.id AND c.status = 'in_progress'
      LEFT JOIN users su ON su.id = c.primary_surgeon_id
      LEFT JOIN patients p ON p.id = c.patient_id
      ORDER BY r.id
    `),
    flowRepo.getNurseStaffing(),
    db.query(`SELECT COUNT(*) FILTER (WHERE status = 'available')::int AS available, COUNT(*)::int AS total FROM equipment`),
  ]);

  const zones = new Map(BED_ZONES.map((z) => [z, { zone: z, tiles: [], counts: emptyCounts() }]));
  for (const b of bedsRes.rows) {
    const status = MAP_STATUS[b.status] || 'blocked';
    const zone = zones.get(b.zone) || zones.get('General Ward');
    zone.tiles.push({
      id: b.id,
      kind: 'bed',
      status,
      rawStatus: b.status,
      type: b.type,
      ward: b.ward,
      floor: b.floor,
      room: b.room_number,
      department: b.department,
      patientId: b.patient_uuid,
      patientAlias: b.patient_alias,
      acuity: b.acuity,
      patientStatus: b.patient_status,
      admittedAt: b.admission_date,
      expectedRelease: b.expected_release_time,
      releaseConfidence: b.release_confidence != null ? Number(b.release_confidence) : null,
      doctorName: b.doctor_name,
      lastCleanedAt: b.last_cleaned_at,
      cleaningSince: b.status === 'cleaning' ? b.updated_at : null,
    });
    zone.counts[status] += 1;
    zone.counts.total += 1;
  }
  const ot = zones.get('OT');
  for (const r of roomsRes.rows) {
    const status = OT_STATUS[r.status] || 'blocked';
    ot.tiles.push({
      id: `THEATRE ${r.id}`,
      roomId: r.id,
      kind: 'ot_room',
      name: r.name,
      status,
      rawStatus: r.status,
      floor: r.floor,
      patientAlias: r.patient_alias,
      acuity: r.acuity,
      caseNumber: r.case_number,
      procedure: r.procedure_name,
      doctorName: r.surgeon_name,
      expectedRelease: r.scheduled_end || r.next_available,
      lastCleanedAt: r.last_cleaned_at,
    });
    ot.counts[status] += 1;
    ot.counts.total += 1;
  }

  const zoneList = [...zones.values()].filter((z) => z.tiles.length > 0);
  const bedZones = zoneList.filter((z) => z.zone !== 'OT');
  const totalBeds = bedZones.reduce((s, z) => s + z.counts.total - z.counts.blocked, 0);
  const occupied = bedZones.reduce((s, z) => s + z.counts.occupied, 0);
  const nurses = staffing.reduce((s, d) => s + d.nurses_on_shift + d.float_on_shift, 0);
  const inSurgery = roomsRes.rows.filter((r) => r.status === 'in_surgery' || r.status === 'emergency').length;
  const cleaningTiles = bedZones.flatMap((z) => z.tiles.filter((t) => t.status === 'cleaning'));
  const oldestCleaningMin = cleaningTiles.length
    ? Math.round(Math.max(...cleaningTiles.map((t) => (Date.now() - new Date(t.cleaningSince).getTime()) / 60000)))
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    header: {
      occupied,
      totalBeds,
      occupancyPct: pct(occupied, totalBeds),
      flowActive: Boolean(lastAnalysisAt) && Date.now() - new Date(lastAnalysisAt).getTime() < flowConfig.FLOW_ANALYSIS_INTERVAL_MS * 3,
    },
    legend: ['available', 'occupied', 'cleaning', 'reserved', 'blocked'].map((s) => ({
      status: s,
      count: bedZones.reduce((acc, z) => acc + z.counts[s], 0),
    })),
    zones: zoneList,
    info: {
      inTransit: { reservedBeds: bedZones.reduce((s, z) => s + z.counts.reserved, 0), inSurgery },
      nurseRatio: { patients: occupied, nurses, ratio: nurses > 0 ? round1(occupied / nurses) : null },
      cleaningQueue: { beds: cleaningTiles.length, oldestMinutes: oldestCleaningMin },
      equipment: equipRes.rows[0],
    },
  };
}

/* ───────────────────────── dashboard numbers ───────────────────────── */

async function snapshotSeries(field, hours = 24) {
  const res = await db.query(
    `SELECT ts, ${field}::float AS value FROM kpi_snapshots
     WHERE ts >= NOW() - ($1 || ' hours')::interval AND ${field} IS NOT NULL
     ORDER BY ts ASC`,
    [String(hours)]
  );
  return res.rows.map((r) => ({ ts: r.ts, value: round1(r.value) }));
}

function deltaFromSeries(series) {
  if (!series || series.length < 2) return null;
  const last = series[series.length - 1];
  const target = new Date(last.ts).getTime() - 3600 * 1000;
  let ref = series[0];
  for (const p of series) if (new Date(p.ts).getTime() <= target) ref = p;
  return round1(last.value - ref.value);
}

function utilStatus(p) {
  if (p == null) return 'neutral';
  if (p > 90) return 'danger';
  if (p >= 70) return 'warning';
  return 'success';
}

async function adminNumbers() {
  const [summary, occSeries, icuSeries, waitSeries, otSeries, ed] = await Promise.all([
    getStateSummary(),
    snapshotSeries('bed_occupancy_pct'),
    snapshotSeries('icu_occupancy_pct'),
    snapshotSeries('avg_wait_minutes'),
    snapshotSeries('ot_utilization_pct'),
    flowRepo.getDepartmentByName('Emergency'),
  ]);
  const forecast = await prediction.forecastArrivals(ed ? ed.id : null, 6);
  const edDemand = ed ? await prediction.projectBedDemandAll(ed.id) : [];
  const latestOt = await db.query(`SELECT
      COUNT(*) FILTER (WHERE status IN ('in_surgery','emergency'))::int AS busy, COUNT(*)::int AS total FROM ot_rooms`);
  const otPct = pct(latestOt.rows[0].busy, latestOt.rows[0].total);
  const latestWait = waitSeries.length ? waitSeries[waitSeries.length - 1].value : null;
  const arrivals6h = round1(forecast.predicted.reduce((s, v) => s + v, 0));

  const kpis = [
    { key: 'occupancy', label: 'Bed occupancy', value: summary.occupancy.pct, unit: '%', sub: `${summary.occupancy.occupied}/${summary.occupancy.capacity} beds`, delta: deltaFromSeries(occSeries), deltaUnit: 'pts', status: utilStatus(summary.occupancy.pct), seriesKey: 'occupancy', chartType: 'line' },
    { key: 'icu', label: 'ICU occupancy', value: summary.icu.pct, unit: '%', sub: `${summary.icu.occupied}/${summary.icu.total} beds`, delta: deltaFromSeries(icuSeries), deltaUnit: 'pts', status: utilStatus(summary.icu.pct), seriesKey: 'icu', chartType: 'line' },
    { key: 'edArrivals', label: 'ED arrivals next 6h', value: arrivals6h, unit: '', sub: `confidence ${Math.round(forecast.confidence * 100)}%`, delta: null, status: 'neutral', seriesKey: 'edForecast', chartType: 'band' },
    { key: 'edDemand', label: 'ED bed gap in 2h', value: edDemand[1] ? edDemand[1].gap : 0, unit: ' beds', sub: edDemand[1] ? `demand ${edDemand[1].demand} vs cap ${edDemand[1].capacity}` : '', delta: null, status: edDemand[1] && edDemand[1].gap > 0 ? 'danger' : 'success', seriesKey: 'edDemand', chartType: 'demandCapacity' },
    { key: 'avgWait', label: 'Avg ED wait', value: latestWait, unit: ' min', sub: 'from KPI snapshots', delta: deltaFromSeries(waitSeries), deltaUnit: 'min', invertDelta: true, status: latestWait == null ? 'neutral' : latestWait > 45 ? 'danger' : latestWait > 25 ? 'warning' : 'success', seriesKey: 'avgWait', chartType: 'line' },
    { key: 'dirtyBeds', label: 'Dirty beds', value: summary.dirtyBeds, unit: '', sub: 'awaiting cleaning', delta: null, status: summary.dirtyBeds > 2 ? 'warning' : 'success', seriesKey: null },
    { key: 'dischargeReady', label: 'Discharge-ready', value: summary.dischargeReady, unit: '', sub: `≥ ${Math.round(flowConfig.DISCHARGE_NUDGE_THRESHOLD * 100)}% readiness`, delta: null, status: 'neutral', seriesKey: null },
    { key: 'otUtil', label: 'OT utilization', value: otPct, unit: '%', sub: `${latestOt.rows[0].busy}/${latestOt.rows[0].total} theatres`, delta: deltaFromSeries(otSeries), deltaUnit: 'pts', status: utilStatus(otPct), seriesKey: 'otUtil', chartType: 'line' },
  ];

  return {
    scope: 'admin',
    kpis,
    series: {
      occupancy: occSeries,
      icu: icuSeries,
      avgWait: waitSeries,
      otUtil: otSeries,
      edForecast: forecast.timestamps.map((ts, i) => ({ ts, value: forecast.predicted[i], lower: forecast.lower[i], upper: forecast.upper[i] })),
      edDemand: edDemand.map((d) => ({
        ts: new Date(Date.now() + d.horizon * 3600 * 1000).toISOString(),
        horizon: d.horizon,
        value: d.demand,
        capacity: d.capacity,
        lower: null,
        upper: null,
      })),
    },
  };
}

async function doctorNumbers(doctorId) {
  if (!doctorId) throw new AppError('doctorId required for doctor scope', 400, 'VALIDATION_ERROR');
  const [patients, candidates, pendingOt, census] = await Promise.all([
    flowRepo.getActivePatients({ doctorId }),
    prediction.getDischargeCandidates({ doctorId }),
    db.query(`SELECT COUNT(*)::int AS n FROM ot_requests WHERE doctor_id = $1 AND status = 'pending'`, [doctorId]),
    db.query(
      `SELECT day::date AS ts,
              (SELECT COUNT(*) FROM patients p
               WHERE p.assigned_doctor_id = $1 AND p.admission_date <= day + INTERVAL '1 day'
                 AND (p.discharge_date IS NULL OR p.discharge_date > day + INTERVAL '1 day'))::int AS value
       FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS day
       ORDER BY day`,
      [doctorId]
    ),
  ]);
  const critical = patients.filter((p) => (p.acuity || 5) <= 2).length;
  const censusSeries = census.rows.map((r) => ({ ts: r.ts, value: r.value }));

  return {
    scope: 'doctor',
    kpis: [
      { key: 'myPatients', label: 'My patients', value: patients.length, unit: '', sub: 'active in care', delta: censusSeries.length > 1 ? censusSeries[censusSeries.length - 1].value - censusSeries[censusSeries.length - 2].value : null, deltaUnit: 'vs yesterday', status: 'neutral', seriesKey: 'myCensus', chartType: 'bar' },
      { key: 'critical', label: 'Critical (acuity 1-2)', value: critical, unit: '', sub: 'needs close watch', delta: null, status: critical > 0 ? 'danger' : 'success', seriesKey: null },
      { key: 'dischargeReady', label: 'Discharge-ready', value: candidates.readyCount, unit: '', sub: 'sign to free beds', delta: null, status: candidates.readyCount > 0 ? 'warning' : 'neutral', seriesKey: 'myReadiness', chartType: 'bar' },
      { key: 'pendingOt', label: 'Pending OT requests', value: pendingOt.rows[0].n, unit: '', sub: 'awaiting approval', delta: null, status: 'neutral', seriesKey: null },
    ],
    series: {
      myCensus: censusSeries,
      myReadiness: candidates.candidates.map((c) => ({ ts: c.alias, value: c.score, label: c.alias })),
    },
  };
}

async function otNumbers() {
  const [cases, postOp, otSeries, byHour, impact] = await Promise.all([
    db.query(`
      SELECT COUNT(*) FILTER (WHERE scheduled_start::date = CURRENT_DATE)::int AS today,
             COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
             COUNT(*) FILTER (WHERE status = 'completed' AND actual_end::date = CURRENT_DATE)::int AS completed
      FROM ot_cases`),
    db.query(`SELECT COUNT(*) FILTER (WHERE status = 'available')::int AS available, COUNT(*)::int AS total FROM beds WHERE type = 'post_op'`),
    snapshotSeries('ot_utilization_pct'),
    db.query(`
      SELECT date_trunc('hour', scheduled_start) AS ts, COUNT(*)::int AS value
      FROM ot_cases WHERE scheduled_start::date = CURRENT_DATE
      GROUP BY 1 ORDER BY 1`),
    getOtImpact(),
  ]);
  const c = cases.rows[0];
  return {
    scope: 'ot',
    kpis: [
      { key: 'casesToday', label: 'Cases today', value: c.today, unit: '', sub: `${c.completed} completed`, delta: null, status: 'neutral', seriesKey: 'casesByHour', chartType: 'bar' },
      { key: 'inProgress', label: 'In progress', value: c.in_progress, unit: '', sub: `${impact.holdingPostOpBeds} holding post-op beds`, delta: null, status: 'neutral', seriesKey: null },
      { key: 'postOpAvailable', label: 'Post-op beds free', value: postOp.rows[0].available, unit: '', sub: `of ${postOp.rows[0].total}`, delta: null, status: postOp.rows[0].available === 0 ? 'danger' : postOp.rows[0].available < 2 ? 'warning' : 'success', seriesKey: null },
      { key: 'icuDemand3h', label: 'ICU demand from OT (3h)', value: impact.overflow.icuDemand, unit: '', sub: `${impact.overflow.icuAvailable} ICU beds free`, delta: null, status: impact.overflow.shortageRisk ? 'danger' : 'success', seriesKey: null },
      { key: 'otUtil', label: 'OT utilization', value: otSeries.length ? otSeries[otSeries.length - 1].value : null, unit: '%', sub: 'snapshot', delta: deltaFromSeries(otSeries), deltaUnit: 'pts', status: utilStatus(otSeries.length ? otSeries[otSeries.length - 1].value : null), seriesKey: 'otUtil', chartType: 'line' },
    ],
    series: {
      otUtil: otSeries,
      casesByHour: byHour.rows.map((r) => ({ ts: r.ts, value: r.value })),
    },
  };
}

async function getDashboardNumbers(scope, user, query = {}) {
  const role = user.role || user.userType;
  const s = scope || (role === 'doctor' ? 'doctor' : role === 'ot_manager' ? 'ot' : 'admin');
  if (s === 'admin') {
    if (role !== 'admin') throw new AppError('Admin scope requires admin role', 403, 'FORBIDDEN');
    return adminNumbers();
  }
  if (s === 'doctor') {
    const doctorId = role === 'doctor' ? user.id : query.doctorId;
    if (role !== 'doctor' && role !== 'admin') throw new AppError('Doctor scope not permitted', 403, 'FORBIDDEN');
    return doctorNumbers(doctorId);
  }
  if (s === 'ot') {
    if (role !== 'ot_manager' && role !== 'admin') throw new AppError('OT scope not permitted', 403, 'FORBIDDEN');
    return otNumbers();
  }
  throw new AppError('scope must be admin, doctor or ot', 400, 'VALIDATION_ERROR');
}

/* ───────────────────────── OT flow impact ───────────────────────── */

async function getOtImpact() {
  const [inProgress, upcoming, bedPools, releasing] = await Promise.all([
    db.query(`
      SELECT c.id, c.case_number, c.procedure_name, c.ot_room_id, r.name AS room_name, c.scheduled_end,
             c.post_op_bed_required, c.post_op_bed_id, c.post_op_ward, c.urgency, p.patient_id AS alias
      FROM ot_cases c LEFT JOIN ot_rooms r ON r.id = c.ot_room_id LEFT JOIN patients p ON p.id = c.patient_id
      WHERE c.status = 'in_progress' ORDER BY c.scheduled_end`),
    db.query(`
      SELECT c.id, c.case_number, c.procedure_name, c.ot_room_id, r.name AS room_name, c.scheduled_start, c.scheduled_end,
             c.urgency, c.status, c.post_op_bed_required, c.post_op_bed_id, c.post_op_ward,
             u.full_name AS surgeon_name, p.patient_id AS alias, p.acuity
      FROM ot_cases c
      LEFT JOIN ot_rooms r ON r.id = c.ot_room_id
      LEFT JOIN users u ON u.id = c.primary_surgeon_id
      LEFT JOIN patients p ON p.id = c.patient_id
      WHERE c.status IN ('scheduled', 'delayed', 'emergency_inserted') AND c.scheduled_start <= NOW() + INTERVAL '12 hours'
      ORDER BY c.scheduled_start`),
    db.query(`SELECT type, COUNT(*) FILTER (WHERE status = 'available')::int AS available FROM beds WHERE type IN ('post_op', 'icu') GROUP BY type`),
    db.query(`
      SELECT id, type, expected_release_time FROM beds
      WHERE type IN ('post_op', 'icu') AND status = 'occupied' AND expected_release_time IS NOT NULL
      ORDER BY expected_release_time`),
  ]);

  const pool = { post_op: 0, icu: 0 };
  for (const r of bedPools.rows) pool[r.type] = r.available;
  const releaseQueue = { post_op: [], icu: [] };
  for (const r of releasing.rows) releaseQueue[r.type].push(new Date(r.expected_release_time));

  const needsIcu = (c) => /icu/i.test(c.post_op_ward || '') || c.urgency === 'critical';

  // In-progress cases claim beds first (they come out soonest)
  for (const c of inProgress.rows) {
    if (!c.post_op_bed_required || c.post_op_bed_id) continue;
    const t = needsIcu(c) ? 'icu' : 'post_op';
    if (pool[t] > 0) pool[t] -= 1;
    else if (releaseQueue[t].length) releaseQueue[t].shift();
  }

  const cases = upcoming.rows.map((c) => {
    const type = needsIcu(c) ? 'icu' : 'post_op';
    let availability = 'N/A';
    let risk = null;
    if (c.post_op_bed_required) {
      if (c.post_op_bed_id) availability = 'YES';
      else if (pool[type] > 0) {
        pool[type] -= 1;
        availability = 'YES';
      } else if (releaseQueue[type].length && releaseQueue[type][0] <= new Date(c.scheduled_end)) {
        releaseQueue[type].shift();
        availability = 'PREDICTED_FREE';
        risk = `Depends on a ${type === 'icu' ? 'ICU' : 'post-op'} bed releasing before ${new Date(c.scheduled_end).toISOString().slice(11, 16)} UTC`;
      } else {
        availability = 'NO';
        risk = `No ${type === 'icu' ? 'ICU' : 'post-op'} bed expected; consider deferring${c.urgency === 'elective' ? ' (elective)' : ''}`;
      }
    }
    return {
      caseId: c.id,
      caseNumber: c.case_number,
      procedure: c.procedure_name,
      room: c.room_name,
      surgeon: c.surgeon_name,
      alias: c.alias,
      acuity: c.acuity,
      urgency: c.urgency,
      status: c.status,
      scheduledStart: c.scheduled_start,
      scheduledEnd: c.scheduled_end,
      postOpRequired: c.post_op_bed_required,
      postOpType: type,
      availability,
      risk,
    };
  });

  const in3h = Date.now() + 3 * 3600 * 1000;
  const icuDemand =
    inProgress.rows.filter((c) => c.post_op_bed_required && needsIcu(c)).length +
    upcoming.rows.filter((c) => c.post_op_bed_required && needsIcu(c) && new Date(c.scheduled_end).getTime() <= in3h).length;
  const icuAvailable = bedPools.rows.find((r) => r.type === 'icu')?.available || 0;

  return {
    generatedAt: new Date().toISOString(),
    holdingPostOpBeds: inProgress.rows.filter((c) => c.post_op_bed_required).length,
    inProgress: inProgress.rows.map((c) => ({
      caseId: c.id,
      caseNumber: c.case_number,
      procedure: c.procedure_name,
      room: c.room_name,
      alias: c.alias,
      expectedEnd: c.scheduled_end,
      postOpRequired: c.post_op_bed_required,
      postOpBedId: c.post_op_bed_id,
      postOpType: needsIcu(c) ? 'icu' : 'post_op',
    })),
    upcoming: cases,
    overflow: {
      icuDemand,
      icuAvailable,
      shortageRisk: icuDemand > icuAvailable,
      label: `ICU demand ${icuDemand} | available ${icuAvailable}${icuDemand > icuAvailable ? ' | SHORTAGE RISK' : ''}`,
    },
  };
}

/* ───────────────────────── doctor patients ───────────────────────── */

async function getDoctorPatients(doctorId) {
  const res = await db.query(
    `SELECT p.id, p.patient_id AS alias, p.status, p.acuity, p.bed_id, b.ward, b.type AS bed_type,
            COALESCE(b.department_id, p.department_id) AS department_id, d.name AS department_name,
            p.admission_date, p.expected_discharge, p.discharge_date, p.waiting_since, p.created_at,
            p.requires_icu, p.requires_isolation, p.requires_imaging, p.requires_ot,
            COALESCE(p.pending_tasks, '{}') AS pending_tasks
     FROM patients p
     LEFT JOIN beds b ON b.id = p.bed_id
     LEFT JOIN departments d ON d.id = COALESCE(b.department_id, p.department_id)
     WHERE p.assigned_doctor_id = $1 AND p.status <> 'discharged'
     ORDER BY p.acuity ASC NULLS LAST, p.admission_date ASC NULLS LAST`,
    [doctorId]
  );
  const losTable = await prediction.getLosTable();
  return res.rows.map((p) => {
    const adm = prediction.estimateAdmissionProbability({ ...p, arrivalTime: p.waiting_since || p.admission_date || p.created_at });
    const los = prediction.predictLosFromTable(p, losTable);
    const readiness = prediction.scoreDischargeReadiness(p);
    return {
      patientId: p.id,
      alias: p.alias,
      status: p.status,
      acuity: p.acuity,
      bedId: p.bed_id,
      ward: p.ward,
      department: p.department_name,
      admittedAt: p.admission_date,
      expectedDischarge: p.expected_discharge || los.expectedReleaseTime,
      admissionProbability: adm.probability,
      factors: [...adm.factors].sort((a, b) => b.impact - a.impact).slice(0, 3),
      los,
      readiness,
      requiresOt: p.requires_ot,
    };
  });
}

/* ───────────────────────── roster / housekeeping / audit ───────────────────────── */

const PRESENCE = { available: 'online', in_consultation: 'online', in_surgery: 'away', on_break: 'away', emergency: 'away', off_duty: 'offline' };

async function getStaffRoster() {
  const [docs, staff] = await Promise.all([
    db.query(`
      SELECT d.id, u.full_name, d.specialization, d.status, d.current_location, d.surgeries_today, d.is_on_call,
             dep.name AS department
      FROM doctors d JOIN users u ON u.id = d.id LEFT JOIN departments dep ON dep.id = d.department_id
      ORDER BY dep.name, u.full_name`),
    flowRepo.getNurseStaffing(),
  ]);
  const doctors = docs.rows.map((d) => ({
    id: d.id,
    name: d.full_name,
    specialization: d.specialization,
    department: d.department,
    status: d.status,
    presence: PRESENCE[d.status] || 'offline',
    location: d.current_location,
    surgeriesToday: d.surgeries_today,
    onCall: d.is_on_call,
  }));
  const departments = staff
    .map((s) => ({
      departmentId: s.department_id,
      department: s.department_name,
      doctors: doctors.filter((d) => d.department === s.department_name && d.presence !== 'offline').length,
      nurses: s.nurses_on_shift,
      staff: s.housekeeping_on_shift,
    }))
    .filter((d) => d.doctors + d.nurses + d.staff > 0);
  return {
    doctors,
    departments,
    totals: {
      doctorsOnline: doctors.filter((d) => d.presence === 'online').length,
      doctorsAway: doctors.filter((d) => d.presence === 'away').length,
      nursesOnShift: departments.reduce((s, d) => s + d.nurses, 0),
    },
  };
}

async function getHousekeepingBoard() {
  const res = await db.query(`
    SELECT b.id, b.status, b.ward, b.floor, b.type, ${flowRepo.ZONE_SQL} AS zone, b.updated_at, b.last_cleaned_at
    FROM beds b LEFT JOIN departments d ON d.id = b.department_id
    WHERE b.status = 'cleaning' OR (b.status = 'available' AND b.last_cleaned_at > NOW() - INTERVAL '4 hours')
    ORDER BY b.status DESC, b.updated_at ASC`);
  const now = Date.now();
  const cleaning = res.rows
    .filter((b) => b.status === 'cleaning')
    .map((b) => ({ ...b, waitingMinutes: Math.round((now - new Date(b.updated_at).getTime()) / 60000) }));
  const ready = res.rows
    .filter((b) => b.status === 'available')
    .map((b) => ({ ...b, cleanedMinutesAgo: Math.round((now - new Date(b.last_cleaned_at).getTime()) / 60000) }));
  const totals = await flowRepo.getHospitalBedTotals();
  return {
    cleaning,
    ready,
    counts: { dirty: cleaning.length, cleanedLast4h: ready.length, available: totals.available, overdue: cleaning.filter((b) => b.waitingMinutes > 45).length },
  };
}

async function getAuditLog({ eventType, limit = 100, offset = 0 } = {}) {
  const values = [];
  let where = '';
  if (eventType) {
    values.push(eventType);
    where = 'WHERE e.event_type = $1';
  }
  values.push(Math.min(500, Number(limit) || 100));
  values.push(Number(offset) || 0);
  const res = await db.query(
    `SELECT e.id, e.event_type, e.payload, e.processed, e.result, e.created_at,
            u.full_name AS user_name, u.user_type
     FROM flow_events e LEFT JOIN users u ON u.id = e.created_by
     ${where}
     ORDER BY e.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  const types = await db.query('SELECT event_type, COUNT(*)::int AS n FROM flow_events GROUP BY event_type ORDER BY n DESC');
  return {
    events: res.rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      payload: r.payload,
      processed: r.processed,
      error: r.result && r.result.error ? r.result.error : null,
      result: r.result,
      createdAt: r.created_at,
      user: r.user_name || 'system',
      userType: r.user_type || 'system',
    })),
    types: types.rows,
  };
}

async function getBedsAboutToFree(hours = 4) {
  const res = await db.query(
    `SELECT b.id, b.ward, b.type, ${flowRepo.ZONE_SQL} AS zone, b.expected_release_time, b.release_confidence,
            p.patient_id AS alias, p.id AS patient_id
     FROM beds b LEFT JOIN departments d ON d.id = b.department_id LEFT JOIN patients p ON p.id = b.patient_id
     WHERE b.status = 'occupied' AND b.expected_release_time IS NOT NULL
       AND b.expected_release_time <= NOW() + ($1 || ' hours')::interval
     ORDER BY b.expected_release_time`,
    [String(hours)]
  );
  const pre = await db.query(
    `SELECT payload->>'bedId' AS bed_id, payload->>'alias' AS alias FROM flow_recommendations
     WHERE type = 'pre_assignment' AND status IN ('pending', 'approved')`
  );
  const preMap = new Map(pre.rows.map((r) => [r.bed_id, r.alias]));
  return res.rows.map((b) => ({
    bedId: b.id,
    ward: b.ward,
    zone: b.zone,
    type: b.type,
    expectedFreeAt: b.expected_release_time,
    minutesUntilFree: Math.round((new Date(b.expected_release_time).getTime() - Date.now()) / 60000),
    confidence: b.release_confidence != null ? Number(b.release_confidence) : null,
    currentAlias: b.alias,
    preAssignedTo: preMap.get(b.id) || null,
  }));
}

module.exports = {
  setLastAnalysisAt,
  getLastAnalysisAt,
  getStateSummary,
  getBedMap,
  getDashboardNumbers,
  getOtImpact,
  getDoctorPatients,
  getStaffRoster,
  getHousekeepingBoard,
  getAuditLog,
  getBedsAboutToFree,
  getActiveAmbulance,
};
