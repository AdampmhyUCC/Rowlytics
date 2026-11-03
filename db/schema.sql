-- Rowlytics database schema (development)
-- WARNING: the DROP lines delete all data. Never run on the pilot database.
-- Run in the Supabase SQL Editor to rebuild the tables.
-- User accounts and roles live in profiles.sql (not dropped by this file).
-- After this file, run profiles.sql, consent.sql, then training.sql.

DROP TABLE IF EXISTS parental_consents;
DROP TABLE IF EXISTS completed_training;
DROP TABLE IF EXISTS athletes;

CREATE TABLE athletes (
  athlete_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  dob                 DATE NOT NULL,
  gender              VARCHAR(20),
  parental_consent_at TIMESTAMPTZ,
  parental_consent_by VARCHAR(254),
  resting_hr          SMALLINT,
  max_hr              SMALLINT
);

CREATE TABLE completed_training (
  completed_training_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  session_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  modality         VARCHAR(30),
  distance_m       INT,
  duration_seconds INT,
  heart_rate       SMALLINT,
  rpe              SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  notes            TEXT,
  self_reported    BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_training ENABLE ROW LEVEL SECURITY;

-- No anon access. Signed-in access policies are in profiles.sql.