
-- 1. project_intelligence
CREATE TABLE public.project_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL UNIQUE,
  summary text,
  technologies text[] NOT NULL DEFAULT '{}',
  data_sources text[] NOT NULL DEFAULT '{}',
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_intelligence TO authenticated;
GRANT ALL ON public.project_intelligence TO service_role;

ALTER TABLE public.project_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own project_intelligence all"
ON public.project_intelligence FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_project_intelligence_touch
BEFORE UPDATE ON public.project_intelligence
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_project_intelligence_activity
AFTER INSERT OR UPDATE OR DELETE ON public.project_intelligence
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- 2. capability_assets (M2M)
CREATE TABLE public.capability_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  capability_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, asset_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capability_assets TO authenticated;
GRANT ALL ON public.capability_assets TO service_role;

ALTER TABLE public.capability_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own capability_assets all"
ON public.capability_assets FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. grouping op capabilities
ALTER TABLE public.capabilities
ADD COLUMN IF NOT EXISTS grouping text;
