-- =====================================================================
-- MediOrchestra — Predictive Flow Intelligence migration (additive only)
-- Safe to run multiple times.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extra patient attributes used by the prediction engine
ALTER TABLE patients ADD COLUMN IF NOT EXISTS requires_imaging BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pending_tasks TEXT[] DEFAULT '{}';

-- Every operational action becomes an event
CREATE TABLE IF NOT EXISTS flow_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(60) NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    processed   BOOLEAN DEFAULT FALSE,
    result      JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    created_by  UUID REFERENCES users(id)
);

-- Stored forecasts (written by the flow analysis job)
CREATE TABLE IF NOT EXISTS predictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(40) NOT NULL,      -- arrivals | bed_demand | utilization
    department_id   INT REFERENCES departments(id),
    horizon_hours   INT NOT NULL,
    predicted_value NUMERIC(10,2) NOT NULL,
    lower_bound     NUMERIC(10,2),
    upper_bound     NUMERIC(10,2),
    confidence      NUMERIC(4,3),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- What-if simulator history
CREATE TABLE IF NOT EXISTS simulation_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    params      JSONB NOT NULL,
    result      JSONB NOT NULL,
    applied     BOOLEAN DEFAULT FALSE,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- AI generated reports
CREATE TABLE IF NOT EXISTS ai_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope           VARCHAR(20) NOT NULL,
    input_snapshot  JSONB NOT NULL,
    report_text     TEXT NOT NULL,
    provider        VARCHAR(30) NOT NULL,
    model           VARCHAR(80),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly arrival history (source for the arrival forecast)
CREATE TABLE IF NOT EXISTS arrivals_history (
    id              BIGSERIAL PRIMARY KEY,
    department_id   INT NOT NULL REFERENCES departments(id),
    hour_start      TIMESTAMPTZ NOT NULL,
    arrivals        INT NOT NULL DEFAULT 0,
    admitted        INT NOT NULL DEFAULT 0,
    high_acuity     INT NOT NULL DEFAULT 0,
    UNIQUE (department_id, hour_start)
);

-- Actionable recommendations produced by the flow engines
CREATE TABLE IF NOT EXISTS flow_recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(40) NOT NULL,      -- bed_assignment | icu_transfer | trauma_team | cleaning | discharge | transfer | reserve | staffing | defer_ot | pre_assignment
    title           VARCHAR(250) NOT NULL,
    detail          TEXT,
    expected_impact VARCHAR(250),
    risk            VARCHAR(10) DEFAULT 'low', -- low | medium | high
    status          VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected | applied
    source          VARCHAR(30) DEFAULT 'state_engine',
    department_id   INT REFERENCES departments(id),
    related_type    VARCHAR(30),
    related_id      TEXT,
    payload         JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    decided_by      UUID REFERENCES users(id),
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Nursing / housekeeping roster (no nurse accounts exist in the core schema)
CREATE TABLE IF NOT EXISTS flow_staff (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    role            VARCHAR(30) NOT NULL,      -- nurse | float_nurse | housekeeping
    department_id   INT REFERENCES departments(id),
    on_shift        BOOLEAN DEFAULT TRUE,
    shift_start     TIME,
    shift_end       TIME,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_type_dept_time ON predictions(type, department_id, created_at);
CREATE INDEX IF NOT EXISTS idx_flow_events_type_time ON flow_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_flow_events_time ON flow_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arrivals_dept_hour ON arrivals_history(department_id, hour_start);
CREATE INDEX IF NOT EXISTS idx_flow_recs_status ON flow_recommendations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_time ON simulation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reports_time ON ai_reports(created_at DESC);
