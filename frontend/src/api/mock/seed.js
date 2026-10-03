/**
 * @file seed.js
 * Builds ONE consistent hospital state:
 * - 80 beds across Emergency, General Ward, HDU, ICU, Isolation
 * - 40 staff (Doctors, Nurses, Technicians, Surgeons, Anesthetists)
 * - 15 specialized equipment items with telemetry/battery
 * - 4 Operating Theatres (OT-1 to OT-4) with cases and turnover schedules
 * - 25 patients (admitted in beds + triage queue in Emergency)
 * - Coordinated alerts, bottlenecks with cascade chains, and AI recommendations
 */

import {
  BED_STATUS,
  PATIENT_STATUS,
  STAFF_STATUS,
  EQUIPMENT_STATUS,
  OT_STATUS,
  OT_CASE_STATUS,
  ALERT_SEVERITY,
  ALERT_STATUS,
  RECOMMENDATION_STATUS,
  RISK_LEVELS,
  AUTONOMY_MODES,
} from '../../utils/constants.js';

/**
 * Generates the unified, consistent hospital seed state.
 */
export function buildSeedHospital() {
  // ── 1. BEDS (Total 80) ───────────────────────────────────────────────────
  // Distribution:
  // Emergency: 15 (ER-01 to ER-15)
  // General Ward: 35 (GW-01 to GW-35)
  // HDU: 10 (HDU-01 to HDU-10)
  // ICU: 12 (ICU-01 to ICU-12)
  // Isolation: 8 (ISO-01 to ISO-08)
  const bedConfigs = [
    { dept: 'Emergency', prefix: 'ER', count: 15, type: 'General', floor: 1 },
    { dept: 'General Ward', prefix: 'GW', count: 35, type: 'General', floor: 2 },
    { dept: 'HDU', prefix: 'HDU', count: 10, type: 'HDU', floor: 3 },
    { dept: 'ICU', prefix: 'ICU', count: 12, type: 'ICU', floor: 3 },
    { dept: 'Isolation', prefix: 'ISO', count: 8, type: 'Isolation', floor: 4 },
  ];

  const beds = [];
  let bedSeq = 1;

  bedConfigs.forEach(({ dept, prefix, count, type, floor }) => {
    for (let i = 1; i <= count; i++) {
      const code = `${prefix}-${String(i).padStart(2, '0')}`;
      // Predetermined status distribution to simulate realistic high-occupancy hospital
      let status = BED_STATUS.OCCUPIED;
      if (i % 6 === 0) status = BED_STATUS.AVAILABLE;
      else if (i % 11 === 0) status = BED_STATUS.CLEANING;
      else if (i % 17 === 0) status = BED_STATUS.MAINTENANCE;
      else if (i % 13 === 0) status = BED_STATUS.RESERVED;

      // In ICU, keep occupancy ~83% (10 occupied out of 12)
      if (dept === 'ICU') {
        if (i === 11) status = BED_STATUS.AVAILABLE;
        else if (i === 12) status = BED_STATUS.CLEANING;
        else status = BED_STATUS.OCCUPIED;
      }

      beds.push({
        id: `bed-${bedSeq++}`,
        bedNumber: code,
        department: dept,
        type,
        floor,
        status,
        patientId: null, // linked during patient creation
        lastCleanedAt: new Date(Date.now() - (i * 3600000)).toISOString(),
        expectedReleaseTime: status === BED_STATUS.OCCUPIED 
          ? new Date(Date.now() + ((i % 5 + 1) * 3600000 * 2)).toISOString()
          : null,
        releaseConfidence: status === BED_STATUS.OCCUPIED ? 75 + (i % 20) : null,
        equipmentAttached: [],
      });
    }
  });

  // ── 2. PATIENTS (Total 25) ───────────────────────────────────────────────
  // 18 admitted to specific beds + 7 in Emergency waiting queue
  const patientProfiles = [
    // Waiting queue patients (7 in ER)
    { name: 'Arthur Pendelton', age: 67, gender: 'M', acuity: 1, chiefComplaint: 'Acute Myocardial Infarction', reqs: ['ICU', 'Ventilator', 'Monitor'], waitMins: 42, admitProb: 98, expectedLosDays: 5 },
    { name: 'Elena Rostova', age: 34, gender: 'F', acuity: 2, chiefComplaint: 'Severe Polytrauma (MVC)', reqs: ['HDU', 'Imaging'], waitMins: 35, admitProb: 94, expectedLosDays: 4 },
    { name: 'Marcus Chen', age: 52, gender: 'M', acuity: 2, chiefComplaint: 'Acute Sepsis / Hypotension', reqs: ['ICU', 'Isolation', 'Monitor'], waitMins: 28, admitProb: 91, expectedLosDays: 6 },
    { name: 'Sophia Al-Mansoor', age: 78, gender: 'F', acuity: 3, chiefComplaint: 'Exacerbation of COPD', reqs: ['General', 'Oxygen'], waitMins: 45, admitProb: 82, expectedLosDays: 3 },
    { name: 'David K. O\'Connor', age: 41, gender: 'M', acuity: 3, chiefComplaint: 'Appendicitis w/ Peritonitis', reqs: ['General', 'OT'], waitMins: 55, admitProb: 88, expectedLosDays: 2 },
    { name: 'Mei-Ling Zhou', age: 29, gender: 'F', acuity: 4, chiefComplaint: 'Moderate Dehydration / Pyelonephritis', reqs: ['General'], waitMins: 65, admitProb: 65, expectedLosDays: 2 },
    { name: 'Lucas Gabriel', age: 19, gender: 'M', acuity: 5, chiefComplaint: 'Closed Radius Fracture (Splinted)', reqs: ['Imaging'], waitMins: 80, admitProb: 15, expectedLosDays: 0 },

    // Admitted patients (18)
    { name: 'Jonathan Vance', age: 63, gender: 'M', acuity: 1, chiefComplaint: 'Post-CABG recovery', dept: 'ICU', bedCode: 'ICU-01', los: 3, reqs: ['Ventilator', 'Monitor'] },
    { name: 'Beatrice Webb', age: 71, gender: 'F', acuity: 2, chiefComplaint: 'CVA - Hemorrhagic Stroke', dept: 'ICU', bedCode: 'ICU-02', los: 4, reqs: ['Monitor'] },
    { name: 'Kareem Abdul', age: 58, gender: 'M', acuity: 1, chiefComplaint: 'ARDS secondary to Pneumonia', dept: 'ICU', bedCode: 'ICU-03', los: 6, reqs: ['Ventilator', 'Isolation'] },
    { name: 'Hannah Schmidt', age: 49, gender: 'F', acuity: 2, chiefComplaint: 'Subarachnoid Hemorrhage', dept: 'ICU', bedCode: 'ICU-04', los: 2, reqs: ['Monitor'] },
    { name: 'Robert Stirling', age: 82, gender: 'M', acuity: 2, chiefComplaint: 'Cardiogenic Shock', dept: 'ICU', bedCode: 'ICU-05', los: 5, reqs: ['Dialysis', 'Monitor'] },
    { name: 'Fatima Zahra', age: 39, gender: 'F', acuity: 2, chiefComplaint: 'Diabetic Ketoacidosis / Sepsis', dept: 'HDU', bedCode: 'HDU-01', los: 2, reqs: ['Monitor', 'Infusion Pump'] },
    { name: 'Gordon Cole', age: 66, gender: 'M', acuity: 3, chiefComplaint: 'Post Laparoscopic Colectomy', dept: 'HDU', bedCode: 'HDU-02', los: 1, reqs: ['Monitor'] },
    { name: 'Priya Patel', age: 31, gender: 'F', acuity: 3, chiefComplaint: 'Postpartum Hemorrhage stable', dept: 'HDU', bedCode: 'HDU-03', los: 2, reqs: ['Monitor'] },
    { name: 'Albert Fischer', age: 74, gender: 'M', acuity: 3, chiefComplaint: 'Community-Acquired Pneumonia', dept: 'General Ward', bedCode: 'GW-01', los: 3, reqs: [] },
    { name: 'Clara Oswald', age: 27, gender: 'F', acuity: 4, chiefComplaint: 'Pyelonephritis IV antibiotics', dept: 'General Ward', bedCode: 'GW-02', los: 2, reqs: [] },
    { name: 'Derrick Moore', age: 55, gender: 'M', acuity: 3, chiefComplaint: 'Total Knee Arthroplasty (D1)', dept: 'General Ward', bedCode: 'GW-03', los: 1, reqs: [] },
    { name: 'Nadia Petrova', age: 68, gender: 'F', acuity: 3, chiefComplaint: 'Heart Failure decompensation', dept: 'General Ward', bedCode: 'GW-04', los: 4, reqs: ['Monitor'] },
    { name: 'Samuel Jackson', age: 45, gender: 'M', acuity: 4, chiefComplaint: 'Cellulitis lower limb', dept: 'General Ward', bedCode: 'GW-05', los: 2, reqs: [] },
    { name: 'Grace Hopper', age: 85, gender: 'F', acuity: 3, chiefComplaint: 'Femoral neck fracture awaiting surgery', dept: 'General Ward', bedCode: 'GW-07', los: 1, reqs: [] },
    { name: 'Tariq Nasheed', age: 50, gender: 'M', acuity: 2, chiefComplaint: 'MRSA Bacteremia', dept: 'Isolation', bedCode: 'ISO-01', los: 7, reqs: ['Isolation'] },
    { name: 'Yvonne Arnaud', age: 62, gender: 'F', acuity: 2, chiefComplaint: 'C. Difficile colitis', dept: 'Isolation', bedCode: 'ISO-02', los: 5, reqs: ['Isolation'] },
    { name: 'Daniel Craig', age: 44, gender: 'M', acuity: 3, chiefComplaint: 'Observation post concussion', dept: 'Emergency', bedCode: 'ER-01', los: 0.5, reqs: ['Monitor'] },
    { name: 'Chloe Bourgeois', age: 23, gender: 'F', acuity: 4, chiefComplaint: 'Asthma exacerbation under nebulizer', dept: 'Emergency', bedCode: 'ER-02', los: 0.3, reqs: [] },
  ];

  const patients = patientProfiles.map((p, idx) => {
    const isWaiting = idx < 7;
    const targetBed = !isWaiting ? beds.find((b) => b.bedNumber === p.bedCode) : null;
    const patientId = `pat-${String(idx + 1).padStart(3, '0')}`;

    if (targetBed) {
      targetBed.patientId = patientId;
      targetBed.status = BED_STATUS.OCCUPIED;
    }

    return {
      id: patientId,
      mrn: `MRN-${20260000 + idx + 1}`,
      name: p.name,
      age: p.age,
      gender: p.gender,
      acuity: p.acuity,
      status: isWaiting ? PATIENT_STATUS.WAITING : PATIENT_STATUS.ADMITTED,
      chiefComplaint: p.chiefComplaint,
      department: isWaiting ? 'Emergency' : p.dept,
      bedId: targetBed ? targetBed.id : null,
      bedCode: targetBed ? targetBed.bedNumber : null,
      waitingTimeMinutes: isWaiting ? p.waitMins : 0,
      admissionProbability: isWaiting ? p.admitProb : 100,
      expectedLosDays: isWaiting ? p.expectedLosDays : p.los,
      requirements: p.reqs || [],
      admittedAt: isWaiting ? null : new Date(Date.now() - (p.los * 86400000)).toISOString(),
      registeredAt: new Date(Date.now() - ((p.waitMins || 120) * 60000)).toISOString(),
      attendingDoctorId: isWaiting ? null : `staff-${(idx % 10) + 1}`,
      notes: `${p.chiefComplaint}. Patient stable under current protocol.`,
    };
  });

  // Assign remaining occupied beds without explicit patient profiles to synthesized patient IDs
  beds.forEach((bed, bIdx) => {
    if (bed.status === BED_STATUS.OCCUPIED && !bed.patientId) {
      const synId = `pat-${String(26 + bIdx).padStart(3, '0')}`;
      bed.patientId = synId;
    }
  });

  // ── 3. STAFF (Total 40) ───────────────────────────────────────────────────
  // 15 Doctors / Surgeons, 20 Nurses, 5 Technicians / Orderlies
  const staff = [];
  const staffConfigs = [
    // Doctors (15)
    { name: 'Dr. Sarah Lin, MD', role: 'Doctor', title: 'Chief of Emergency Medicine', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 88, fatigue: 65, shift: 'Day' },
    { name: 'Dr. Marcus Brody, MD', role: 'Doctor', title: 'Attending Intensivist', dept: 'ICU', status: STAFF_STATUS.ON_DUTY, workload: 92, fatigue: 82, shift: 'Day' },
    { name: 'Dr. Alistair Vance, MD', role: 'Surgeon', title: 'Lead Cardiothoracic Surgeon', dept: 'OT', status: STAFF_STATUS.IN_SURGERY, workload: 95, fatigue: 78, shift: 'Day' },
    { name: 'Dr. Priya Nair, MD', role: 'Doctor', title: 'Internal Medicine Specialist', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 76, fatigue: 55, shift: 'Day' },
    { name: 'Dr. Kenneth Clark, MD', role: 'Anesthetist', title: 'Senior Anesthesiologist', dept: 'OT', status: STAFF_STATUS.IN_SURGERY, workload: 84, fatigue: 70, shift: 'Day' },
    { name: 'Dr. Elena Vasquez, MD', role: 'Doctor', title: 'Pulmonologist & HDU Lead', dept: 'HDU', status: STAFF_STATUS.ON_DUTY, workload: 79, fatigue: 62, shift: 'Day' },
    { name: 'Dr. James Wilson, MD', role: 'Doctor', title: 'Infectious Disease Consultant', dept: 'Isolation', status: STAFF_STATUS.ON_CALL, workload: 45, fatigue: 30, shift: 'On Call' },
    { name: 'Dr. Rachel Green, MD', role: 'Surgeon', title: 'Orthopedic Trauma Surgeon', dept: 'OT', status: STAFF_STATUS.AVAILABLE, workload: 68, fatigue: 50, shift: 'Day' },
    { name: 'Dr. Thomas Wayne, MD', role: 'Doctor', title: 'Emergency Physician', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 94, fatigue: 89, shift: 'Day' },
    { name: 'Dr. Lisa Cuddy, MD', role: 'Doctor', title: 'Hospital Medical Director', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 60, fatigue: 45, shift: 'Day' },
    { name: 'Dr. Robert Chase, MD', role: 'Doctor', title: 'Intensivist Fellow', dept: 'ICU', status: STAFF_STATUS.ON_DUTY, workload: 86, fatigue: 72, shift: 'Day' },
    { name: 'Dr. Eric Foreman, MD', role: 'Doctor', title: 'Neurologist', dept: 'General Ward', status: STAFF_STATUS.AVAILABLE, workload: 52, fatigue: 40, shift: 'Day' },
    { name: 'Dr. Chris Turk, MD', role: 'Surgeon', title: 'General & Laparoscopic Surgeon', dept: 'OT', status: STAFF_STATUS.ON_DUTY, workload: 75, fatigue: 60, shift: 'Day' },
    { name: 'Dr. John Dorian, MD', role: 'Doctor', title: 'Attending Physician', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 82, fatigue: 68, shift: 'Day' },
    { name: 'Dr. Allison Cameron, MD', role: 'Doctor', title: 'Immunology Specialist', dept: 'Isolation', status: STAFF_STATUS.ON_DUTY, workload: 64, fatigue: 52, shift: 'Day' },

    // Nurses (20)
    { name: 'Nurse Clara Barton, RN', role: 'Nurse', title: 'Charge Nurse ER', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 96, fatigue: 92, shift: 'Day' },
    { name: 'Nurse Carla Espinosa, RN', role: 'Nurse', title: 'Head Nurse ICU', dept: 'ICU', status: STAFF_STATUS.ON_DUTY, workload: 94, fatigue: 88, shift: 'Day' },
    { name: 'Nurse Jackie Peyton, RN', role: 'Nurse', title: 'Triage Nurse', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 92, fatigue: 84, shift: 'Day' },
    { name: 'Nurse Florence Nightingale, RN', role: 'Nurse', title: 'Senior Staff Nurse', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 78, fatigue: 60, shift: 'Day' },
    { name: 'Nurse Margaret Houlihan, RN', role: 'Nurse', title: 'OT Circulating Nurse', dept: 'OT', status: STAFF_STATUS.IN_SURGERY, workload: 90, fatigue: 76, shift: 'Day' },
    { name: 'Nurse David Kim, RN', role: 'Nurse', title: 'ICU Staff Nurse', dept: 'ICU', status: STAFF_STATUS.ON_DUTY, workload: 88, fatigue: 70, shift: 'Day' },
    { name: 'Nurse Samantha Bell, RN', role: 'Nurse', title: 'HDU Staff Nurse', dept: 'HDU', status: STAFF_STATUS.ON_DUTY, workload: 80, fatigue: 65, shift: 'Day' },
    { name: 'Nurse Liam Vance, RN', role: 'Nurse', title: 'Isolation Ward Specialist', dept: 'Isolation', status: STAFF_STATUS.ON_DUTY, workload: 72, fatigue: 58, shift: 'Day' },
    { name: 'Nurse Chloe Dupont, RN', role: 'Nurse', title: 'ER Staff Nurse', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 91, fatigue: 85, shift: 'Day' },
    { name: 'Nurse Ethan Hunt, RN', role: 'Nurse', title: 'General Ward Nurse', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 74, fatigue: 50, shift: 'Day' },
    { name: 'Nurse Olivia Wilde, RN', role: 'Nurse', title: 'OT Scrub Nurse', dept: 'OT', status: STAFF_STATUS.IN_SURGERY, workload: 89, fatigue: 74, shift: 'Day' },
    { name: 'Nurse Mason Cooper, RN', role: 'Nurse', title: 'ICU Staff Nurse', dept: 'ICU', status: STAFF_STATUS.ON_BREAK, workload: 85, fatigue: 75, shift: 'Day' },
    { name: 'Nurse Sophia Loren, RN', role: 'Nurse', title: 'General Ward Nurse', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 71, fatigue: 48, shift: 'Day' },
    { name: 'Nurse Lucas Scott, RN', role: 'Nurse', title: 'General Ward Nurse', dept: 'General Ward', status: STAFF_STATUS.ON_DUTY, workload: 68, fatigue: 42, shift: 'Day' },
    { name: 'Nurse Mia Wallace, RN', role: 'Nurse', title: 'ER Float Nurse', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 87, fatigue: 80, shift: 'Day' },
    { name: 'Nurse Noah Bennett, RN', role: 'Nurse', title: 'HDU Staff Nurse', dept: 'HDU', status: STAFF_STATUS.ON_DUTY, workload: 79, fatigue: 64, shift: 'Day' },
    { name: 'Nurse Harper Lee, RN', role: 'Nurse', title: 'Isolation Staff Nurse', dept: 'Isolation', status: STAFF_STATUS.AVAILABLE, workload: 40, fatigue: 25, shift: 'Day' },
    { name: 'Nurse Benjamin Franklin, RN', role: 'Nurse', title: 'Night Shift Supervisor', dept: 'General Ward', status: STAFF_STATUS.OFF_DUTY, workload: 0, fatigue: 15, shift: 'Night' },
    { name: 'Nurse Zoe Saldana, RN', role: 'Nurse', title: 'Night Float Nurse', dept: 'Emergency', status: STAFF_STATUS.OFF_DUTY, workload: 0, fatigue: 10, shift: 'Night' },
    { name: 'Nurse William Osler, RN', role: 'Nurse', title: 'Night ICU Nurse', dept: 'ICU', status: STAFF_STATUS.OFF_DUTY, workload: 0, fatigue: 12, shift: 'Night' },

    // Technicians & Support (5)
    { name: 'Tech Raymond Palmer', role: 'Technician', title: 'Radiology Chief Tech', dept: 'Radiology', status: STAFF_STATUS.ON_DUTY, workload: 85, fatigue: 68, shift: 'Day' },
    { name: 'Tech Walter Bishop', role: 'Technician', title: 'Biomedical Equipment Specialist', dept: 'ICU', status: STAFF_STATUS.ON_DUTY, workload: 72, fatigue: 55, shift: 'Day' },
    { name: 'Tech Astrid Farnsworth', role: 'Technician', title: 'CT & MRI Lead Operator', dept: 'Radiology', status: STAFF_STATUS.ON_DUTY, workload: 88, fatigue: 70, shift: 'Day' },
    { name: 'Orderly Bruce Banner', role: 'Technician', title: 'Patient Transport Coordinator', dept: 'Emergency', status: STAFF_STATUS.ON_DUTY, workload: 92, fatigue: 86, shift: 'Day' },
    { name: 'Orderly Peter Parker', role: 'Technician', title: 'Patient Transport Lead', dept: 'General Ward', status: STAFF_STATUS.AVAILABLE, workload: 65, fatigue: 45, shift: 'Day' },
  ];

  staffConfigs.forEach((s, idx) => {
    staff.push({
      id: `staff-${idx + 1}`,
      employeeId: `EMP-${1000 + idx + 1}`,
      name: s.name,
      role: s.role,
      title: s.title,
      department: s.dept,
      status: s.status,
      workload: s.workload,
      fatigue: s.fatigue,
      shift: s.shift,
      contact: `+1 (555) 019-${String(idx + 1).padStart(2, '0')}`,
      assignedPatientsCount: s.role === 'Nurse' ? Math.floor(s.workload / 20) : Math.floor(s.workload / 25),
      currentLocation: s.dept,
    });
  });

  // ── 4. EQUIPMENT (Total 15) ──────────────────────────────────────────────
  const equipmentConfigs = [
    { type: 'Ventilator', model: 'Puritan Bennett 980', dept: 'ICU', location: 'Bed ICU-01', status: EQUIPMENT_STATUS.IN_USE, battery: 98, maintenanceDue: '2026-11-15' },
    { type: 'Ventilator', model: 'Puritan Bennett 980', dept: 'ICU', location: 'Bed ICU-03', status: EQUIPMENT_STATUS.IN_USE, battery: 95, maintenanceDue: '2026-11-20' },
    { type: 'Ventilator', model: 'Hamilton-G5 Transport', dept: 'Emergency', location: 'Bay ER-04', status: EQUIPMENT_STATUS.AVAILABLE, battery: 84, maintenanceDue: '2026-12-01' },
    { type: 'Ventilator', model: 'Hamilton-C6', dept: 'ICU', location: 'Clean Supply Bay 3', status: EQUIPMENT_STATUS.AVAILABLE, battery: 100, maintenanceDue: '2026-12-10' },
    { type: 'Defibrillator', model: 'Zoll X Series', dept: 'Emergency', location: 'Crash Cart ER-1', status: EQUIPMENT_STATUS.AVAILABLE, battery: 100, maintenanceDue: '2026-10-30' },
    { type: 'Defibrillator', model: 'Zoll X Series', dept: 'ICU', location: 'Crash Cart ICU-Central', status: EQUIPMENT_STATUS.AVAILABLE, battery: 94, maintenanceDue: '2026-11-05' },
    { type: 'Defibrillator', model: 'Philips Tempus ALS', dept: 'General Ward', location: 'Floor 2 Station', status: EQUIPMENT_STATUS.MAINTENANCE, battery: 15, maintenanceDue: '2026-10-02' },
    { type: 'Infusion Pump', model: 'Alaris System 8015', dept: 'ICU', location: 'Bed ICU-02', status: EQUIPMENT_STATUS.IN_USE, battery: 78, maintenanceDue: '2026-12-05' },
    { type: 'Infusion Pump', model: 'Alaris System 8015', dept: 'HDU', location: 'Bed HDU-01', status: EQUIPMENT_STATUS.IN_USE, battery: 88, maintenanceDue: '2026-12-05' },
    { type: 'Infusion Pump', model: 'Baxter Sigma Spectrum', dept: 'General Ward', location: 'Clean Utility Rm', status: EQUIPMENT_STATUS.AVAILABLE, battery: 92, maintenanceDue: '2026-11-28' },
    { type: 'Dialysis', model: 'Fresenius 5008S', dept: 'ICU', location: 'Bed ICU-05', status: EQUIPMENT_STATUS.IN_USE, battery: 100, maintenanceDue: '2026-11-10' },
    { type: 'Dialysis', model: 'Baxter Prismaflex CRRT', dept: 'ICU', location: 'Equipment Rm B', status: EQUIPMENT_STATUS.AVAILABLE, battery: 100, maintenanceDue: '2026-12-15' },
    { type: 'X-Ray', model: 'GE Definium AMX 700 Mobile', dept: 'Emergency', location: 'Trauma Bay 1', status: EQUIPMENT_STATUS.IN_USE, battery: 64, maintenanceDue: '2026-11-01' },
    { type: 'X-Ray', model: 'Siemens Mobilett Elara Max', dept: 'Radiology', location: 'Rad Bay 2', status: EQUIPMENT_STATUS.AVAILABLE, battery: 85, maintenanceDue: '2026-11-25' },
    { type: 'Ultrasound', model: 'GE Venue Point-of-Care', dept: 'Emergency', location: 'Bay ER-02', status: EQUIPMENT_STATUS.IN_USE, battery: 45, maintenanceDue: '2026-10-25' },
  ];

  const equipment = equipmentConfigs.map((eq, idx) => ({
    id: `eq-${String(idx + 1).padStart(3, '0')}`,
    assetTag: `AST-${7000 + idx + 1}`,
    name: `${eq.type} (${eq.model})`,
    type: eq.type,
    model: eq.model,
    department: eq.dept,
    location: eq.location,
    status: eq.status,
    batteryPercentage: eq.battery,
    maintenanceDueDate: eq.maintenanceDue,
    isWarning: eq.battery <= 20 || eq.status === EQUIPMENT_STATUS.MAINTENANCE,
    lastInspectedAt: new Date(Date.now() - ((idx + 2) * 86400000)).toISOString(),
    assignedPatientId: eq.status === EQUIPMENT_STATUS.IN_USE ? `pat-${String(idx + 1).padStart(3, '0')}` : null,
  }));

  // Link equipment back to beds
  equipment.forEach((eq) => {
    if (eq.location.startsWith('Bed ')) {
      const bCode = eq.location.replace('Bed ', '');
      const bed = beds.find((b) => b.bedNumber === bCode);
      if (bed) bed.equipmentAttached.push(eq.name);
    }
  });

  // ── 5. OPERATING THEATRES (4 Rooms) ──────────────────────────────────────
  const otRooms = [
    {
      id: 1,
      name: 'OT-1 (Emergency & Trauma)',
      status: OT_STATUS.IN_USE,
      currentCase: {
        id: 'case-101',
        procedure: 'Exploratory Laparotomy for Acute Abdomen',
        patientName: 'David K. O\'Connor',
        patientId: 'pat-005',
        surgeonName: 'Dr. Chris Turk, MD',
        anesthetistName: 'Dr. Kenneth Clark, MD',
        startTime: new Date(Date.now() - (45 * 60000)).toISOString(),
        scheduledDurationMinutes: 90,
        estimatedEndTime: new Date(Date.now() + (45 * 60000)).toISOString(),
        isOverrun: false,
        overrunMinutes: 0,
      },
      nextAvailableTime: new Date(Date.now() + (75 * 60000)).toISOString(),
      schedule: [
        { id: 'case-101', title: 'Exploratory Laparotomy', start: '08:00', end: '10:00', status: OT_CASE_STATUS.IN_PROGRESS, type: 'emergency' },
        { id: 'turnover-1', title: 'Cleaning & Sterilization', start: '10:00', end: '10:30', status: 'turnover', type: 'cleaning' },
        { id: 'case-102', title: 'Emergency Appendectomy', start: '10:30', end: '12:00', status: OT_CASE_STATUS.SCHEDULED, type: 'elective' },
        { id: 'turnover-2', title: 'Cleaning & Sterilization', start: '12:00', end: '12:30', status: 'turnover', type: 'cleaning' },
        { id: 'case-103', title: 'Debridement & Skin Graft', start: '13:00', end: '15:30', status: OT_CASE_STATUS.SCHEDULED, type: 'elective' },
      ],
    },
    {
      id: 2,
      name: 'OT-2 (Cardiothoracic & Vascular)',
      status: OT_STATUS.IN_USE,
      currentCase: {
        id: 'case-201',
        procedure: 'Coronary Artery Bypass Graft (x3)',
        patientName: 'Jonathan Vance',
        patientId: 'pat-008',
        surgeonName: 'Dr. Alistair Vance, MD',
        anesthetistName: 'Dr. Kenneth Clark, MD',
        startTime: new Date(Date.now() - (160 * 60000)).toISOString(),
        scheduledDurationMinutes: 180,
        estimatedEndTime: new Date(Date.now() + (50 * 60000)).toISOString(),
        isOverrun: true,
        overrunMinutes: 30,
      },
      nextAvailableTime: new Date(Date.now() + (90 * 60000)).toISOString(),
      schedule: [
        { id: 'case-201', title: 'CABG x3 (Overrun)', start: '07:30', end: '11:00', status: OT_CASE_STATUS.IN_PROGRESS, type: 'elective', isOverrun: true },
        { id: 'turnover-3', title: 'Deep Sterilization', start: '11:00', end: '11:45', status: 'turnover', type: 'cleaning' },
        { id: 'case-202', title: 'Aortic Valve Replacement', start: '11:45', end: '15:00', status: OT_CASE_STATUS.SCHEDULED, type: 'elective' },
      ],
    },
    {
      id: 3,
      name: 'OT-3 (Orthopedic Surgery)',
      status: OT_STATUS.AVAILABLE,
      currentCase: null,
      nextAvailableTime: 'Now',
      schedule: [
        { id: 'case-301', title: 'Total Hip Replacement', start: '07:00', end: '09:30', status: OT_CASE_STATUS.COMPLETED, type: 'elective' },
        { id: 'turnover-4', title: 'Cleaning & Setup', start: '09:30', end: '10:00', status: 'turnover', type: 'cleaning' },
        { id: 'case-302', title: 'Arthroscopic Rotator Cuff', start: '10:30', end: '12:30', status: OT_CASE_STATUS.SCHEDULED, type: 'elective' },
        { id: 'case-303', title: 'Femur Intramedullary Nail', start: '13:30', end: '16:00', status: OT_CASE_STATUS.SCHEDULED, type: 'elective' },
      ],
    },
    {
      id: 4,
      name: 'OT-4 (Neurosurgery & Day Surgery)',
      status: OT_STATUS.CLEANING,
      currentCase: null,
      nextAvailableTime: new Date(Date.now() + (25 * 60000)).toISOString(),
      schedule: [
        { id: 'case-401', title: 'Craniotomy for Subdural Evacuation', start: '06:30', end: '09:45', status: OT_CASE_STATUS.COMPLETED, type: 'emergency' },
        { id: 'turnover-5', title: 'Bio-Cleaning Cycle', start: '09:45', end: '10:30', status: 'turnover', type: 'cleaning' },
        { id: 'case-402', title: 'Lumbar Microdiscectomy', start: '10:45', end: '12:45', status: OT_CASE_STATUS.SCHEDULED, type: 'elective' },
      ],
    },
  ];

  // ── 6. ALERTS ────────────────────────────────────────────────────────────
  const alerts = [
    {
      id: 'alt-001',
      title: 'ICU Capacity Critical (83.3% Occupied)',
      description: 'Only 2 beds remaining in ICU with 2 high-acuity patients waiting in Emergency with admission probabilities >90%.',
      severity: ALERT_SEVERITY.CRITICAL,
      department: 'ICU',
      status: ALERT_STATUS.OPEN,
      escalationLevel: 3,
      createdAt: new Date(Date.now() - 14 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 60000).toISOString(),
      metadata: { currentOccupied: 10, totalCapacity: 12, predictedIncoming2h: 3 },
    },
    {
      id: 'alt-002',
      title: 'Operating Theatre 2 Schedule Overrun (+30m)',
      description: 'CABG case is exceeding estimated slot by 30 mins, cascading delay onto scheduled Aortic Valve Replacement.',
      severity: ALERT_SEVERITY.HIGH,
      department: 'OT',
      status: ALERT_STATUS.OPEN,
      escalationLevel: 2,
      createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      metadata: { otRoomId: 2, overrunMinutes: 30, impactedCaseId: 'case-202' },
    },
    {
      id: 'alt-003',
      title: 'Emergency Triage Nurse Workload Warning (>90%)',
      description: 'Triage and charge nurses in Emergency department have exceeded 92% workload threshold over last 2 hours.',
      severity: ALERT_SEVERITY.HIGH,
      department: 'Emergency',
      status: ALERT_STATUS.OPEN,
      escalationLevel: 2,
      createdAt: new Date(Date.now() - 38 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 60000).toISOString(),
      metadata: { affectedRoles: ['Triage Nurse', 'Charge Nurse'], averageWorkload: 93 },
    },
    {
      id: 'alt-004',
      title: 'Defibrillator AST-7007 Low Battery in General Ward',
      description: 'Emergency defibrillator located at Floor 2 Nurse Station battery is at 15%. Needs immediate dock placement.',
      severity: ALERT_SEVERITY.MEDIUM,
      department: 'General Ward',
      status: ALERT_STATUS.OPEN,
      escalationLevel: 1,
      createdAt: new Date(Date.now() - 50 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 60000).toISOString(),
      metadata: { assetTag: 'AST-7007', battery: 15 },
    },
    {
      id: 'alt-005',
      title: 'Extended ED Wait Time for Acuity 3 Patient',
      description: 'Patient Sophia Al-Mansoor waiting 45 minutes in Emergency without bed allocation (target: <30 mins).',
      severity: ALERT_SEVERITY.MEDIUM,
      department: 'Emergency',
      status: ALERT_STATUS.OPEN,
      escalationLevel: 1,
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 60000).toISOString(),
      metadata: { patientId: 'pat-004', waitingMinutes: 45 },
    },
    {
      id: 'alt-006',
      title: 'Bed Turnover Delay in General Ward GW-12',
      description: 'Bed has been marked in Cleaning state for 85 minutes exceeding normal turnaround SLA of 45 minutes.',
      severity: ALERT_SEVERITY.LOW,
      department: 'General Ward',
      status: ALERT_STATUS.ACKNOWLEDGED,
      escalationLevel: 1,
      createdAt: new Date(Date.now() - 95 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 40 * 60000).toISOString(),
      metadata: { bedCode: 'GW-12', cleaningMinutes: 85 },
    },
  ];

  // ── 7. RECOMMENDATIONS ───────────────────────────────────────────────────
  const recommendations = [
    {
      id: 'rec-001',
      type: 'bed_transfer',
      title: 'Expedite Step-Down: Transfer HDU-01 to General Ward Bed GW-08',
      summary: 'Patient Fatima Zahra has stabilized (O2 sat 98%, lactate cleared). Transfer opens HDU bed for incoming ER trauma.',
      risk: RISK_LEVELS.MEDIUM,
      status: RECOMMENDATION_STATUS.PENDING,
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
      actions: [
        { type: 'discharge_transfer', from: 'HDU-01', to: 'GW-08', patientId: 'pat-006', patientName: 'Fatima Zahra' },
        { type: 'allocate_bed', from: 'Emergency Queue', to: 'HDU-01', patientId: 'pat-002', patientName: 'Elena Rostova' },
      ],
      explain: {
        why: [
          'Elena Rostova (Acuity 2, Polytrauma) in ER waiting 35 mins requiring immediate HDU level monitoring.',
          'Fatima Zahra clinical parameters have met step-down criteria for over 6 hours.',
          'Bed GW-08 is currently cleaned and ready for immediate occupancy.',
        ],
        constraintsChecked: [
          'Attending intensivist clinical sign-off protocol',
          'Telemetry monitoring availability in GW-08 confirmed',
          'Nurse-to-patient ratio in General Ward remains within safe limits (1:4)',
          'Patient transport orderly available within 10 minutes',
        ],
        expectedBenefit: 'Reduces ED boarding time by 45 mins; prevents HDU bed saturation bottleneck.',
      },
    },
    {
      id: 'rec-002',
      type: 'staff_reallocation',
      title: 'Float Nurse Reallocation: Reassign Nurse Harper Lee to Emergency',
      summary: 'Move Nurse Harper Lee from low-load Isolation Ward (load 40%) to Emergency triage support (load >92%).',
      risk: RISK_LEVELS.LOW,
      status: RECOMMENDATION_STATUS.PENDING,
      createdAt: new Date(Date.now() - 22 * 60000).toISOString(),
      actions: [
        { type: 'reassign_staff', staffId: 'staff-32', staffName: 'Nurse Harper Lee, RN', fromDept: 'Isolation', toDept: 'Emergency', shiftDuration: '4 hours' },
      ],
      explain: {
        why: [
          'Emergency nurse load at critical threshold (93% avg across ER staff).',
          'Isolation census is currently 2 patients with 2 assigned nurses (ratio 1:1, required 1:2).',
          'Nurse Harper Lee is fully certified in triage emergency protocols.',
        ],
        constraintsChecked: [
          'Mandatory staff rest break requirements respected',
          'Isolation patient coverage remains fully compliant',
          'Nurse skill qualification verified for acute triage',
        ],
        expectedBenefit: 'Reduces ER triage queue delay from 42 mins to 18 mins; stabilizes staff fatigue.',
      },
    },
    {
      id: 'rec-003',
      type: 'ot_reschedule',
      title: 'OT-2 Case Balancing: Shift Case-202 to OT-3',
      summary: 'Divert scheduled Aortic Valve Replacement to OT-3 which is currently available and pre-cleared.',
      risk: RISK_LEVELS.HIGH,
      status: RECOMMENDATION_STATUS.PENDING,
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      actions: [
        { type: 'reschedule_ot', caseId: 'case-202', fromOt: 'OT-2', toOt: 'OT-3', newStartTime: '11:15' },
      ],
      explain: {
        why: [
          'OT-2 CABG surgery is running 30 mins over schedule and will disrupt subsequent elective.',
          'OT-3 completed early and is currently sterile and vacant.',
          'Perfusionist and specialized surgical equipment can be transitioned seamlessly.',
        ],
        constraintsChecked: [
          'Cardiac surgical scrub team availability in OT-3 confirmed',
          'Specialized bypass perfusion equipment compatible in OT-3',
          'Surgeon Dr. Alistair Vance scheduled buffer verified',
        ],
        expectedBenefit: 'Eliminates 75 min anticipated elective delay and avoids evening surgical overtime.',
      },
    },
  ];

  // ── 8. BOTTLENECKS & CASCADE CHAINS ──────────────────────────────────────
  const bottlenecks = [
    {
      id: 'btn-1',
      title: 'Emergency -> ICU Admission Chokepoint',
      severity: 'critical',
      department: 'Emergency / ICU',
      summary: 'High ER arrivals (2.8x normal) with near-capacity ICU (83.3%) causing cascade hold in Trauma bays.',
      impactedPatients: 3,
      cascadeChain: [
        { stage: 'Root Cause', description: 'Surge of 3 critical trauma admissions in last 45 mins', dept: 'Emergency' },
        { stage: 'Immediate Impact', description: 'Trauma Bays 1 & 2 occupied, holding in acute ER beds', dept: 'Emergency' },
        { stage: 'Upstream Choke', description: 'ICU has only 2 available beds, step-down discharges delayed', dept: 'ICU' },
        { stage: 'Downstream Risk', description: 'Ambulance diversion protocol will trigger if next arrival wait > 60m', dept: 'System' },
      ],
    },
    {
      id: 'btn-2',
      title: 'OT-2 Cardiac Surgical Overrun Cascading to ICU Recovery',
      severity: 'warning',
      department: 'OT / ICU',
      summary: 'Case overrun of +30m in OT-2 delays surgical completion and shifts peak ICU recovery bed demand into late afternoon.',
      impactedPatients: 2,
      cascadeChain: [
        { stage: 'Root Cause', description: 'Complex calcification during CABG in OT-2', dept: 'OT' },
        { stage: 'Immediate Impact', description: 'OT-2 schedule overrun by 30 mins, elective delayed', dept: 'OT' },
        { stage: 'Downstream Impact', description: 'ICU Bed 01 hold extended; surgical recovery clash at 14:00', dept: 'ICU' },
      ],
    },
  ];

  // ── 9. MASTER KPIS ───────────────────────────────────────────────────────
  // Calculate exact statistics matching the seed state:
  const occupiedBeds = beds.filter((b) => b.status === BED_STATUS.OCCUPIED).length;
  const icuOccupied = beds.filter((b) => b.department === 'ICU' && b.status === BED_STATUS.OCCUPIED).length;
  const icuTotal = beds.filter((b) => b.department === 'ICU').length;
  const icuOccupancyPct = Math.round((icuOccupied / icuTotal) * 100);
  const totalOccupancyPct = Math.round((occupiedBeds / beds.length) * 100);

  const kpis = {
    edWaitTimeMinutes: 38,
    edWaitTimeChange: +6,
    overallBedOccupancyPct: totalOccupancyPct,
    overallBedOccupancyChange: +2.4,
    icuOccupancyPct: icuOccupancyPct,
    icuOccupancyChange: +8.3,
    otUtilizationPct: 78,
    otUtilizationChange: -3.1,
    staffOvertimeHours: 42.5,
    staffOvertimeChange: +5.2,
    activeAlertsCount: alerts.filter((a) => a.status !== ALERT_STATUS.RESOLVED).length,
    pendingRecommendationsCount: recommendations.filter((r) => r.status === RECOMMENDATION_STATUS.PENDING).length,
    lastUpdated: new Date().toISOString(),
  };

  // ── 10. AUDIT LOGS ───────────────────────────────────────────────────────
  const auditLogs = [
    {
      id: 'aud-001',
      timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
      userName: 'Dr. Sarah Lin, MD',
      userRole: 'doctor',
      action: 'PATIENT_TRIAGED',
      details: 'Assigned Acuity 1 to Arthur Pendelton in Emergency',
      ip: '192.168.1.104',
    },
    {
      id: 'aud-002',
      timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
      userName: 'Admin Marcus Sterling',
      userRole: 'admin',
      action: 'ALERT_ACKNOWLEDGED',
      details: 'Acknowledged alert ALT-006 (Bed turnover delay GW-12)',
      ip: '192.168.1.10',
    },
    {
      id: 'aud-003',
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      userName: 'Dr. Alistair Vance, MD',
      userRole: 'doctor',
      action: 'OT_CASE_STARTED',
      details: 'Commenced CABG x3 procedure in OT-2',
      ip: '192.168.1.55',
    },
    {
      id: 'aud-004',
      timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
      userName: 'Nurse Carla Espinosa, RN',
      userRole: 'nurse_manager',
      action: 'BED_STATUS_CHANGED',
      details: 'Marked Bed ICU-11 as Available after terminal clean',
      ip: '192.168.1.82',
    },
  ];

  return {
    beds,
    patients,
    staff,
    equipment,
    otRooms,
    alerts,
    recommendations,
    bottlenecks,
    kpis,
    auditLogs,
    autonomyMode: AUTONOMY_MODES.APPROVAL,
  };
}

// Singleton state instance for mock session
export let hospitalState = buildSeedHospital();

/**
 * Resets the in-memory hospital state back to the original seed.
 */
export function resetHospitalState() {
  hospitalState = buildSeedHospital();
  return hospitalState;
}
