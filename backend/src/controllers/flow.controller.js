const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/response');
const flowConfig = require('../config/flowConfig');
const flowRepo = require('../repositories/flow.repo');
const prediction = require('../services/predictionEngine.service');
const bottleneck = require('../services/bottleneckEngine.service');
const stateEngine = require('../services/stateEngine.service');
const simulator = require('../services/whatIfSimulator.service');
const dashboard = require('../services/flowDashboard.service');
const actions = require('../services/flowActions.service');
const aiReport = require('../services/aiReport.service');
const { FLOW_EVENT_TYPES } = require('../config/constants');

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', r.error.flatten());
  return r.data;
}

const eventSchema = z.object({
  eventType: z.enum(Object.values(FLOW_EVENT_TYPES)),
  payload: z.record(z.any()).default({}),
});

const simulateSchema = z.object({
  arrivalIncreasePct: z.coerce.number().min(0).max(200).default(0),
  nursesAbsent: z.coerce.number().int().min(0).max(50).default(0),
  icuBedsClosed: z.coerce.number().int().min(0).max(20).default(0),
});

const aiSchema = z.object({
  scope: z.enum(['admin', 'doctor', 'ot']).default('admin'),
  format: z.enum(['short', 'detailed', 'explain', 'handover']).default('explain'),
  doctorId: z.string().uuid().optional(),
});

const batchSchema = z.object({
  actions: z.array(z.record(z.any())).min(1).max(25),
  source: z.string().max(30).optional(),
  autoApprove: z.boolean().optional(),
});

async function resolveDepartmentId(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return null;
  if (/^\d+$/.test(String(raw))) return Number(raw);
  const d = await flowRepo.getDepartmentByName(String(raw));
  if (!d) throw new AppError(`Unknown department '${raw}'`, 404, 'NOT_FOUND');
  return d.id;
}

module.exports = {
  /* ── Phase 1 ── */
  postEvent: asyncHandler(async (req, res) => {
    const { eventType, payload } = parse(eventSchema, req.body);
    ok(res, await stateEngine.processEvent(eventType, payload, req.user), {}, 201);
  }),

  /* ── Phase 2 ── */
  getForecast: asyncHandler(async (req, res) => {
    const departmentId = await resolveDepartmentId(req.query.department);
    const horizon = Number(req.query.horizon) || flowConfig.PREDICTION_HORIZON_HOURS;
    ok(res, await prediction.forecastArrivals(departmentId, horizon));
  }),

  getAdmissionProbability: asyncHandler(async (req, res) => {
    ok(res, await prediction.admissionProbabilityForPatient(req.params.patientId));
  }),

  getLos: asyncHandler(async (req, res) => {
    ok(res, await prediction.predictLOS(req.params.patientId));
  }),

  getBedDemand: asyncHandler(async (req, res) => {
    const departmentId = await resolveDepartmentId(req.query.department);
    if (!departmentId) {
      const depts = await flowRepo.getDepartmentBedStats();
      const out = [];
      for (const d of depts.filter((x) => x.capacity > 0)) {
        out.push({ department: d.name, departmentId: d.id, projections: await prediction.projectBedDemandAll(d.id) });
      }
      return ok(res, out);
    }
    if (req.query.horizon) return ok(res, await prediction.projectBedDemand(departmentId, Number(req.query.horizon)));
    ok(res, await prediction.projectBedDemandAll(departmentId));
  }),

  getDischargeCandidates: asyncHandler(async (req, res) => {
    const doctorId = req.user.role === 'doctor' ? req.user.id : undefined;
    ok(res, await prediction.getDischargeCandidates({ doctorId }));
  }),

  /* ── Phase 3 ── */
  getBottlenecks: asyncHandler(async (req, res) => {
    const analysis = await bottleneck.detectBottlenecks();
    let list = bottleneck.toBottleneckList(analysis);
    if (req.query.severity) list = list.filter((b) => b.severity === String(req.query.severity).toUpperCase());
    ok(res, { analyzedAt: analysis.analyzedAt, rootCause: analysis.rootCause, cascade: analysis.cascade, thresholds: analysis.thresholds, bottlenecks: list });
  }),

  getStateSummary: asyncHandler(async (req, res) => ok(res, await dashboard.getStateSummary())),

  getBedMap: asyncHandler(async (req, res) => ok(res, await dashboard.getBedMap())),

  getDashboardNumbers: asyncHandler(async (req, res) => {
    ok(res, await dashboard.getDashboardNumbers(req.query.scope, req.user, req.query));
  }),

  /* ── Phase 4 ── */
  postSimulate: asyncHandler(async (req, res) => {
    ok(res, await simulator.runSimulation(parse(simulateSchema, req.body || {}), req.user), {}, 201);
  }),

  getSimulationHistory: asyncHandler(async (req, res) => ok(res, await simulator.getHistory(req.query.limit))),

  applySimulation: asyncHandler(async (req, res) => ok(res, await actions.applySimulationPlan(req.params.id, req.user))),

  /* ── Workflow actions ── */
  listRecommendations: asyncHandler(async (req, res) => {
    ok(res, await flowRepo.listRecommendations({ status: req.query.status, limit: Math.min(200, Number(req.query.limit) || 50) }));
  }),

  postRecommendationBatch: asyncHandler(async (req, res) => {
    const body = parse(batchSchema, req.body);
    // Only admins may auto-approve; other roles submit for approval
    if (req.user.role !== 'admin') body.autoApprove = false;
    ok(res, await actions.createRecommendationBatch(body, req.user), {}, 201);
  }),

  patchRecommendation: asyncHandler(async (req, res) => {
    ok(res, await actions.decideRecommendation(req.params.id, req.body && req.body.status, req.user));
  }),

  postDischargeNudge: asyncHandler(async (req, res) => {
    ok(res, await actions.sendDischargeNudges({ patientIds: (req.body && req.body.patientIds) || [] }, req.user));
  }),

  postMarkReady: asyncHandler(async (req, res) => ok(res, await actions.markDischargeReady(req.params.patientId, req.user))),

  getBedsAboutToFree: asyncHandler(async (req, res) => ok(res, await dashboard.getBedsAboutToFree(Number(req.query.hours) || 4))),

  getWaitingPatients: asyncHandler(async (req, res) => ok(res, await flowRepo.getWaitingPatients())),

  postPreAssign: asyncHandler(async (req, res) => {
    if (!req.body || !req.body.patientId) throw new AppError('patientId required', 400, 'VALIDATION_ERROR');
    ok(res, await actions.preAssignBed(req.params.bedId, req.body.patientId, req.user), {}, 201);
  }),

  getOtImpact: asyncHandler(async (req, res) => ok(res, await dashboard.getOtImpact())),

  getDoctorPatients: asyncHandler(async (req, res) => {
    const doctorId = req.user.role === 'doctor' ? req.user.id : req.query.doctorId;
    if (!doctorId) throw new AppError('doctorId required', 400, 'VALIDATION_ERROR');
    ok(res, await dashboard.getDoctorPatients(doctorId));
  }),

  getStaffRoster: asyncHandler(async (req, res) => ok(res, await dashboard.getStaffRoster())),

  getHousekeeping: asyncHandler(async (req, res) => ok(res, await dashboard.getHousekeepingBoard())),

  getAudit: asyncHandler(async (req, res) => {
    ok(res, await dashboard.getAuditLog({ eventType: req.query.type, limit: req.query.limit, offset: req.query.offset }));
  }),

  getConfig: asyncHandler(async (req, res) => {
    ok(res, {
      warn: flowConfig.BOTTLENECK_WARN_THRESHOLD,
      danger: flowConfig.BOTTLENECK_DANGER_THRESHOLD,
      thresholdSource: flowConfig.thresholdSource,
      dischargeNudgeThreshold: flowConfig.DISCHARGE_NUDGE_THRESHOLD,
      analysisIntervalMs: flowConfig.FLOW_ANALYSIS_INTERVAL_MS,
      horizonHours: flowConfig.PREDICTION_HORIZON_HOURS,
      aiProvider: flowConfig.AI_PROVIDER,
      aiConfigured: { gemini: Boolean(flowConfig.GEMINI_API_KEY), groq: Boolean(flowConfig.GROQ_API_KEY) },
      lastAnalysisAt: dashboard.getLastAnalysisAt(),
    });
  }),

  /* ── Phase 9 ── */
  postAiReport: asyncHandler(async (req, res) => ok(res, await aiReport.generateReport(parse(aiSchema, req.body || {}), req.user))),

  postDemoReset: asyncHandler(async (req, res) => ok(res, await actions.demoReset(req.user))),
  postDemoAmbulance: asyncHandler(async (req, res) => ok(res, await actions.demoAmbulance(req.body || {}, req.user), {}, 201)),
  postDemoSurge: asyncHandler(async (req, res) => ok(res, await actions.demoSurge(req.user), {}, 201)),
};
