/**
 * @file beds.js
 * Mock handlers for hospital bed operations.
 */

import { hospitalState } from './seed.js';
import { BED_STATUS } from '../../utils/constants.js';

/**
 * Get all beds with optional filtering.
 */
export function mockGetBeds(params = {}) {
  const { department, status, type, search } = params;
  let list = [...hospitalState.beds];

  if (department && department !== 'all') {
    list = list.filter((b) => b.department.toLowerCase() === department.toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter((b) => b.status === status);
  }

  if (type && type !== 'all') {
    list = list.filter((b) => b.type.toLowerCase() === type.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (b) =>
        b.bedNumber.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        (b.patientId && b.patientId.toLowerCase().includes(q))
    );
  }

  // Populate patient alias and details if occupied
  const enriched = list.map((b) => {
    const patient = b.patientId
      ? hospitalState.patients.find((p) => p.id === b.patientId)
      : null;
    return {
      ...b,
      patientName: patient ? patient.name : null,
      patientAcuity: patient ? patient.acuity : null,
      patientDiagnosis: patient ? patient.chiefComplaint : null,
    };
  });

  return enriched;
}

/**
 * Get bed by ID with detailed relationship information.
 */
export function mockGetBedById(id) {
  const bed = hospitalState.beds.find((b) => b.id === id || b.bedNumber === id);
  if (!bed) {
    throw new Error(`Bed ${id} not found`);
  }

  const patient = bed.patientId
    ? hospitalState.patients.find((p) => p.id === bed.patientId)
    : null;

  return {
    ...bed,
    patient,
  };
}

/**
 * Update bed status (e.g. available -> cleaning -> occupied).
 */
export function mockUpdateBedStatus(id, newStatus) {
  const bed = hospitalState.beds.find((b) => b.id === id || b.bedNumber === id);
  if (!bed) {
    throw new Error(`Bed ${id} not found`);
  }

  bed.status = newStatus;
  if (newStatus === BED_STATUS.AVAILABLE) {
    bed.patientId = null;
    bed.expectedReleaseTime = null;
    bed.releaseConfidence = null;
    bed.lastCleanedAt = new Date().toISOString();
  } else if (newStatus === BED_STATUS.CLEANING) {
    bed.patientId = null;
  }

  // Record audit log
  hospitalState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userName: 'Current Operator',
    userRole: 'bed_manager',
    action: 'BED_STATUS_CHANGED',
    details: `Updated bed ${bed.bedNumber} to status ${newStatus}`,
    ip: '127.0.0.1',
  });

  return bed;
}

/**
 * Get AI-ranked bed suggestions for an unplaced patient.
 */
export function mockGetBedSuggestions(patientId) {
  const patient = hospitalState.patients.find((p) => p.id === patientId);
  const availableBeds = hospitalState.beds.filter(
    (b) => b.status === BED_STATUS.AVAILABLE || b.status === BED_STATUS.CLEANING
  );

  // Score candidate beds based on department, acuity, equipment
  const scored = availableBeds.map((bed) => {
    let score = 70;
    const reasons = [];

    if (patient) {
      if (patient.acuity === 1 && bed.department === 'ICU') {
        score += 25;
        reasons.push('Direct ICU clinical acuity protocol match');
      } else if (patient.acuity === 2 && (bed.department === 'HDU' || bed.department === 'ICU')) {
        score += 20;
        reasons.push('High-dependency telemetry monitoring compatibility');
      } else if (patient.acuity >= 3 && bed.department === 'General Ward') {
        score += 20;
        reasons.push('Optimally conserves critical ICU/HDU capacity');
      }

      if (bed.status === BED_STATUS.AVAILABLE) {
        score += 10;
        reasons.push('Immediate zero-wait turnover status');
      } else if (bed.status === BED_STATUS.CLEANING) {
        score -= 5;
        reasons.push('Ready in approx 15 mins post-sanitization');
      }
    }

    return {
      bedId: bed.id,
      bedNumber: bed.bedNumber,
      department: bed.department,
      type: bed.type,
      floor: bed.floor,
      status: bed.status,
      score: Math.min(score, 99),
      reasons,
    };
  });

  // Sort descending by score and return top 3
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * Get distribution of bed statuses for the StatusDoughnut chart.
 */
export function mockGetBedStatusDistribution() {
  const counts = {
    [BED_STATUS.AVAILABLE]: 0,
    [BED_STATUS.OCCUPIED]: 0,
    [BED_STATUS.CLEANING]: 0,
    [BED_STATUS.MAINTENANCE]: 0,
    [BED_STATUS.RESERVED]: 0,
  };

  hospitalState.beds.forEach((b) => {
    if (counts[b.status] !== undefined) {
      counts[b.status]++;
    }
  });

  return {
    labels: ['Available', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved'],
    counts: [
      counts[BED_STATUS.AVAILABLE],
      counts[BED_STATUS.OCCUPIED],
      counts[BED_STATUS.CLEANING],
      counts[BED_STATUS.MAINTENANCE],
      counts[BED_STATUS.RESERVED],
    ],
    total: hospitalState.beds.length,
  };
}
