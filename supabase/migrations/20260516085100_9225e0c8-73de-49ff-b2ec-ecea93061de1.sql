ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS ai_description text;

CREATE INDEX IF NOT EXISTS idx_invoices_category ON public.invoices(user_id, category);