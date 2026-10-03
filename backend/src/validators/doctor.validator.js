const { z } = require('zod');
const { DOCTOR_STATUS } = require('../config/constants');

const createDoctorSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    phone: z.string().optional(),
    employeeId: z.string().min(2),
    specialization: z.string().min(2),
    subSpecialization: z.string().optional(),
    departmentId: z.coerce.number().optional(),
    qualification: z.array(z.string()).optional(),
    experienceYears: z.coerce.number().min(0).optional(),
    currentLocation: z.string().optional(),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
    maxSurgeriesDay: z.coerce.number().min(1).default(4),
    consultationRoom: z.string().optional(),
  }),
});

const updateDoctorSchema = z.object({
  body: z.object({
    specialization: z.string().optional(),
    subSpecialization: z.string().optional(),
    departmentId: z.coerce.number().optional(),
    qualification: z.array(z.string()).optional(),
    experienceYears: z.coerce.number().min(0).optional(),
    currentLocation: z.string().optional(),
    shiftStart: z.string().optional(),
    shiftEnd: z.string().optional(),
    maxSurgeriesDay: z.coerce.number().min(1).optional(),
    consultationRoom: z.string().optional(),
    isOnCall: z.boolean().optional(),
  }),
});

const updateDoctorStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      DOCTOR_STATUS.AVAILABLE,
      DOCTOR_STATUS.IN_SURGERY,
      DOCTOR_STATUS.IN_CONSULTATION,
      DOCTOR_STATUS.OFF_DUTY,
      DOCTOR_STATUS.ON_BREAK,
      DOCTOR_STATUS.EMERGENCY,
    ]),
  }),
});

module.exports = {
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
};
