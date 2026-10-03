const kpiRepo = require('../repositories/kpi.repo');
const otCaseRepo = require('../repositories/otCase.repo');
const otRepo = require('../repositories/ot.repo');

class KpiService {
  async getCurrentSnapshot() {
    return kpiRepo.computeCurrentLiveMetrics();
  }

  async getHistory(range = '7d') {
    const days = range === '30d' ? 30 : 7;
    return kpiRepo.getHistory(days);
  }

  async getOtAnalytics() {
    const [stats, timeline, rooms] = await Promise.all([
      otCaseRepo.getOtStats(),
      otRepo.getTodayTimeline(),
      otRepo.findAllRooms(),
    ]);

    const activeRooms = rooms.filter((r) => r.status === 'in_surgery').length;
    const totalRooms = rooms.length || 1;
    const roomUtilizationPct = Number(((activeRooms / totalRooms) * 100).toFixed(1));

    return {
      stats,
      roomUtilizationPct,
      timeline,
      totalRooms,
      activeRooms,
    };
  }
}

module.exports = new KpiService();
