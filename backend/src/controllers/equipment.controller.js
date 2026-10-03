const equipmentService = require('../services/equipment.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getAllEquipment = asyncHandler(async (req, res) => {
  const equipment = await equipmentService.getAllEquipment(req.query);
  return ok(res, equipment);
});

const getEquipmentById = asyncHandler(async (req, res) => {
  const item = await equipmentService.getEquipmentById(req.params.id);
  return ok(res, item);
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const item = await equipmentService.updateStatus(req.params.id, status);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'UPDATE_EQUIPMENT_STATUS',
    target: 'equipment',
    targetId: req.params.id,
    detail: { newStatus: status },
    ip: req.ip,
  });

  return ok(res, item);
});

module.exports = {
  getAllEquipment,
  getEquipmentById,
  updateStatus,
};
