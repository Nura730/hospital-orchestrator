const doctorRepo = require('../repositories/doctor.repo');
const patientRepo = require('../repositories/patient.repo');
const otCaseRepo = require('../repositories/otCase.repo');
const notificationRepo = require('../repositories/notification.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');

class DoctorService {
  async getMyPatients(doctorId, query) {
    return patientRepo.findPatientsByDoctor(doctorId, query);
  }

  async getMyPatientById(doctorId, patientId) {
    const patient = await patientRepo.findPatientById(patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // STRICT ISOLATION: Confirm patient is assigned to this doctor
    if (patient.assignedDoctorId !== doctorId) {
      throw new AppError(
        'Access denied: You are not authorized to view clinical details of patients not assigned to you.',
        403,
        'FORBIDDEN_PATIENT_ACCESS'
      );
    }

    return patient;
  }

  async updatePatientStatus(doctorId, patientId, status, note) {
    // Validate doctor assignment
    await this.getMyPatientById(doctorId, patientId);
    return patientRepo.updateStatus(patientId, status, note, doctorId);
  }

  async updatePatientNotes(doctorId, patientId, { diagnosis, notes }) {
    await this.getMyPatientById(doctorId, patientId);
    return patientRepo.updatePatient(patientId, { diagnosis, notes });
  }

  async getMySchedule(doctorId) {
    return doctorRepo.getDoctorSchedule(doctorId);
  }

  async getMyOtCases(doctorId) {
    return otCaseRepo.findCasesByDoctor(doctorId);
  }

  async getMyStats(doctorId) {
    return doctorRepo.getDoctorStats(doctorId);
  }

  async createOtRequest(doctorId, data) {
    // Confirm patient is assigned to doctor
    await this.getMyPatientById(doctorId, data.patientId);

    const request = await otCaseRepo.createRequest({
      ...data,
      doctorId,
    });

    // Notify admins and OT managers
    emitter.emitNotification('admin', {
      type: 'ot_requested',
      title: 'New OT Slot Requested',
      message: `Dr. requested an OT slot for procedure: ${data.procedureName}`,
    });

    return request;
  }

  async getMyOtRequests(doctorId) {
    return otCaseRepo.findAllRequests(doctorId);
  }

  async getAvailability(doctorId) {
    const doc = await doctorRepo.findDoctorByUserId(doctorId);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    return {
      doctorId: doc.id,
      status: doc.status,
      currentLocation: doc.currentLocation,
      todaySurgeries: doc.todaySurgeries,
      maxSurgeriesDay: doc.maxSurgeriesDay,
      isOnCall: doc.isOnCall,
      shiftEnd: doc.shiftEnd,
    };
  }

  async updateStatus(doctorId, status) {
    const doc = await doctorRepo.updateStatus(doctorId, status);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');

    const fullDoc = await doctorRepo.findDoctorByUserId(doctorId);
    emitter.emitDoctorStatusChanged({
      doctorId: fullDoc.id,
      name: fullDoc.fullName,
      newStatus: status,
      location: fullDoc.currentLocation,
    });

    return fullDoc;
  }

  async getMyNotifications(doctorId, isRead = null) {
    return notificationRepo.findUserNotifications(doctorId, isRead);
  }

  async markNotificationRead(doctorId, notificationId) {
    const res = await notificationRepo.markAsRead(notificationId, doctorId);
    if (!res) throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    return res;
  }

  async markAllNotificationsRead(doctorId) {
    const count = await notificationRepo.markAllAsRead(doctorId);
    return { success: true, count };
  }
}

module.exports = new DoctorService();
