const db = require('../config/db');
const otCaseRepo = require('../repositories/otCase.repo');
const otRepo = require('../repositories/ot.repo');
const doctorRepo = require('../repositories/doctor.repo');
const patientRepo = require('../repositories/patient.repo');
const bedRepo = require('../repositories/bed.repo');
const notificationRepo = require('../repositories/notification.repo');
const emitter = require('../sockets/emitter');
const AppError = require('../utils/AppError');
const { addMinutes, diffInMinutes } = require('../utils/time');

class OtAssignmentService {
  /**
   * Schedules a new OT case within a robust multi-table transaction
   */
  async scheduleCase(data, createdByUserId) {
    const {
      patientId,
      otRoomId,
      primarySurgeonId,
      anesthetistId,
      assistingDoctors = [],
      procedureName,
      procedureCode,
      urgency = 'elective',
      scheduledStart,
      scheduledEnd,
      postOpBedRequired = true,
      notes,
    } = data;

    // 1. Verify patient exists
    const patient = await patientRepo.findPatientById(patientId);
    if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

    // 2. Check room overlap
    const roomOverlap = await otCaseRepo.checkRoomOverlap(otRoomId, scheduledStart, scheduledEnd);
    if (roomOverlap) {
      throw new AppError(
        `OT Room ${otRoomId} is already booked during this timeframe by case ${roomOverlap.case_number}`,
        409,
        'ROOM_CONFLICT'
      );
    }

    // 3. Check primary surgeon availability & overlap
    const surgeon = await doctorRepo.findDoctorByUserId(primarySurgeonId);
    if (!surgeon) throw new AppError('Primary surgeon not found', 404, 'SURGEON_NOT_FOUND');
    if (surgeon.todaySurgeries >= surgeon.maxSurgeriesDay) {
      throw new AppError(
        `Dr. ${surgeon.fullName} has reached maximum surgery limit for today (${surgeon.maxSurgeriesDay} cases).`,
        400,
        'SURGEON_MAX_SURGERIES_REACHED'
      );
    }

    const surgeonOverlap = await otCaseRepo.checkDoctorOverlap(
      primarySurgeonId,
      scheduledStart,
      scheduledEnd
    );
    if (surgeonOverlap) {
      throw new AppError(
        `Primary surgeon is already assigned to another surgical case (${surgeonOverlap.case_number}) at this time`,
        409,
        'SURGEON_SCHEDULE_CONFLICT'
      );
    }

    // 4. Check anesthetist overlap if provided
    if (anesthetistId) {
      const anesthOverlap = await otCaseRepo.checkDoctorOverlap(
        anesthetistId,
        scheduledStart,
        scheduledEnd
      );
      if (anesthOverlap) {
        throw new AppError(
          `Anesthetist is already assigned to case ${anesthOverlap.case_number} during this timeframe`,
          409,
          'ANESTHETIST_SCHEDULE_CONFLICT'
        );
      }
    }

    // Generate unique case number
    const caseNumber = `OTC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const durationMin = Math.max(1, diffInMinutes(scheduledEnd, scheduledStart));

    // 5. Execute DB Transaction
    return db.withTransaction(async (client) => {
      // Find and reserve post-op bed if required
      let postOpBedId = null;
      if (postOpBedRequired) {
        const bed = await bedRepo.reservePostOpBed(client);
        if (bed) {
          postOpBedId = bed.id;
          await client.query(`UPDATE beds SET status = 'reserved', patient_id = $1 WHERE id = $2`, [
            patientId,
            bed.id,
          ]);
          emitter.emitBedUpdated({ bedId: bed.id, status: 'reserved', patientId });
        }
      }

      // Insert OT Case
      const otCase = await otCaseRepo.createCase(
        {
          caseNumber,
          patientId,
          otRoomId,
          primarySurgeonId,
          assistingDoctors,
          anesthetistId,
          procedureName,
          procedureCode,
          urgency,
          scheduledStart,
          scheduledEnd,
          predictedDurationMin: durationMin,
          postOpBedRequired,
          postOpBedId,
          notes,
          createdBy: createdByUserId,
        },
        client
      );

      // Insert doctor OT assignments
      await client.query(
        `INSERT INTO doctor_ot_assignments (doctor_id, ot_case_id, ot_room_id, role, assigned_by)
         VALUES ($1, $2, $3, 'primary_surgeon', $4)`,
        [primarySurgeonId, otCase.id, otRoomId, createdByUserId]
      );

      if (anesthetistId) {
        await client.query(
          `INSERT INTO doctor_ot_assignments (doctor_id, ot_case_id, ot_room_id, role, assigned_by)
           VALUES ($1, $2, $3, 'anesthetist', $4)`,
          [anesthetistId, otCase.id, otRoomId, createdByUserId]
        );
      }

      for (const assistId of assistingDoctors) {
        await client.query(
          `INSERT INTO doctor_ot_assignments (doctor_id, ot_case_id, ot_room_id, role, assigned_by)
           VALUES ($1, $2, $3, 'assistant', $4)`,
          [assistId, otCase.id, otRoomId, createdByUserId]
        );
      }

      // Update patient status and requirement
      await client.query(
        `UPDATE patients
         SET requires_ot = TRUE,
             status = CASE WHEN status = 'waiting' THEN 'admitted' ELSE status END
         WHERE id = $1`,
        [patientId]
      );

      // Create notifications for primary surgeon, anesthetist, and assistants
      const notificationMsg = `You have been assigned to surgical case ${caseNumber} (${procedureName}) scheduled at ${scheduledStart}`;
      await notificationRepo.createNotification(
        {
          userId: primarySurgeonId,
          type: 'ot_assigned',
          title: 'New OT Slot Assignment',
          message: notificationMsg,
          relatedId: otCase.id,
        },
        client
      );
      emitter.emitNotification(primarySurgeonId, {
        type: 'ot_assigned',
        title: 'New OT Slot Assignment',
        message: notificationMsg,
      });

      if (anesthetistId) {
        await notificationRepo.createNotification(
          {
            userId: anesthetistId,
            type: 'ot_assigned',
            title: 'Anesthesia Case Assignment',
            message: notificationMsg,
            relatedId: otCase.id,
          },
          client
        );
        emitter.emitNotification(anesthetistId, {
          type: 'ot_assigned',
          title: 'Anesthesia Case Assignment',
          message: notificationMsg,
        });
      }

      return otCaseRepo.findCaseById(otCase.id, client);
    });
  }

  /**
   * Starts an in-progress surgical case
   */
  async startCase(caseId) {
    const existing = await otCaseRepo.findCaseById(caseId);
    if (!existing) throw new AppError('OT Case not found', 404, 'CASE_NOT_FOUND');
    if (existing.status !== 'scheduled') {
      throw new AppError(
        `Cannot start a case with status '${existing.status}'`,
        400,
        'INVALID_CASE_STATUS'
      );
    }

    return db.withTransaction(async (client) => {
      // Update case
      await client.query(
        `UPDATE ot_cases SET status = 'in_progress', actual_start = NOW() WHERE id = $1`,
        [caseId]
      );

      // Update room to in_surgery & link current case
      await client.query(
        `UPDATE ot_rooms SET status = 'in_surgery', current_case_id = $1 WHERE id = $2`,
        [caseId, existing.otRoom.id]
      );

      // Update primary surgeon to in_surgery
      await client.query(
        `UPDATE doctors SET status = 'in_surgery', current_location = $1 WHERE id = $2`,
        [existing.otRoom.name, existing.primarySurgeon.id]
      );

      // Update patient status to in_surgery
      await client.query(`UPDATE patients SET status = 'in_surgery' WHERE id = $1`, [
        existing.patient.id,
      ]);

      await client.query(
        `INSERT INTO patient_timeline (patient_id, status, note) VALUES ($1, 'in_surgery', $2)`,
        [existing.patient.id, `Surgery started in ${existing.otRoom.name}`]
      );

      emitter.emitOtCaseStarted({
        caseId,
        roomId: existing.otRoom.id,
        surgeonName: existing.primarySurgeon.name,
        patientName: existing.patient.name,
      });

      emitter.emitDoctorStatusChanged({
        doctorId: existing.primarySurgeon.id,
        name: existing.primarySurgeon.name,
        newStatus: 'in_surgery',
        location: existing.otRoom.name,
      });

      return otCaseRepo.findCaseById(caseId, client);
    });
  }

  /**
   * Completes an OT case, frees resources, sets post-op bed, triggers cleaning
   */
  async completeCase(caseId) {
    const existing = await otCaseRepo.findCaseById(caseId);
    if (!existing) throw new AppError('OT Case not found', 404, 'CASE_NOT_FOUND');
    if (existing.status !== 'in_progress') {
      throw new AppError(
        `Only in_progress cases can be completed. Current: '${existing.status}'`,
        400,
        'INVALID_STATUS'
      );
    }

    return db.withTransaction(async (client) => {
      const actualStart = existing.actualStart
        ? new Date(existing.actualStart)
        : new Date(existing.scheduledStart);
      const now = new Date();
      const durationMin = Math.max(1, Math.round((now.getTime() - actualStart.getTime()) / 60000));

      // 1. Update Case
      await client.query(
        `UPDATE ot_cases
         SET status = 'completed',
             actual_end = NOW(),
             actual_duration_min = $1
         WHERE id = $2`,
        [durationMin, caseId]
      );

      // 2. Set OT room status to cleaning & free current_case_id
      await client.query(
        `UPDATE ot_rooms
         SET status = 'cleaning',
             current_case_id = NULL,
             last_cleaned_at = NULL
         WHERE id = $1`,
        [existing.otRoom.id]
      );

      // 3. Increment surgeries_today and reset primary surgeon status to available
      await client.query(
        `UPDATE doctors
         SET surgeries_today = surgeries_today + 1,
             status = 'available',
             current_location = 'Post-Op Lounge'
         WHERE id = $1`,
        [existing.primarySurgeon.id]
      );

      if (existing.anesthetist?.id) {
        await client.query(
          `UPDATE doctors SET status = 'available', current_location = 'OT Lounge' WHERE id = $1`,
          [existing.anesthetist.id]
        );
      }

      // 4. Update post-op bed status to occupied if assigned
      if (existing.postOpBed?.id) {
        await client.query(
          `UPDATE beds
           SET status = 'occupied',
               patient_id = $1,
               expected_release_time = NOW() + INTERVAL '24 hours'
           WHERE id = $2`,
          [existing.patient.id, existing.postOpBed.id]
        );
        await client.query(`UPDATE patients SET bed_id = $1 WHERE id = $2`, [
          existing.postOpBed.id,
          existing.patient.id,
        ]);
        emitter.emitBedUpdated({
          bedId: existing.postOpBed.id,
          status: 'occupied',
          patientId: existing.patient.id,
        });
      }

      // 5. Update patient status to in_recovery
      await client.query(`UPDATE patients SET status = 'in_recovery' WHERE id = $1`, [
        existing.patient.id,
      ]);

      await client.query(
        `INSERT INTO patient_timeline (patient_id, status, note) VALUES ($1, 'in_recovery', 'Surgery completed. Transferred to recovery.')`,
        [existing.patient.id]
      );

      emitter.emitOtCaseCompleted({
        caseId,
        roomId: existing.otRoom.id,
        duration: durationMin,
        nextStatus: 'cleaning',
      });

      emitter.emitDoctorStatusChanged({
        doctorId: existing.primarySurgeon.id,
        name: existing.primarySurgeon.name,
        newStatus: 'available',
        location: 'Post-Op Lounge',
      });

      return otCaseRepo.findCaseById(caseId, client);
    });
  }

  /**
   * Cancels a scheduled or in-progress OT case
   */
  async cancelCase(caseId, reason) {
    const existing = await otCaseRepo.findCaseById(caseId);
    if (!existing) throw new AppError('OT Case not found', 404, 'CASE_NOT_FOUND');

    return db.withTransaction(async (client) => {
      await client.query(
        `UPDATE ot_cases SET status = 'cancelled', delay_reason = $1 WHERE id = $2`,
        [reason, caseId]
      );

      // Free room if this case was active
      await client.query(
        `UPDATE ot_rooms SET status = 'available', current_case_id = NULL WHERE current_case_id = $1`,
        [caseId]
      );

      // Free post-op bed if reserved
      if (existing.postOpBed?.id) {
        await client.query(
          `UPDATE beds SET status = 'available', patient_id = NULL WHERE id = $1`,
          [existing.postOpBed.id]
        );
        emitter.emitBedUpdated({ bedId: existing.postOpBed.id, status: 'available' });
      }

      // Notify surgeon
      const cancelMsg = `OT Case ${existing.caseNumber} has been cancelled. Reason: ${reason}`;
      await notificationRepo.createNotification(
        {
          userId: existing.primarySurgeon.id,
          type: 'ot_cancelled',
          title: 'Surgery Cancelled',
          message: cancelMsg,
          relatedId: caseId,
        },
        client
      );
      emitter.emitNotification(existing.primarySurgeon.id, {
        type: 'ot_cancelled',
        title: 'Surgery Cancelled',
        message: cancelMsg,
      });

      return otCaseRepo.findCaseById(caseId, client);
    });
  }

  /**
   * Delays an OT case
   */
  async delayCase(caseId, delayMinutes, reason) {
    const existing = await otCaseRepo.findCaseById(caseId);
    if (!existing) throw new AppError('OT Case not found', 404, 'CASE_NOT_FOUND');

    const newStart = addMinutes(existing.scheduledStart, delayMinutes);
    const newEnd = addMinutes(existing.scheduledEnd, delayMinutes);

    await db.query(
      `UPDATE ot_cases
       SET status = 'delayed',
           scheduled_start = $1,
           scheduled_end = $2,
           delay_reason = $3
       WHERE id = $4`,
      [newStart, newEnd, reason, caseId]
    );

    return otCaseRepo.findCaseById(caseId);
  }

  /**
   * Inserts an emergency case over an elective case and reschedules the elective
   */
  async emergencyInsert(electiveCaseId, emergencyData, userId) {
    const electiveCase = await otCaseRepo.findCaseById(electiveCaseId);
    if (!electiveCase) throw new AppError('Elective case not found', 404, 'CASE_NOT_FOUND');

    return db.withTransaction(async (client) => {
      const shiftMinutes = emergencyData.estimatedDurationMinutes + 30; // buffer
      const newElectiveStart = addMinutes(electiveCase.scheduledStart, shiftMinutes);
      const newElectiveEnd = addMinutes(electiveCase.scheduledEnd, shiftMinutes);

      // Reschedule elective
      await client.query(
        `UPDATE ot_cases
         SET scheduled_start = $1,
             scheduled_end = $2,
             status = 'delayed',
             delay_reason = 'Displaced by Emergency Procedure'
         WHERE id = $3`,
        [newElectiveStart, newElectiveEnd, electiveCaseId]
      );

      // Notify displaced surgeon
      const displacedMsg = `Your case ${electiveCase.caseNumber} in ${electiveCase.otRoom.name} was rescheduled to ${newElectiveStart.toISOString()} due to an emergency.`;
      await notificationRepo.createNotification(
        {
          userId: electiveCase.primarySurgeon.id,
          type: 'ot_changed',
          title: 'Case Rescheduled (Emergency Priority)',
          message: displacedMsg,
          relatedId: electiveCaseId,
        },
        client
      );

      // Schedule emergency case immediately
      const emergencyCaseNumber = `EMG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const emergencyCase = await otCaseRepo.createCase(
        {
          caseNumber: emergencyCaseNumber,
          patientId: emergencyData.patientId,
          otRoomId: electiveCase.otRoom.id,
          primarySurgeonId: emergencyData.primarySurgeonId,
          anesthetistId: emergencyData.anesthetistId || electiveCase.anesthetist?.id,
          assistingDoctors: [],
          procedureName: emergencyData.procedureName,
          urgency: 'critical',
          scheduledStart: electiveCase.scheduledStart,
          scheduledEnd: addMinutes(
            electiveCase.scheduledStart,
            emergencyData.estimatedDurationMinutes
          ),
          predictedDurationMin: emergencyData.estimatedDurationMinutes,
          postOpBedRequired: true,
          notes: emergencyData.notes || 'Emergency Priority Insertion',
          createdBy: userId,
        },
        client
      );

      // Update emergency status to emergency_inserted
      await client.query(`UPDATE ot_cases SET status = 'emergency_inserted' WHERE id = $1`, [
        emergencyCase.id,
      ]);

      return otCaseRepo.findCaseById(emergencyCase.id, client);
    });
  }

  /**
   * Reassigns or adds a doctor to an OT case
   */
  async assignDoctorToCase(caseId, doctorId, role, userId) {
    const existing = await otCaseRepo.findCaseById(caseId);
    if (!existing) throw new AppError('OT Case not found', 404, 'CASE_NOT_FOUND');

    const doctor = await doctorRepo.findDoctorByUserId(doctorId);
    if (!doctor) throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');

    return db.withTransaction(async (client) => {
      if (role === 'primary_surgeon') {
        await client.query(`UPDATE ot_cases SET primary_surgeon_id = $1 WHERE id = $2`, [
          doctorId,
          caseId,
        ]);
      } else if (role === 'anesthetist') {
        await client.query(`UPDATE ot_cases SET anesthetist_id = $1 WHERE id = $2`, [
          doctorId,
          caseId,
        ]);
      } else if (role === 'assistant') {
        await client.query(
          `UPDATE ot_cases SET assisting_doctors = array_append(assisting_doctors, $1::uuid) WHERE id = $2`,
          [doctorId, caseId]
        );
      }

      await client.query(
        `INSERT INTO doctor_ot_assignments (doctor_id, ot_case_id, ot_room_id, role, assigned_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [doctorId, caseId, existing.otRoom.id, role, userId]
      );

      return otCaseRepo.findCaseById(caseId, client);
    });
  }

  /**
   * Approves a doctor's OT request and schedules the case
   */
  async approveRequest(requestId, userId) {
    const requests = await otCaseRepo.findAllRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new AppError('OT Request not found', 404, 'REQUEST_NOT_FOUND');

    // Find available room
    const availableRooms = await otRepo.findAvailableNow();
    const roomId = availableRooms[0]?.id || 1;

    const start =
      req.preferredDate && req.preferredTime
        ? `${req.preferredDate}T${req.preferredTime}`
        : new Date().toISOString();
    const end = addMinutes(start, req.durationMin || 120).toISOString();

    const createdCase = await this.scheduleCase(
      {
        patientId: req.patientId,
        otRoomId: roomId,
        primarySurgeonId: req.doctorId,
        procedureName: req.procedureName,
        urgency: req.urgency,
        scheduledStart: start,
        scheduledEnd: end,
        notes: req.notes,
      },
      userId
    );

    await db.query(
      `UPDATE ot_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), ot_case_id = $2 WHERE id = $3`,
      [userId, createdCase.id, requestId]
    );

    return createdCase;
  }

  /**
   * Rejects an OT request
   */
  async rejectRequest(requestId, reason, userId) {
    const res = await db.query(
      `UPDATE ot_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), reject_reason = $2 WHERE id = $3 RETURNING *`,
      [userId, reason, requestId]
    );
    if (res.rows.length === 0) throw new AppError('OT Request not found', 404, 'REQUEST_NOT_FOUND');
    return res.rows[0];
  }

  async getOtStats() {
    return otCaseRepo.getOtStats();
  }
}

module.exports = new OtAssignmentService();
