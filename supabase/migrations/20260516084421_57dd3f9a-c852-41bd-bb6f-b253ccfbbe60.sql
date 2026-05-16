
ALTER TYPE invoice_source ADD VALUE IF NOT EXISTS 'email';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_external_uniq
  ON public.invoices(user_id, external_id) WHERE external_id IS NOT NULL;
