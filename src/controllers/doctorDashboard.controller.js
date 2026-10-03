const doctorDashboardService = require('../services/doctorDashboard.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await doctorDashboardService.getDashboardData(req.user.id);
  return ok(res, data);
});

module.exports = {
  getDashboard,
};
