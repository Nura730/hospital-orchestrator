const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const doctorRepo = require('../repositories/doctor.repo');
const userRepo = require('../repositories/user.repo');
const patientRepo = require('../repositories/patient.repo');
const adminRepo = require('../repositories/admin.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');

class AdminService {
  async getAllDoctors(filters) {
    return doctorRepo.findAllDoctors(filters);
  }

  async getDoctorById(id) {
    const doc = await doctorRepo.findDoctorByUserId(id);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    return doc;
  }

  async createDoctor(data) {
    return db.withTransaction(async (client) => {
      // Check existing email
      const existing = await userRepo.findByEmail(data.email, client);
      if (existing) {
        throw new AppError('A user with this email address already exists', 409, 'EMAIL_EXISTS');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);

      // Create user record
      const user = await userRepo.createUser(
        {
          email: data.email,
          passwordHash,
          userType: 'doctor',
          fullName: data.fullName,
          phone: data.phone,
        },
        client
      );

      // Create doctor profile
      await client.query(
        `INSERT INTO doctors (
          id, employee_id, specialization, sub_specialization, department_id,
          qualification, experience_years, status, current_location, shift_start,
          shift_end, max_surgeries_day, consultation_room
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', $8, $9, $10, $11, $12)`,
        [
          user.id,
          data.employeeId,
          data.specialization,
          data.subSpecialization || null,
          data.departmentId || null,
          data.qualification || [],
          data.experienceYears || 0,
          data.currentLocation || null,
          data.shiftStart || '08:00:00',
          data.shiftEnd || '17:00:00',
          data.maxSurgeriesDay || 4,
          data.consultationRoom || null,
        ]
      );

      return doctorRepo.findDoctorByUserId(user.id, client);
    });
  }

  async updateDoctor(id, data) {
    const existing = await doctorRepo.findDoctorByUserId(id);
    if (!existing) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    return doctorRepo.updateDoctor(id, data);
  }

  async updateDoctorStatus(id, status) {
    const doc = await doctorRepo.updateStatus(id, status);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');

    const fullDoc = await doctorRepo.findDoctorByUserId(id);
    // Real-time broadcast
    emitter.emitDoctorStatusChanged({
      doctorId: fullDoc.id,
      name: fullDoc.fullName,
      newStatus: status,
      location: fullDoc.currentLocation,
    });

    return fullDoc;
  }

  async deactivateDoctor(id) {
    const res = await doctorRepo.deactivateDoctor(id);
    if (!res) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    return { success: true, message: 'Doctor successfully deactivated' };
  }

  async getDoctorSchedule(id) {
    const doc = await doctorRepo.findDoctorByUserId(id);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    return doctorRepo.getDoctorSchedule(id);
  }

  async getDoctorStats(id) {
    const doc = await doctorRepo.findDoctorByUserId(id);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
    return doctorRepo.getDoctorStats(id);
  }

  async getPeopleSummary() {
    const [patients, doctors, staff] = await Promise.all([
      patientRepo.getPatientPeopleSummary(),
      doctorRepo.getDoctorPeopleSummary(),
      adminRepo.getStaffSummary(),
    ]);

    return {
      patients,
      doctors,
      staff,
    };
  }
}

module.exports = new AdminService();
