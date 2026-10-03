-- MediOrchestra Database Schema

-- ENUMS
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('admin', 'doctor', 'ot_manager');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE doctor_status AS ENUM ('available', 'in_surgery', 'in_consultation',
                                        'off_duty', 'on_break', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE patient_status AS ENUM ('waiting', 'admitted', 'in_consultation',
                                         'in_surgery', 'in_recovery', 'discharged',
                                         'transferred', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bed_type AS ENUM ('general', 'icu', 'hdu', 'isolation', 'ed',
                                   'post_op', 'pediatric', 'maternity');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bed_status AS ENUM ('available', 'occupied', 'cleaning',
                                     'maintenance', 'reserved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ot_room_status AS ENUM ('available', 'in_surgery', 'cleaning',
                                         'maintenance', 'reserved', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ot_case_status AS ENUM ('scheduled', 'in_progress', 'completed',
                                         'cancelled', 'delayed', 'emergency_inserted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_urgency AS ENUM ('elective', 'urgent', 'emergency', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE equipment_status AS ENUM ('available', 'in_use', 'cleaning',
                                           'maintenance', 'fault');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved', 'escalated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('ot_assigned', 'ot_changed', 'ot_cancelled',
                                            'patient_assigned', 'patient_critical',
                                            'alert', 'shift_reminder', 'general');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- EXTENSION for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABLE 1: departments
CREATE TABLE IF NOT EXISTS departments (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,
    floor           VARCHAR(20),
    capacity        INT DEFAULT 0,
    head_doctor_id  UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 2: users (single auth table for all types)
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    user_type       user_type NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(20),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 3: doctors (extends users)
CREATE TABLE IF NOT EXISTS doctors (
    id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id         VARCHAR(50) UNIQUE NOT NULL,
    specialization      VARCHAR(100) NOT NULL,
    sub_specialization  VARCHAR(100),
    department_id       INT REFERENCES departments(id),
    qualification       TEXT[],
    experience_years    INT,
    status              doctor_status DEFAULT 'available',
    current_location    VARCHAR(100),
    shift_start         TIME,
    shift_end           TIME,
    max_surgeries_day   INT DEFAULT 4,
    surgeries_today     INT DEFAULT 0,
    consultation_room   VARCHAR(50),
    is_on_call          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 4: admin profiles (extends users)
CREATE TABLE IF NOT EXISTS admin_profiles (
    id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id     VARCHAR(50) UNIQUE NOT NULL,
    designation     VARCHAR(100),
    department_id   INT REFERENCES departments(id),
    permissions     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 5: ot_managers (extends users)
CREATE TABLE IF NOT EXISTS ot_managers (
    id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id     VARCHAR(50) UNIQUE NOT NULL,
    assigned_ot_ids INT[],
    shift_start     TIME,
    shift_end       TIME,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 6: patients
CREATE TABLE IF NOT EXISTS patients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          VARCHAR(20) UNIQUE NOT NULL,  -- e.g. P2024001
    full_name           VARCHAR(200) NOT NULL,
    date_of_birth       DATE NOT NULL,
    age                 INT GENERATED ALWAYS AS
                        (DATE_PART('year', AGE(date_of_birth))::INT) STORED,
    gender              VARCHAR(10),
    blood_group         VARCHAR(5),
    phone               VARCHAR(20),
    emergency_contact   VARCHAR(20),
    address             TEXT,
    status              patient_status DEFAULT 'waiting',
    acuity              SMALLINT CHECK (acuity BETWEEN 1 AND 5),
    department_id       INT REFERENCES departments(id),
    assigned_doctor_id  UUID REFERENCES doctors(id),
    bed_id              VARCHAR(20),
    admission_date      TIMESTAMPTZ,
    expected_discharge  TIMESTAMPTZ,
    discharge_date      TIMESTAMPTZ,
    diagnosis           TEXT,
    notes               TEXT,
    requires_icu        BOOLEAN DEFAULT FALSE,
    requires_isolation  BOOLEAN DEFAULT FALSE,
    requires_ventilator BOOLEAN DEFAULT FALSE,
    requires_ot         BOOLEAN DEFAULT FALSE,
    insurance_id        VARCHAR(100),
    waiting_since       TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 7: beds
CREATE TABLE IF NOT EXISTS beds (
    id                      VARCHAR(20) PRIMARY KEY,  -- e.g. ICU-04
    department_id           INT REFERENCES departments(id),
    ward                    VARCHAR(100),
    type                    bed_type NOT NULL,
    status                  bed_status DEFAULT 'available',
    has_isolation           BOOLEAN DEFAULT FALSE,
    has_ventilator          BOOLEAN DEFAULT FALSE,
    has_monitor             BOOLEAN DEFAULT FALSE,
    has_oxygen              BOOLEAN DEFAULT FALSE,
    patient_id              UUID REFERENCES patients(id),
    expected_release_time   TIMESTAMPTZ,
    release_confidence      NUMERIC(3,2),
    floor                   VARCHAR(10),
    room_number             VARCHAR(20),
    last_cleaned_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 8: ot_rooms
CREATE TABLE IF NOT EXISTS ot_rooms (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) UNIQUE NOT NULL,   -- e.g. OT-1, OT-2
    specialization  VARCHAR(100)[],
    status          ot_room_status DEFAULT 'available',
    floor           VARCHAR(10),
    equipment_ids   INT[],
    current_case_id UUID,
    next_available  TIMESTAMPTZ,
    last_cleaned_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 9: ot_cases
CREATE TABLE IF NOT EXISTS ot_cases (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number             VARCHAR(30) UNIQUE NOT NULL,  -- e.g. OTC-2024-001
    patient_id              UUID NOT NULL REFERENCES patients(id),
    ot_room_id              INT REFERENCES ot_rooms(id),
    primary_surgeon_id      UUID REFERENCES doctors(id),
    assisting_doctors       UUID[],
    anesthetist_id          UUID REFERENCES doctors(id),
    procedure_name          TEXT NOT NULL,
    procedure_code          VARCHAR(20),
    urgency                 case_urgency DEFAULT 'elective',
    status                  ot_case_status DEFAULT 'scheduled',
    scheduled_start         TIMESTAMPTZ NOT NULL,
    scheduled_end           TIMESTAMPTZ NOT NULL,
    predicted_duration_min  INT,
    actual_start            TIMESTAMPTZ,
    actual_end              TIMESTAMPTZ,
    actual_duration_min     INT,
    delay_reason            TEXT,
    post_op_bed_required    BOOLEAN DEFAULT TRUE,
    post_op_bed_id          VARCHAR(20) REFERENCES beds(id),
    post_op_ward            VARCHAR(100),
    notes                   TEXT,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 10: equipment
CREATE TABLE IF NOT EXISTS equipment (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    type                VARCHAR(50) NOT NULL,
    model               VARCHAR(100),
    serial_number       VARCHAR(100) UNIQUE,
    department_id       INT REFERENCES departments(id),
    ot_room_id          INT REFERENCES ot_rooms(id),
    status              equipment_status DEFAULT 'available',
    battery_pct         INT,
    last_maintained     TIMESTAMPTZ,
    next_maintenance    TIMESTAMPTZ,
    failure_risk        NUMERIC(3,2) DEFAULT 0,
    location            VARCHAR(100),
    assigned_to_case    UUID REFERENCES ot_cases(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 11: alerts
CREATE TABLE IF NOT EXISTS alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity            alert_severity NOT NULL,
    title               VARCHAR(200) NOT NULL,
    message             TEXT NOT NULL,
    department_id       INT REFERENCES departments(id),
    department_name     VARCHAR(100),
    related_type        VARCHAR(50),   -- 'ot_case', 'patient', 'bed', 'doctor'
    related_id          TEXT,
    status              alert_status DEFAULT 'open',
    escalation_level    SMALLINT DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    dedupe_key          VARCHAR(200) UNIQUE
);

-- TABLE 12: notifications (per-user)
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    related_id  TEXT,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 13: doctor_ot_assignments (log of all OT assignments per doctor)
CREATE TABLE IF NOT EXISTS doctor_ot_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id       UUID NOT NULL REFERENCES doctors(id),
    ot_case_id      UUID NOT NULL REFERENCES ot_cases(id),
    ot_room_id      INT REFERENCES ot_rooms(id),
    role            VARCHAR(50) NOT NULL,   -- 'primary_surgeon','assistant','anesthetist'
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    assigned_by     UUID REFERENCES users(id)
);

-- TABLE 14: patient_timeline (every status change is recorded)
CREATE TABLE IF NOT EXISTS patient_timeline (
    id          BIGSERIAL PRIMARY KEY,
    patient_id  UUID NOT NULL REFERENCES patients(id),
    status      patient_status NOT NULL,
    note        TEXT,
    changed_by  UUID REFERENCES users(id),
    changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 15: audit_log
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    time        TIMESTAMPTZ DEFAULT NOW(),
    user_id     UUID REFERENCES users(id),
    username    VARCHAR(200),
    user_type   user_type,
    action      VARCHAR(100) NOT NULL,
    target      VARCHAR(100),
    target_id   TEXT,
    detail      JSONB,
    ip          VARCHAR(45)
);

-- TABLE 16: kpi_snapshots (for analytics)
CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    ts                  TIMESTAMPTZ DEFAULT NOW(),
    total_patients      INT,
    waiting_patients    INT,
    admitted_patients   INT,
    critical_patients   INT,
    discharged_today    INT,
    total_beds          INT,
    occupied_beds       INT,
    available_beds      INT,
    icu_occupied        INT,
    icu_total           INT,
    ot_in_progress      INT,
    ot_available        INT,
    doctors_available   INT,
    doctors_in_surgery  INT,
    avg_wait_minutes    NUMERIC(8,2),
    bed_occupancy_pct   NUMERIC(5,2),
    icu_occupancy_pct   NUMERIC(5,2),
    ot_utilization_pct  NUMERIC(5,2)
);

-- TABLE 17: ot_request (doctor requests an OT slot)
CREATE TABLE IF NOT EXISTS ot_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id       UUID NOT NULL REFERENCES doctors(id),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    procedure_name  TEXT NOT NULL,
    urgency         case_urgency DEFAULT 'elective',
    preferred_date  DATE,
    preferred_time  TIME,
    duration_min    INT,
    notes           TEXT,
    status          VARCHAR(30) DEFAULT 'pending',  -- pending/approved/rejected
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    reject_reason   TEXT,
    ot_case_id      UUID REFERENCES ot_cases(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_acuity ON patients(acuity);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_type ON beds(type);
CREATE INDEX IF NOT EXISTS idx_beds_department ON beds(department_id);
CREATE INDEX IF NOT EXISTS idx_ot_cases_status ON ot_cases(status);
CREATE INDEX IF NOT EXISTS idx_ot_cases_surgeon ON ot_cases(primary_surgeon_id);
CREATE INDEX IF NOT EXISTS idx_ot_cases_date ON ot_cases(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(time);
CREATE INDEX IF NOT EXISTS idx_kpi_ts ON kpi_snapshots(ts);
CREATE INDEX IF NOT EXISTS idx_doctor_status ON doctors(status);

-- TRIGGER: update updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_doctors_updated ON doctors;
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated ON patients;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_beds_updated ON beds;
CREATE TRIGGER trg_beds_updated BEFORE UPDATE ON beds
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ot_cases_updated ON ot_cases;
CREATE TRIGGER trg_ot_cases_updated BEFORE UPDATE ON ot_cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
