
CREATE TYPE public.contract_type AS ENUM ('huur','abonnement','verzekering','lening','werk','ander');

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type contract_type NOT NULL DEFAULT 'ander',
  counterparty text,
  start_date date,
  end_date date,
  monthly_amount numeric,
  currency text NOT NULL DEFAULT 'EUR',
  notes text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contracts all" ON public.contracts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for contract files
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts','contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own contract files read" ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own contract files insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own contract files update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own contract files delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
