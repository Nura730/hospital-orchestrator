const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const logger = require('../src/utils/logger');

async function seed() {
  logger.info('Starting idempotent database seeding for MediOrchestra...');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. DEPARTMENTS (7)
    logger.info('Seeding departments...');
    const deptData = [
      { name: 'Emergency', floor: '1', capacity: 20 },
      { name: 'General Ward', floor: '2', capacity: 40 },
      { name: 'ICU', floor: '3', capacity: 15 },
      { name: 'HDU', floor: '3', capacity: 10 },
      { name: 'OT', floor: '4', capacity: 6 },
      { name: 'Radiology', floor: '1', capacity: 0 },
      { name: 'Pediatrics', floor: '2', capacity: 20 },
    ];

    const deptMap = {};
    for (const d of deptData) {
      const res = await client.query(
        `INSERT INTO departments (name, floor, capacity)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET floor = EXCLUDED.floor, capacity = EXCLUDED.capacity
         RETURNING id, name`,
        [d.name, d.floor, d.capacity]
      );
      deptMap[res.rows[0].name] = res.rows[0].id;
    }

    // 2. PASSWORDS HASHING
    const doctorPasswordHash = await bcrypt.hash('Doctor@1234', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@1234', 10);
    const otManagerPasswordHash = await bcrypt.hash('OTManager@1234', 10);

    // 3. ADMINS (2)
    logger.info('Seeding admin users...');
    const admins = [
      {
        email: 'admin@hospital.com',
        fullName: 'Dr. Sarah Jenkins (Medical Director)',
        phone: '+1-555-0101',
        employeeId: 'ADM-001',
        designation: 'Medical Director',
      },
      {
        email: 'superadmin@hospital.com',
        fullName: 'Robert Sterling (Chief Operating Officer)',
        phone: '+1-555-0102',
        employeeId: 'ADM-002',
        designation: 'Chief Operating Officer',
      },
    ];

    const adminIds = [];
    for (const adm of admins) {
      const uRes = await client.query(
        `INSERT INTO users (email, password_hash, user_type, full_name, phone)
         VALUES ($1, $2, 'admin', $3, $4)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [adm.email, adminPasswordHash, adm.fullName, adm.phone]
      );
      const uid = uRes.rows[0].id;
      adminIds.push(uid);

      await client.query(
        `INSERT INTO admin_profiles (id, employee_id, designation, department_id, permissions)
         VALUES ($1, $2, $3, $4, '{"all": true}'::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [uid, adm.employeeId, adm.designation, deptMap['General Ward']]
      );
    }

    // 4. OT MANAGERS (2)
    logger.info('Seeding OT manager users...');
    const otManagers = [
      {
        email: 'otmanager1@hospital.com',
        fullName: 'Marcus Vance (Senior OT Manager)',
        phone: '+1-555-0201',
        employeeId: 'OTM-001',
      },
      {
        email: 'otmanager2@hospital.com',
        fullName: 'Elena Rostova (OT Flow Coordinator)',
        phone: '+1-555-0202',
        employeeId: 'OTM-002',
      },
    ];

    for (const otm of otManagers) {
      const uRes = await client.query(
        `INSERT INTO users (email, password_hash, user_type, full_name, phone)
         VALUES ($1, $2, 'ot_manager', $3, $4)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [otm.email, otManagerPasswordHash, otm.fullName, otm.phone]
      );
      const uid = uRes.rows[0].id;
      await client.query(
        `INSERT INTO ot_managers (id, employee_id, assigned_ot_ids, shift_start, shift_end)
         VALUES ($1, $2, '{1,2,3,4}', '07:00:00', '19:00:00')
         ON CONFLICT (id) DO NOTHING`,
        [uid, otm.employeeId]
      );
    }

    // 5. DOCTORS (12)
    logger.info('Seeding doctors...');
    const doctorData = [
      {
        empId: 'DR-2024-001',
        name: 'Dr. Arjun Menon',
        email: 'arjun.menon@hospital.com',
        spec: 'Cardiology',
        sub: 'Interventional Cardiology',
        dept: 'ICU',
        qual: ['MBBS', 'MD', 'DM Cardiology'],
        exp: 14,
        status: 'available',
        loc: 'Cardiology OPD 102',
        surgeriesToday: 1,
        maxSurgeries: 4,
        room: 'Consultation-1',
      },
      {
        empId: 'DR-2024-002',
        name: 'Dr. Kavita Rao',
        email: 'kavita.rao@hospital.com',
        spec: 'Cardiology',
        sub: 'Electrophysiology',
        dept: 'ICU',
        qual: ['MBBS', 'MD', 'FACC'],
        exp: 11,
        status: 'in_surgery',
        loc: 'OT-1',
        surgeriesToday: 2,
        maxSurgeries: 4,
        room: 'Consultation-2',
      },
      {
        empId: 'DR-2024-003',
        name: 'Dr. Vikram Seth',
        email: 'vikram.seth@hospital.com',
        spec: 'Neurology',
        sub: 'Neurosurgery',
        dept: 'General Ward',
        qual: ['MBBS', 'MS', 'MCh Neuro'],
        exp: 16,
        status: 'in_surgery',
        loc: 'OT-2',
        surgeriesToday: 2,
        maxSurgeries: 3,
        room: 'Consultation-3',
      },
      {
        empId: 'DR-2024-004',
        name: 'Dr. Anita Roy',
        email: 'anita.roy@hospital.com',
        spec: 'Neurology',
        sub: 'Stroke Care',
        dept: 'HDU',
        qual: ['MBBS', 'MD', 'DM Neuro'],
        exp: 9,
        status: 'in_consultation',
        loc: 'OPD Neuro Wing',
        surgeriesToday: 0,
        maxSurgeries: 3,
        room: 'Consultation-4',
      },
      {
        empId: 'DR-2024-005',
        name: 'Dr. David Chen',
        email: 'david.chen@hospital.com',
        spec: 'Orthopedics',
        sub: 'Joint Replacement',
        dept: 'General Ward',
        qual: ['MBBS', 'MS Ortho', 'FRCS'],
        exp: 15,
        status: 'available',
        loc: 'Ortho Wing Floor 2',
        surgeriesToday: 1,
        maxSurgeries: 4,
        room: 'Consultation-5',
      },
      {
        empId: 'DR-2024-006',
        name: 'Dr. Sunita Patel',
        email: 'sunita.patel@hospital.com',
        spec: 'Orthopedics',
        sub: 'Trauma & Spine',
        dept: 'Emergency',
        qual: ['MBBS', 'MS Ortho'],
        exp: 8,
        status: 'available',
        loc: 'Emergency Triage',
        surgeriesToday: 0,
        maxSurgeries: 4,
        room: 'Consultation-6',
      },
      {
        empId: 'DR-2024-007',
        name: 'Dr. Tariq Al-Mansoor',
        email: 'tariq.almansoor@hospital.com',
        spec: 'General Surgery',
        sub: 'Laparoscopic Surgery',
        dept: 'General Ward',
        qual: ['MBBS', 'MS Surgery'],
        exp: 12,
        status: 'available',
        loc: 'Surgical Floor 2',
        surgeriesToday: 1,
        maxSurgeries: 5,
        room: 'Consultation-7',
      },
      {
        empId: 'DR-2024-008',
        name: 'Dr. Maria Santos',
        email: 'maria.santos@hospital.com',
        spec: 'General Surgery',
        sub: 'Colorectal Surgery',
        dept: 'General Ward',
        qual: ['MBBS', 'MS', 'FACS'],
        exp: 10,
        status: 'off_duty',
        loc: 'Home',
        surgeriesToday: 0,
        maxSurgeries: 4,
        room: 'Consultation-8',
      },
      {
        empId: 'DR-2024-009',
        name: 'Dr. Aisha Begum',
        email: 'aisha.begum@hospital.com',
        spec: 'Pediatrics',
        sub: 'Neonatology',
        dept: 'Pediatrics',
        qual: ['MBBS', 'MD Pediatrics'],
        exp: 13,
        status: 'available',
        loc: 'NICU / Peds Ward',
        surgeriesToday: 0,
        maxSurgeries: 3,
        room: 'Consultation-9',
      },
      {
        empId: 'DR-2024-010',
        name: 'Dr. Priya Nair',
        email: 'priya.nair@hospital.com',
        spec: 'Anesthesiology',
        sub: 'Cardiac Anesthesia',
        dept: 'OT',
        qual: ['MBBS', 'MD Anesthesia'],
        exp: 11,
        status: 'in_surgery',
        loc: 'OT-1',
        surgeriesToday: 2,
        maxSurgeries: 5,
        room: 'Anesthesia Office',
      },
      {
        empId: 'DR-2024-011',
        name: 'Dr. Nathan Hughes',
        email: 'nathan.hughes@hospital.com',
        spec: 'Anesthesiology',
        sub: 'Neuro Anesthesia',
        dept: 'OT',
        qual: ['MBBS', 'DA', 'DNB'],
        exp: 7,
        status: 'available',
        loc: 'OT Lounge',
        surgeriesToday: 1,
        maxSurgeries: 5,
        room: 'Anesthesia Office',
      },
      {
        empId: 'DR-2024-012',
        name: 'Dr. Sameer Khan',
        email: 'sameer.khan@hospital.com',
        spec: 'Emergency Medicine',
        sub: 'Critical Care & Resus',
        dept: 'Emergency',
        qual: ['MBBS', 'MEM', 'FACEM'],
        exp: 9,
        status: 'available',
        loc: 'Emergency Bay',
        surgeriesToday: 0,
        maxSurgeries: 3,
        room: 'ER Bay 1',
      },
    ];

    const doctorIds = {};
    for (const doc of doctorData) {
      const uRes = await client.query(
        `INSERT INTO users (email, password_hash, user_type, full_name, phone)
         VALUES ($1, $2, 'doctor', $3, '+1-555-03' || substr($4, 9, 2))
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [doc.email, doctorPasswordHash, doc.name, doc.empId]
      );
      const uid = uRes.rows[0].id;
      doctorIds[doc.empId] = uid;

      await client.query(
        `INSERT INTO doctors (
          id, employee_id, specialization, sub_specialization, department_id,
          qualification, experience_years, status, current_location, shift_start,
          shift_end, max_surgeries_day, surgeries_today, consultation_room, is_on_call
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '08:00:00', '20:00:00', $10, $11, $12, FALSE)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          current_location = EXCLUDED.current_location,
          surgeries_today = EXCLUDED.surgeries_today`,
        [
          uid,
          doc.empId,
          doc.spec,
          doc.sub,
          deptMap[doc.dept] || deptMap['General Ward'],
          doc.qual,
          doc.exp,
          doc.status,
          doc.loc,
          doc.maxSurgeries,
          doc.surgeriesToday,
          doc.room,
        ]
      );
    }

    // 6. OT ROOMS (4)
    logger.info('Seeding OT rooms...');
    const otRoomsData = [
      { id: 1, name: 'OT-1', spec: ['Cardiac', 'Thoracic'], status: 'in_surgery', floor: '4' },
      { id: 2, name: 'OT-2', spec: ['Neuro', 'Spine'], status: 'in_surgery', floor: '4' },
      { id: 3, name: 'OT-3', spec: ['Ortho', 'Trauma'], status: 'cleaning', floor: '4' },
      { id: 4, name: 'OT-4', spec: ['General', 'Laparoscopy'], status: 'available', floor: '4' },
    ];

    for (const r of otRoomsData) {
      await client.query(
        `INSERT INTO ot_rooms (id, name, specialization, status, floor)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET status = EXCLUDED.status, specialization = EXCLUDED.specialization`,
        [r.id, r.name, r.spec, r.status, r.floor]
      );
    }

    // 7. BEDS (75 total)
    logger.info('Seeding beds (75 total)...');
    const bedDefinitions = [];

    // ED-01 to ED-15
    for (let i = 1; i <= 15; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      bedDefinitions.push({
        id: `ED-${num}`,
        dept: 'Emergency',
        ward: 'Emergency Observation',
        type: 'ed',
        hasIso: false,
        hasVent: i <= 3,
        hasMon: true,
        hasO2: true,
        floor: '1',
        room: `ER-${num}`,
      });
    }

    // GW-01 to GW-25
    for (let i = 1; i <= 25; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      bedDefinitions.push({
        id: `GW-${num}`,
        dept: 'General Ward',
        ward: 'Main Medical Ward',
        type: 'general',
        hasIso: false,
        hasVent: false,
        hasMon: false,
        hasO2: true,
        floor: '2',
        room: `20${Math.ceil(i / 4)}`,
      });
    }

    // ICU-01 to ICU-12
    for (let i = 1; i <= 12; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      bedDefinitions.push({
        id: `ICU-${num}`,
        dept: 'ICU',
        ward: 'Critical Care Unit',
        type: 'icu',
        hasIso: i <= 2,
        hasVent: true,
        hasMon: true,
        hasO2: true,
        floor: '3',
        room: `ICU-POD-${Math.ceil(i / 2)}`,
      });
    }

    // HDU-01 to HDU-08
    for (let i = 1; i <= 8; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      bedDefinitions.push({
        id: `HDU-${num}`,
        dept: 'HDU',
        ward: 'High Dependency Ward',
        type: 'hdu',
        hasIso: false,
        hasVent: false,
        hasMon: true,
        hasO2: true,
        floor: '3',
        room: `HDU-R${Math.ceil(i / 2)}`,
      });
    }

    // ISO-01 to ISO-06
    for (let i = 1; i <= 6; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      bedDefinitions.push({
        id: `ISO-${num}`,
        dept: 'General Ward',
        ward: 'Negative Pressure Isolation',
        type: 'isolation',
        hasIso: true,
        hasVent: i <= 2,
        hasMon: true,
        hasO2: true,
        floor: '2',
        room: `ISO-RM-${num}`,
      });
    }

    // PO-01 to PO-09
    for (let i = 1; i <= 9; i++) {
      const num = i < 10 ? `0${i}` : `${i}`;
      bedDefinitions.push({
        id: `PO-${num}`,
        dept: 'General Ward',
        ward: 'Post-Operative Recovery Ward',
        type: 'post_op',
        hasIso: false,
        hasVent: i <= 2,
        hasMon: true,
        hasO2: true,
        floor: '4',
        room: `PACU-${num}`,
      });
    }

    for (const b of bedDefinitions) {
      await client.query(
        `INSERT INTO beds (
          id, department_id, ward, type, status, has_isolation,
          has_ventilator, has_monitor, has_oxygen, floor, room_number
        )
        VALUES ($1, $2, $3, $4, 'available', $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          ward = EXCLUDED.ward,
          type = EXCLUDED.type,
          has_isolation = EXCLUDED.has_isolation,
          has_ventilator = EXCLUDED.has_ventilator,
          has_monitor = EXCLUDED.has_monitor,
          has_oxygen = EXCLUDED.has_oxygen`,
        [
          b.id,
          deptMap[b.dept] || deptMap['General Ward'],
          b.ward,
          b.type,
          b.hasIso,
          b.hasVent,
          b.hasMon,
          b.hasO2,
          b.floor,
          b.room,
        ]
      );
    }

    // 8. PATIENTS (30 patients)
    logger.info('Seeding patients (30 patients)...');
    const firstNames = [
      'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
      'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
      'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
      'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra'
    ];
    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
      'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
      'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
    ];

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const doctorKeyList = Object.keys(doctorIds);

    const patientList = [];
    for (let i = 1; i <= 30; i++) {
      const pNum = i < 10 ? `P202400${i}` : `P20240${i}`;
      const fullName = `${firstNames[i - 1]} ${lastNames[i - 1]}`;
      const dobYear = 1950 + (i * 2) % 45;
      const dob = `${dobYear}-0${(i % 9) + 1}-15`;
      const blood = bloodGroups[i % bloodGroups.length];
      const gender = i % 2 === 0 ? 'Female' : 'Male';

      // Varied statuses: waiting/admitted/in_surgery/critical
      let status = 'admitted';
      let acuity = 3;
      let requiresOt = false;
      let assignedBedId = null;

      if (i <= 4) {
        status = 'critical';
        acuity = 1;
        assignedBedId = `ICU-0${i}`;
      } else if (i <= 6) {
        status = 'in_surgery';
        acuity = 2;
        requiresOt = true;
        assignedBedId = `PO-0${i - 4}`;
      } else if (i <= 10) {
        status = 'waiting';
        acuity = 4;
        assignedBedId = null;
      } else if (i <= 26) {
        status = 'admitted';
        acuity = (i % 3) + 2;
        const gwIndex = (i - 10) < 10 ? `0${i - 10}` : `${i - 10}`;
        assignedBedId = `GW-${gwIndex}`;
      } else {
        status = 'discharged';
        acuity = 5;
        assignedBedId = null;
      }

      const assignedDocId = doctorIds[doctorKeyList[(i - 1) % doctorKeyList.length]];

      patientList.push({
        patientId: pNum,
        fullName,
        dob,
        gender,
        blood,
        status,
        acuity,
        assignedDoctorId: assignedDocId,
        bedId: assignedBedId,
        requiresOt,
      });
    }

    const patientMap = {};
    for (const p of patientList) {
      const res = await client.query(
        `INSERT INTO patients (
          patient_id, full_name, date_of_birth, gender, blood_group,
          phone, emergency_contact, address, status, acuity,
          department_id, assigned_doctor_id, bed_id, admission_date,
          diagnosis, requires_ot
        )
        VALUES (
          $1, $2, $3, $4, $5,
          '+1-555-7001', '+1-555-7002', '124 Healthcare Ave, Metro City',
          $6, $7, $8, $9, $10,
          NOW() - INTERVAL '2 days',
          'Primary Clinical Diagnosis: Observation', $11
        )
        ON CONFLICT (patient_id) DO UPDATE SET
          status = EXCLUDED.status,
          acuity = EXCLUDED.acuity,
          bed_id = EXCLUDED.bed_id,
          assigned_doctor_id = EXCLUDED.assigned_doctor_id
        RETURNING id, patient_id`,
        [
          p.patientId,
          p.fullName,
          p.dob,
          p.gender,
          p.blood,
          p.status,
          p.acuity,
          deptMap['General Ward'],
          p.assignedDoctorId,
          p.bedId,
          p.requiresOt,
        ]
      );
      patientMap[res.rows[0].patient_id] = res.rows[0].id;

      // Update occupied beds accordingly
      if (p.bedId && (p.status === 'admitted' || p.status === 'critical')) {
        await client.query(
          `UPDATE beds
           SET status = 'occupied',
               patient_id = $1,
               expected_release_time = NOW() + INTERVAL '2 days',
               release_confidence = 0.85
           WHERE id = $2`,
          [res.rows[0].id, p.bedId]
        );
      }
    }

    // Set additional occupied beds to reach ~78% occupancy
    const extraOccupiedBeds = ['ED-01', 'ED-02', 'ED-03', 'ED-04', 'ED-05', 'HDU-01', 'HDU-02', 'HDU-03', 'ISO-01', 'ISO-02'];
    for (const eb of extraOccupiedBeds) {
      await client.query(
        `UPDATE beds
         SET status = 'occupied', expected_release_time = NOW() + INTERVAL '1 day', release_confidence = 0.80
         WHERE id = $1 AND status = 'available'`,
        [eb]
      );
    }

    // 9. OT CASES (8 for today)
    logger.info('Seeding OT cases...');
    const otCasesData = [
      {
        num: 'OTC-2024-001',
        patient: 'P2024005',
        room: 1,
        surgeon: doctorIds['DR-2024-001'], // Dr. Arjun Menon (Cardio)
        anesthetist: doctorIds['DR-2024-010'], // Dr. Priya Nair
        proc: 'Coronary Artery Bypass Grafting',
        urgency: 'urgent',
        status: 'in_progress',
        startOffset: -60,
        endOffset: 180,
      },
      {
        num: 'OTC-2024-002',
        patient: 'P2024006',
        room: 2,
        surgeon: doctorIds['DR-2024-003'], // Dr. Vikram Seth (Neuro)
        anesthetist: doctorIds['DR-2024-011'], // Dr. Nathan Hughes
        proc: 'Craniotomy for Subdural Hematoma Evacuation',
        urgency: 'critical',
        status: 'in_progress',
        startOffset: -90,
        endOffset: 120,
      },
      {
        num: 'OTC-2024-003',
        patient: 'P2024007',
        room: 3,
        surgeon: doctorIds['DR-2024-005'], // Dr. David Chen (Ortho)
        anesthetist: doctorIds['DR-2024-010'],
        proc: 'Total Hip Arthroplasty',
        urgency: 'elective',
        status: 'completed',
        startOffset: -300,
        endOffset: -120,
      },
      {
        num: 'OTC-2024-004',
        patient: 'P2024008',
        room: 4,
        surgeon: doctorIds['DR-2024-007'], // Dr. Tariq Al-Mansoor (General)
        anesthetist: doctorIds['DR-2024-011'],
        proc: 'Laparoscopic Cholecystectomy',
        urgency: 'elective',
        status: 'completed',
        startOffset: -360,
        endOffset: -240,
      },
      {
        num: 'OTC-2024-005',
        patient: 'P2024011',
        room: 1,
        surgeon: doctorIds['DR-2024-002'], // Dr. Kavita Rao
        anesthetist: doctorIds['DR-2024-010'],
        proc: 'Aortic Valve Replacement',
        urgency: 'urgent',
        status: 'completed',
        startOffset: -480,
        endOffset: -280,
      },
      {
        num: 'OTC-2024-006',
        patient: 'P2024012',
        room: 2,
        surgeon: doctorIds['DR-2024-003'],
        anesthetist: doctorIds['DR-2024-011'],
        proc: 'Anterior Cervical Discectomy and Fusion',
        urgency: 'elective',
        status: 'completed',
        startOffset: -500,
        endOffset: -320,
      },
      {
        num: 'OTC-2024-007',
        patient: 'P2024013',
        room: 1,
        surgeon: doctorIds['DR-2024-001'],
        anesthetist: doctorIds['DR-2024-010'],
        proc: 'Percutaneous Coronary Intervention',
        urgency: 'elective',
        status: 'scheduled',
        startOffset: 240,
        endOffset: 360,
      },
      {
        num: 'OTC-2024-008',
        patient: 'P2024014',
        room: 4,
        surgeon: doctorIds['DR-2024-007'],
        anesthetist: doctorIds['DR-2024-011'],
        proc: 'Inguinal Hernia Repair',
        urgency: 'elective',
        status: 'scheduled',
        startOffset: 180,
        endOffset: 270,
      },
    ];

    for (const c of otCasesData) {
      const patientUuid = patientMap[c.patient];
      if (!patientUuid) continue;

      const res = await client.query(
        `INSERT INTO ot_cases (
          case_number, patient_id, ot_room_id, primary_surgeon_id,
          anesthetist_id, procedure_name, urgency, status,
          scheduled_start, scheduled_end, predicted_duration_min,
          actual_start, actual_end, actual_duration_min, created_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          NOW() + ($9 || ' minutes')::interval,
          NOW() + ($10 || ' minutes')::interval,
          $10 - $9,
          CASE WHEN $8 IN ('in_progress', 'completed') THEN NOW() + ($9 || ' minutes')::interval ELSE NULL END,
          CASE WHEN $8 = 'completed' THEN NOW() + ($10 || ' minutes')::interval ELSE NULL END,
          CASE WHEN $8 = 'completed' THEN ($10 - $9) ELSE NULL END,
          $11
        )
        ON CONFLICT (case_number) DO UPDATE SET
          status = EXCLUDED.status
        RETURNING id`,
        [
          c.num,
          patientUuid,
          c.room,
          c.surgeon,
          c.anesthetist,
          c.proc,
          c.urgency,
          c.status,
          c.startOffset,
          c.endOffset,
          adminIds[0],
        ]
      );
      const caseId = res.rows[0].id;

      // Link in-progress cases to room
      if (c.status === 'in_progress') {
        await client.query('UPDATE ot_rooms SET current_case_id = $1 WHERE id = $2', [caseId, c.room]);
      }

      // Record assignment log
      await client.query(
        `INSERT INTO doctor_ot_assignments (doctor_id, ot_case_id, ot_room_id, role, assigned_by)
         VALUES ($1, $2, $3, 'primary_surgeon', $4)
         ON CONFLICT DO NOTHING`,
        [c.surgeon, caseId, c.room, adminIds[0]]
      );
    }

    // 10. EQUIPMENT (20)
    logger.info('Seeding equipment (20 items)...');
    const eqList = [
      { name: 'Dräger Primus Ventilator 1', type: 'Ventilator', model: 'Primus IE', serial: 'VENT-001', dept: 'ICU', ot: null, status: 'in_use' },
      { name: 'Dräger Primus Ventilator 2', type: 'Ventilator', model: 'Primus IE', serial: 'VENT-002', dept: 'ICU', ot: null, status: 'available' },
      { name: 'Hamilton C6 Ventilator 1', type: 'Ventilator', model: 'C6 Pro', serial: 'VENT-003', dept: 'Emergency', ot: null, status: 'available' },
      { name: 'Hamilton C6 Ventilator 2', type: 'Ventilator', model: 'C6 Pro', serial: 'VENT-004', dept: 'ICU', ot: null, status: 'cleaning' },
      { name: 'Philips IntelliVue MX800 1', type: 'Monitor', model: 'MX800', serial: 'MON-001', dept: 'ICU', ot: 1, status: 'in_use' },
      { name: 'Philips IntelliVue MX800 2', type: 'Monitor', model: 'MX800', serial: 'MON-002', dept: 'ICU', ot: 2, status: 'in_use' },
      { name: 'Philips IntelliVue MX700 3', type: 'Monitor', model: 'MX700', serial: 'MON-003', dept: 'HDU', ot: null, status: 'available' },
      { name: 'Philips IntelliVue MX700 4', type: 'Monitor', model: 'MX700', serial: 'MON-004', dept: 'Emergency', ot: null, status: 'available' },
      { name: 'Mindray BeneVision N19 1', type: 'Monitor', model: 'N19', serial: 'MON-005', dept: 'General Ward', ot: null, status: 'available' },
      { name: 'Mindray BeneVision N19 2', type: 'Monitor', model: 'N19', serial: 'MON-006', dept: 'General Ward', ot: null, status: 'available' },
      { name: 'GE Healthcare Avance CS2 1', type: 'Anesthesia', model: 'CS2 Pro', serial: 'ANES-001', dept: 'OT', ot: 1, status: 'in_use' },
      { name: 'GE Healthcare Avance CS2 2', type: 'Anesthesia', model: 'CS2 Pro', serial: 'ANES-002', dept: 'OT', ot: 2, status: 'in_use' },
      { name: 'GE Healthcare Aisys CS2 3', type: 'Anesthesia', model: 'Aisys', serial: 'ANES-003', dept: 'OT', ot: 3, status: 'cleaning' },
      { name: 'GE Healthcare Aisys CS2 4', type: 'Anesthesia', model: 'Aisys', serial: 'ANES-004', dept: 'OT', ot: 4, status: 'available' },
      { name: 'Maquet Magnus Operating Table 1', type: 'Surgical Table', model: 'Magnus 1180', serial: 'TAB-001', dept: 'OT', ot: 1, status: 'in_use' },
      { name: 'Maquet Magnus Operating Table 2', type: 'Surgical Table', model: 'Magnus 1180', serial: 'TAB-002', dept: 'OT', ot: 2, status: 'in_use' },
      { name: 'Steris 5085 Surgical Table 3', type: 'Surgical Table', model: '5085 SRT', serial: 'TAB-003', dept: 'OT', ot: 3, status: 'cleaning' },
      { name: 'Steris 5085 Surgical Table 4', type: 'Surgical Table', model: '5085 SRT', serial: 'TAB-004', dept: 'OT', ot: 4, status: 'available' },
      { name: 'Karl Storz 4K Laparoscopy Tower 1', type: 'Laparoscope', model: 'Image1 S 4K', serial: 'LAP-001', dept: 'OT', ot: 4, status: 'available' },
      { name: 'Olympus VISERA ELITE II 2', type: 'Laparoscope', model: 'OTV-S300', serial: 'LAP-002', dept: 'OT', ot: null, status: 'maintenance' },
    ];

    for (const eq of eqList) {
      await client.query(
        `INSERT INTO equipment (
          name, type, model, serial_number, department_id, ot_room_id,
          status, battery_pct, failure_risk, location
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 95, 0.05, 'Hospital Main Wing')
        ON CONFLICT (serial_number) DO UPDATE SET
          status = EXCLUDED.status,
          ot_room_id = EXCLUDED.ot_room_id`,
        [eq.name, eq.type, eq.model, eq.serial, deptMap[eq.dept] || deptMap['OT'], eq.ot, eq.status]
      );
    }

    // 11. ALERTS (5 open)
    logger.info('Seeding alerts...');
    const alertData = [
      {
        severity: 'high',
        title: 'ICU Capacity Warning (90% Occupancy)',
        message: 'Intensive Care Unit occupancy is currently at 91.6%. Only 1 ICU bed is available.',
        dept: 'ICU',
        relatedType: 'bed',
        relatedId: 'ICU',
        status: 'open',
        level: 2,
        dedupeKey: 'ALERT_ICU_CAPACITY_WARNING',
      },
      {
        severity: 'high',
        title: 'OT-1 Overrun Alert (>30 min delay)',
        message: 'Coronary Artery Bypass Grafting in OT-1 is running 35 minutes past predicted completion.',
        dept: 'OT',
        relatedType: 'ot_case',
        relatedId: '1',
        status: 'open',
        level: 2,
        dedupeKey: 'ALERT_OT_1_OVERRUN_CASE',
      },
      {
        severity: 'medium',
        title: 'Bed Turnaround Delay in HDU',
        message: 'Bed HDU-04 has been in cleaning status for over 55 minutes.',
        dept: 'HDU',
        relatedType: 'bed',
        relatedId: 'HDU-04',
        status: 'open',
        level: 1,
        dedupeKey: 'ALERT_BED_CLEANING_HDU_04',
      },
      {
        severity: 'medium',
        title: 'Equipment Maintenance Due: Olympus Laparoscope',
        message: 'Laparoscopy tower LAP-002 preventive maintenance scheduled window expires today.',
        dept: 'OT',
        relatedType: 'equipment',
        relatedId: 'LAP-002',
        status: 'open',
        level: 1,
        dedupeKey: 'ALERT_EQ_MAINT_LAP_002',
      },
      {
        severity: 'info',
        title: 'Shift Change Approaching',
        message: 'Night shift nursing and medical team arrives in 60 minutes. Prepare ward handover.',
        dept: 'General Ward',
        relatedType: 'shift',
        relatedId: 'SHIFT_NIGHT',
        status: 'open',
        level: 1,
        dedupeKey: 'ALERT_SHIFT_CHANGE_HANDOVER',
      },
    ];

    for (const a of alertData) {
      await client.query(
        `INSERT INTO alerts (
          severity, title, message, department_id, department_name,
          related_type, related_id, status, escalation_level, dedupe_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (dedupe_key) DO UPDATE SET
          status = EXCLUDED.status,
          severity = EXCLUDED.severity`,
        [
          a.severity,
          a.title,
          a.message,
          deptMap[a.dept] || deptMap['General Ward'],
          a.dept,
          a.relatedType,
          a.relatedId,
          a.status,
          a.level,
          a.dedupeKey,
        ]
      );
    }

    // 12. INITIAL KPI SNAPSHOT
    logger.info('Seeding initial KPI snapshot...');
    await client.query(`
      INSERT INTO kpi_snapshots (
        total_patients, waiting_patients, admitted_patients, critical_patients,
        discharged_today, total_beds, occupied_beds, available_beds,
        icu_occupied, icu_total, ot_in_progress, ot_available,
        doctors_available, doctors_in_surgery, avg_wait_minutes,
        bed_occupancy_pct, icu_occupancy_pct, ot_utilization_pct
      )
      VALUES (
        30, 4, 20, 4,
        2, 75, 58, 17,
        11, 12, 2, 1,
        8, 3, 24.50,
        77.33, 91.67, 50.00
      )
    `);

    await client.query('COMMIT');
    logger.info('✅ Database seeding finished successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err: err.message }, '❌ Database seeding failed.');
    throw err;
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  seed().catch(() => process.exit(1));
}

module.exports = { seed };
