const patientRepo = require('../repositories/patient.repo');
const bedRepo = require('../repositories/bed.repo');
const doctorRepo = require('../repositories/doctor.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');
const db = require('../config/db');

class PatientService {
  async getAllPatients(filters) {
    return patientRepo.findAllPatients(filters);
  }

  async getPatientById(id) {
    const patient = await patientRepo.findPatientById(id);
    if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    return patient;
  }

  async registerPatient(data) {
    return db.withTransaction(async (client) => {
      // Validate doctor if assigned
      if (data.assignedDoctorId) {
        const doc = await doctorRepo.findDoctorByUserId(data.assignedDoctorId, client);
        if (!doc) throw new AppError('Assigned doctor does not exist', 400, 'DOCTOR_NOT_FOUND');
      }

      // Validate bed if assigned
      if (data.bedId) {
        const bed = await bedRepo.findBedById(data.bedId, client);
        if (!bed) throw new AppError('Assigned bed does not exist', 400, 'BED_NOT_FOUND');
        if (bed.status !== 'available') {
          throw new AppError(
            `Bed ${data.bedId} is currently ${bed.status}`,
            400,
            'BED_NOT_AVAILABLE'
          );
        }
      }

      const patient = await patientRepo.createPatient(data, client);

      // Occupy bed if provided
      if (data.bedId) {
        await client.query(`UPDATE beds SET status = 'occupied', patient_id = $1 WHERE id = $2`, [
          patient.id,
          data.bedId,
        ]);
        emitter.emitBedUpdated({ bedId: data.bedId, status: 'occupied', patientId: patient.id });
      }

      // Initial timeline entry
      await client.query(
        `INSERT INTO patient_timeline (patient_id, status, note)
         VALUES ($1, $2, $3)`,
        [patient.id, patient.status, 'Patient registered into MediOrchestra system']
      );

      emitter.emitPatientUpdated({
        patientId: patient.id,
        status: patient.status,
        acuity: patient.acuity,
      });

      return patientRepo.findPatientById(patient.id, client);
    });
  }

  async updatePatient(id, data) {
    const existing = await patientRepo.findPatientById(id);
    if (!existing) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    return patientRepo.updatePatient(id, data);
  }

  async updatePatientStatus(id, status, note, changedByUserId) {
    const existing = await patientRepo.findPatientById(id);
    if (!existing) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

    const updated = await patientRepo.updateStatus(id, status, note, changedByUserId);

    emitter.emitPatientUpdated({
      patientId: id,
      status,
      acuity: updated.acuity,
    });

    return updated;
  }

  async assignDoctor(patientId, doctorId) {
    const doc = await doctorRepo.findDoctorByUserId(doctorId);
    if (!doc) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');

    const patient = await patientRepo.assignDoctor(patientId, doctorId);
    if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

    return patientRepo.findPatientById(patientId);
  }

  async assignBed(patientId, bedId) {
    return db.withTransaction(async (client) => {
      const bed = await bedRepo.findBedById(bedId, client);
      if (!bed) throw new AppError('Bed not found', 404, 'BED_NOT_FOUND');
      if (bed.status !== 'available') {
        throw new AppError(`Bed ${bedId} is currently ${bed.status}`, 400, 'BED_NOT_AVAILABLE');
      }

      const patient = await patientRepo.assignBed(patientId, bedId, client);
      if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

      await client.query(`UPDATE beds SET status = 'occupied', patient_id = $1 WHERE id = $2`, [
        patientId,
        bedId,
      ]);

      // Record timeline
      await client.query(
        `INSERT INTO patient_timeline (patient_id, status, note)
         VALUES ($1, 'admitted', $2)`,
        [patientId, `Assigned to bed ${bedId}`]
      );

      emitter.emitBedUpdated({ bedId, status: 'occupied', patientId });
      emitter.emitPatientUpdated({ patientId, status: 'admitted', acuity: patient.acuity });

      return patientRepo.findPatientById(patientId, client);
    });
  }

  async dischargePatient(patientId) {
    return db.withTransaction(async (client) => {
      const patient = await patientRepo.findPatientById(patientId, client);
      if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

      const oldBedId = patient.bedId;
      const discharged = await patientRepo.dischargePatient(patientId, client);

      // Record timeline
      await client.query(
        `INSERT INTO patient_timeline (patient_id, status, note)
         VALUES ($1, 'discharged', 'Patient discharged from hospital care')`,
        [patientId]
      );

      if (oldBedId) {
        emitter.emitBedUpdated({ bedId: oldBedId, status: 'cleaning' });
      }
      emitter.emitPatientUpdated({ patientId, status: 'discharged', acuity: discharged.acuity });

      return discharged;
    });
  }
}

module.exports = new PatientService();
