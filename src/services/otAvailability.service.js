const otRepo = require('../repositories/ot.repo');
const doctorRepo = require('../repositories/doctor.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');

class OtAvailabilityService {
  async getAllRooms() {
    return otRepo.findAllRooms();
  }

  async getRoomById(id) {
    const room = await otRepo.findRoomById(id);
    if (!room) throw new AppError('OT Room not found', 404, 'OT_ROOM_NOT_FOUND');
    return room;
  }

  async getTimeline() {
    const timeline = await otRepo.getTodayTimeline();
    return { rooms: timeline };
  }

  async getAvailableRoomsNow() {
    return otRepo.findAvailableNow();
  }

  async getAvailableDoctors(query) {
    return doctorRepo.getAvailableDoctorsForOt(query);
  }

  async markCleaningDone(roomId) {
    const room = await otRepo.findRoomById(roomId);
    if (!room) throw new AppError('OT Room not found', 404, 'OT_ROOM_NOT_FOUND');

    const updated = await otRepo.markCleaningDone(roomId);

    emitter.emitOtCaseCompleted({
      roomId: Number(roomId),
      duration: 0,
      nextStatus: 'available',
    });

    return updated;
  }
}

module.exports = new OtAvailabilityService();
