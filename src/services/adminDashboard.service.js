const adminRepo = require('../repositories/admin.repo');
const alertRepo = require('../repositories/alert.repo');
const otCaseRepo = require('../repositories/otCase.repo');
const patientRepo = require('../repositories/patient.repo');
const doctorRepo = require('../repositories/doctor.repo');
const otRepo = require('../repositories/ot.repo');
const kpiRepo = require('../repositories/kpi.repo');

class AdminDashboardService {
  /**
   * Aggregates all hospital metrics into a single response using parallel execution
   */
  async getDashboardData() {
    const [
      overview,
      departmentBreakdown,
      recentAlerts,
      pendingOtRequests,
      criticalPatients,
      recentAdmissions,
      doctorAvailability,
      otTimeline,
      bedHeatmap,
      last7daysKpi,
    ] = await Promise.all([
      adminRepo.getOverviewMetrics(),
      adminRepo.getDepartmentBreakdown(),
      alertRepo.findRecentAlerts(5),
      otCaseRepo.findAllRequests(),
      patientRepo.getCriticalPatients(),
      patientRepo.getRecentAdmissions(5),
      doctorRepo.getDoctorAvailabilityList(),
      otRepo.getTodayTimeline(),
      adminRepo.getBedHeatmap(),
      kpiRepo.getHistory(7),
    ]);

    return {
      overview,
      departmentBreakdown,
      recentAlerts,
      pendingOtRequests: pendingOtRequests.slice(0, 5),
      criticalPatients,
      recentAdmissions,
      doctorAvailability,
      otTimeline,
      bedHeatmap,
      kpiTrend: {
        last7days: last7daysKpi,
      },
    };
  }

  /**
   * Fast, lightweight live KPI summary for 30s polling
   */
  async getLiveKpis() {
    return kpiRepo.computeCurrentLiveMetrics();
  }
}

module.exports = new AdminDashboardService();
