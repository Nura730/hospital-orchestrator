const equipmentRepo = require('../repositories/equipment.repo');
const AppError = require('../utils/AppError');

class EquipmentService {
  async getAllEquipment(query) {
    return equipmentRepo.findAll(query);
  }

  async getEquipmentById(id) {
    const eq = await equipmentRepo.findById(id);
    if (!eq) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
    return eq;
  }

  async updateStatus(id, status) {
    const updated = await equipmentRepo.updateStatus(id, status);
    if (!updated) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
    return updated;
  }
}

module.exports = new EquipmentService();
