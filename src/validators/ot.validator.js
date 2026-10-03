const { z } = require('zod');
const { CASE_URGENCY } = require('../config/constants');

const scheduleCaseSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    otRoomId: z.coerce.number().int().positive(),
    primarySurgeonId: z.string().uuid(),
    anesthetistId: z.string().uuid().optional(),
    assistingDoctors: z.array(z.string().uuid()).default([]),
    procedureName: z.string().min(2),
    procedureCode: z.string().optional(),
    urgency: z
      .enum([
        CASE_URGENCY.ELECTIVE,
        CASE_URGENCY.URGENT,
        CASE_URGENCY.EMERGENCY,
        CASE_URGENCY.CRITICAL,
      ])
      .default(CASE_URGENCY.ELECTIVE),
    scheduledStart: z.string().datetime().or(z.string()),
    scheduledEnd: z.string().datetime().or(z.string()),
    postOpBedRequired: z.boolean().default(true),
    notes: z.string().optional(),
  }),
});

const delayCaseSchema = z.object({
  body: z.object({
    delayMinutes: z.coerce.number().positive(),
    reason: z.string().min(3),
  }),
});

const cancelCaseSchema = z.object({
  body: z.object({
    reason: z.string().min(3),
  }),
});

const emergencyInsertSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    primarySurgeonId: z.string().uuid(),
    anesthetistId: z.string().uuid().optional(),
    procedureName: z.string().min(2),
    estimatedDurationMinutes: z.coerce.number().positive().default(120),
    notes: z.string().optional(),
  }),
});

const assignDoctorToCaseSchema = z.object({
  body: z.object({
    doctorId: z.string().uuid(),
    role: z.enum(['primary_surgeon', 'assistant', 'anesthetist']),
  }),
});

const rejectRequestSchema = z.object({
  body: z.object({
    reason: z.string().min(3),
  }),
});

module.exports = {
  scheduleCaseSchema,
  delayCaseSchema,
  cancelCaseSchema,
  emergencyInsertSchema,
  assignDoctorToCaseSchema,
  rejectRequestSchema,
};
