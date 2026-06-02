BEGIN;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS waveform_peaks JSONB,
ADD COLUMN IF NOT EXISTS waveform_duration NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'songs_waveform_duration_check'
  ) THEN
    ALTER TABLE songs
    ADD CONSTRAINT songs_waveform_duration_check
    CHECK (waveform_duration IS NULL OR waveform_duration >= 0);
  END IF;
END;
$$;

COMMENT ON COLUMN songs.waveform_peaks IS 'Cached WaveSurfer peaks used to render the waveform without decoding audio again.';
COMMENT ON COLUMN songs.waveform_duration IS 'Duration in seconds used together with cached waveform peaks.';

COMMIT;
