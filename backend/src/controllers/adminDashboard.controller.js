const adminDashboardService = require('../services/adminDashboard.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await adminDashboardService.getDashboardData();
  return ok(res, data);
});

const getLiveKpis = asyncHandler(async (req, res) => {
  const data = await adminDashboardService.getLiveKpis();
  return ok(res, data);
});

module.exports = {
  getDashboard,
  getLiveKpis,
};
