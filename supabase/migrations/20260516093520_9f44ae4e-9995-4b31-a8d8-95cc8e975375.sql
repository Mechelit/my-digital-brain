
CREATE TABLE public.ignored_emails (
  user_id uuid NOT NULL,
  external_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, external_id)
);
ALTER TABLE public.ignored_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ignored emails all" ON public.ignored_emails FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ignored_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pattern text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern)
);
ALTER TABLE public.ignored_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ignored suppliers all" ON public.ignored_suppliers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-remember deleted email-sourced invoices so they don't reimport
CREATE OR REPLACE FUNCTION public.remember_deleted_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.external_id IS NOT NULL AND OLD.source = 'email' THEN
    INSERT INTO public.ignored_emails (user_id, external_id, reason)
    VALUES (OLD.user_id, OLD.external_id, 'deleted')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_remember_deleted_invoice ON public.invoices;
CREATE TRIGGER trg_remember_deleted_invoice
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.remember_deleted_invoice();
