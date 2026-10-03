const otAvailabilityService = require('../services/otAvailability.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const getRooms = asyncHandler(async (req, res) => {
  const rooms = await otAvailabilityService.getAllRooms();
  return ok(res, rooms);
});

const getRoomById = asyncHandler(async (req, res) => {
  const room = await otAvailabilityService.getRoomById(req.params.id);
  return ok(res, room);
});

const getTimeline = asyncHandler(async (req, res) => {
  const timeline = await otAvailabilityService.getTimeline();
  return ok(res, timeline);
});

const getAvailableNow = asyncHandler(async (req, res) => {
  const rooms = await otAvailabilityService.getAvailableRoomsNow();
  return ok(res, rooms);
});

const getAvailableDoctors = asyncHandler(async (req, res) => {
  const doctors = await otAvailabilityService.getAvailableDoctors(req.query);
  return ok(res, doctors);
});

const markCleaningDone = asyncHandler(async (req, res) => {
  const room = await otAvailabilityService.markCleaningDone(req.params.id);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName,
    userType: req.user.userType,
    action: 'OT_ROOM_CLEANING_COMPLETED',
    target: 'ot_rooms',
    targetId: req.params.id,
    ip: req.ip,
  });

  return ok(res, room);
});

module.exports = {
  getRooms,
  getRoomById,
  getTimeline,
  getAvailableNow,
  getAvailableDoctors,
  markCleaningDone,
};
