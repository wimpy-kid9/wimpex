BEGIN;

ALTER TABLE wpx_profiles ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'gold';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wpx_profiles_theme_check') THEN
    ALTER TABLE wpx_profiles ADD CONSTRAINT wpx_profiles_theme_check
      CHECK (theme_preference IN ('gold','blue','green','red','pink','yellow','violet','orange','black'));
  END IF;
END $$;

COMMIT;
