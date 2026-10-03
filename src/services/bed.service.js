const bedRepo = require('../repositories/bed.repo');
const adminRepo = require('../repositories/admin.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');

class BedService {
  async getAllBeds(filters) {
    return bedRepo.findAllBeds(filters);
  }

  async getBedById(id) {
    const bed = await bedRepo.findBedById(id);
    if (!bed) throw new AppError('Bed not found', 404, 'BED_NOT_FOUND');
    return bed;
  }

  async updateStatus(id, status) {
    const existing = await bedRepo.findBedById(id);
    if (!existing) throw new AppError('Bed not found', 404, 'BED_NOT_FOUND');

    const updated = await bedRepo.updateStatus(id, status);

    emitter.emitBedUpdated({
      bedId: id,
      status,
      patientId: updated.patient_id || null,
    });

    return updated;
  }

  async getAvailableBeds(filters) {
    return bedRepo.findAvailableBeds(filters);
  }

  async getBedHeatmap() {
    return adminRepo.getBedHeatmap();
  }
}

module.exports = new BedService();
