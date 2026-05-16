
DO $$ BEGIN
  CREATE TYPE expense_frequency AS ENUM ('monthly','quarterly','biannual','yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS frequency expense_frequency NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS month_of_year int CHECK (month_of_year BETWEEN 1 AND 12);
