const bedService = require('../services/bed.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getAllBeds = asyncHandler(async (req, res) => {
  const beds = await bedService.getAllBeds(req.query);
  return ok(res, beds);
});

const getBedById = asyncHandler(async (req, res) => {
  const bed = await bedService.getBedById(req.params.id);
  return ok(res, bed);
});

const updateBedStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const bed = await bedService.updateStatus(req.params.id, status);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'UPDATE_BED_STATUS',
    target: 'beds',
    targetId: req.params.id,
    detail: { newStatus: status },
    ip: req.ip,
  });

  return ok(res, bed);
});

const getAvailableBeds = asyncHandler(async (req, res) => {
  const beds = await bedService.getAvailableBeds(req.query);
  return ok(res, beds);
});

const getBedHeatmap = asyncHandler(async (req, res) => {
  const heatmap = await bedService.getBedHeatmap();
  return ok(res, heatmap);
});

module.exports = {
  getAllBeds,
  getBedById,
  updateBedStatus,
  getAvailableBeds,
  getBedHeatmap,
};
