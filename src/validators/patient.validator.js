const { z } = require('zod');
const { PATIENT_STATUS } = require('../config/constants');

const createPatientSchema = z.object({
  body: z.object({
    patientId: z.string().min(2),
    fullName: z.string().min(2),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD required'),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    phone: z.string().optional(),
    emergencyContact: z.string().optional(),
    address: z.string().optional(),
    status: z
      .enum([
        PATIENT_STATUS.WAITING,
        PATIENT_STATUS.ADMITTED,
        PATIENT_STATUS.IN_CONSULTATION,
        PATIENT_STATUS.IN_SURGERY,
        PATIENT_STATUS.IN_RECOVERY,
        PATIENT_STATUS.DISCHARGED,
        PATIENT_STATUS.TRANSFERRED,
        PATIENT_STATUS.CRITICAL,
      ])
      .default(PATIENT_STATUS.WAITING),
    acuity: z.coerce.number().min(1).max(5).default(3),
    departmentId: z.coerce.number().optional(),
    assignedDoctorId: z.string().uuid().optional(),
    bedId: z.string().optional(),
    admissionDate: z.string().optional(),
    diagnosis: z.string().optional(),
    notes: z.string().optional(),
    requiresIcu: z.boolean().optional(),
    requiresIsolation: z.boolean().optional(),
    requiresVentilator: z.boolean().optional(),
    requiresOt: z.boolean().optional(),
    insuranceId: z.string().optional(),
  }),
});

const updatePatientSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    phone: z.string().optional(),
    emergencyContact: z.string().optional(),
    address: z.string().optional(),
    acuity: z.coerce.number().min(1).max(5).optional(),
    departmentId: z.coerce.number().optional(),
    assignedDoctorId: z.string().uuid().optional(),
    bedId: z.string().optional(),
    diagnosis: z.string().optional(),
    notes: z.string().optional(),
    requiresIcu: z.boolean().optional(),
    requiresIsolation: z.boolean().optional(),
    requiresVentilator: z.boolean().optional(),
    requiresOt: z.boolean().optional(),
    insuranceId: z.string().optional(),
  }),
});

const updatePatientStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      PATIENT_STATUS.WAITING,
      PATIENT_STATUS.ADMITTED,
      PATIENT_STATUS.IN_CONSULTATION,
      PATIENT_STATUS.IN_SURGERY,
      PATIENT_STATUS.IN_RECOVERY,
      PATIENT_STATUS.DISCHARGED,
      PATIENT_STATUS.TRANSFERRED,
      PATIENT_STATUS.CRITICAL,
    ]),
    note: z.string().optional(),
  }),
});

const assignDoctorSchema = z.object({
  body: z.object({
    doctorId: z.string().uuid('Valid doctor UUID is required'),
  }),
});

const assignBedSchema = z.object({
  body: z.object({
    bedId: z.string().min(1, 'Valid bed ID is required'),
  }),
});

module.exports = {
  createPatientSchema,
  updatePatientSchema,
  updatePatientStatusSchema,
  assignDoctorSchema,
  assignBedSchema,
};
