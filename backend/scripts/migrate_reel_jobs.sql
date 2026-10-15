-- Add durable generic job identifiers/type/progress while preserving all
-- existing reel job rows. Run once against the existing PostgreSQL database.
ALTER TABLE reel_jobs ADD COLUMN IF NOT EXISTS job_id VARCHAR(36);
ALTER TABLE reel_jobs ADD COLUMN IF NOT EXISTS job_type VARCHAR(40) NOT NULL DEFAULT 'reel';
ALTER TABLE reel_jobs ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;

UPDATE reel_jobs
SET job_id = reel_id
WHERE job_id IS NULL;

ALTER TABLE reel_jobs ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE reel_jobs ALTER COLUMN reel_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_reel_jobs_job_id ON reel_jobs (job_id);
