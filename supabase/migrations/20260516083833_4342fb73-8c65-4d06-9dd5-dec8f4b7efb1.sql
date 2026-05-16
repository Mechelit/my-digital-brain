
DO $$ BEGIN
  CREATE TYPE expense_scope AS ENUM ('prive','zakelijk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS scope expense_scope NOT NULL DEFAULT 'prive';
