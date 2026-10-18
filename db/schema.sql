-- Rowlytics database schema (development)
-- WARNING: the DROP lines delete all data. Never run on the pilot database.
-- Run in the Supabase SQL Editor to rebuild the tables.

DROP TABLE IF EXISTS completed_training;
DROP TABLE IF EXISTS athletes;

DROP TABLE IF EXISTS completed_training;
DROP TABLE IF EXISTS athletes;

CREATE TABLE athletes (
  athlete_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  dob                 DATE NOT NULL,
  gender              VARCHAR(20),
  parental_consent_at TIMESTAMPTZ,
  parental_consent_by VARCHAR(100),
  resting_hr          SMALLINT,
  max_hr              SMALLINT
);

CREATE TABLE completed_training (
  completed_training_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  session_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  modality         VARCHAR(30),
  volume           INT,
  duration_minutes INT,
  heart_rate       SMALLINT,
  rpe              SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  notes            TEXT,
  self_reported    BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temp_dev_access" ON athletes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "temp_dev_access" ON completed_training FOR ALL TO anon USING (true) WITH CHECK (true);