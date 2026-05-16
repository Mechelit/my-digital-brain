
-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  inbox_alias TEXT UNIQUE NOT NULL DEFAULT lower(substr(md5(random()::text), 1, 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ACCOUNTS
CREATE TABLE public.accounts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  iban TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts all" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INVOICES
CREATE TYPE invoice_status AS ENUM ('pending', 'confirmed', 'paid', 'archived');
CREATE TYPE invoice_source AS ENUM ('scan', 'upload', 'email', 'mobile_scan');

CREATE TABLE public.invoices (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source invoice_source NOT NULL DEFAULT 'scan',
  status invoice_status NOT NULL DEFAULT 'pending',
  supplier TEXT,
  amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'EUR',
  iban TEXT,
  bic TEXT,
  structured_reference TEXT,
  free_reference TEXT,
  invoice_date DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_from_account UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  scan_path TEXT,
  raw_extraction JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user_status_idx ON public.invoices(user_id, status, due_date);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoices all" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- MOBILE SCAN SESSIONS (desktop -> gsm QR handoff)
CREATE TABLE public.mobile_scan_sessions (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mobile_scan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scan sessions all" ON public.mobile_scan_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_scan_sessions;
ALTER TABLE public.mobile_scan_sessions REPLICA IDENTITY FULL;

-- STORAGE BUCKET for scans (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-scans', 'invoice-scans', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own scans read" ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own scans insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own scans delete" ON storage.objects FOR DELETE
USING (bucket_id = 'invoice-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
