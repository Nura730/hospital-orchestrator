const kpiService = require('../services/kpi.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const getCurrentKpis = asyncHandler(async (req, res) => {
  const data = await kpiService.getCurrentSnapshot();
  return ok(res, data);
});

const getKpiHistory = asyncHandler(async (req, res) => {
  const { range = '7d' } = req.query;
  const history = await kpiService.getHistory(range);
  return ok(res, history);
});

const getOtAnalytics = asyncHandler(async (req, res) => {
  const analytics = await kpiService.getOtAnalytics();
  return ok(res, analytics);
});

module.exports = {
  getCurrentKpis,
  getKpiHistory,
  getOtAnalytics,
};
