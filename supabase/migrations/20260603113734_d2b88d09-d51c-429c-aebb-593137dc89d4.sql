
-- ============ ASSETS ============
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Infrastructure',
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assets all" ON public.assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER assets_touch BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PROJECT_ASSETS ============
CREATE TABLE public.project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assets TO authenticated;
GRANT ALL ON public.project_assets TO service_role;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own project_assets all" ON public.project_assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ FEATURES ============
CREATE TABLE public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'sandbox',
  approved_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.features TO authenticated;
GRANT ALL ON public.features TO service_role;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own features all" ON public.features FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER features_touch BEFORE UPDATE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SANDBOX ITEMS ============
CREATE TABLE public.sandbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  name text NOT NULL,
  description text,
  estimated_cost numeric,
  estimated_build_time text,
  used_assets text[] DEFAULT '{}',
  used_capabilities text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sandbox_items TO authenticated;
GRANT ALL ON public.sandbox_items TO service_role;
ALTER TABLE public.sandbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sandbox all" ON public.sandbox_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sandbox_touch BEFORE UPDATE ON public.sandbox_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ACTIVITY TIMELINE ============
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  project_id uuid,
  action text NOT NULL,
  summary text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity all" ON public.activity_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX activity_events_user_time ON public.activity_events (user_id, created_at DESC);

-- ============ AUTO-LOG FUNCTION ============
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text;
  v_summary text;
  v_name text;
  v_entity_id uuid;
  v_project_id uuid;
  v_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'updated';
  ELSE v_action := 'deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id; v_user_id := OLD.user_id;
    v_name := COALESCE(OLD.name, OLD.title, TG_TABLE_NAME);
    BEGIN v_project_id := OLD.project_id; EXCEPTION WHEN OTHERS THEN v_project_id := NULL; END;
  ELSE
    v_entity_id := NEW.id; v_user_id := NEW.user_id;
    v_name := COALESCE(NEW.name, NEW.title, TG_TABLE_NAME);
    BEGIN v_project_id := NEW.project_id; EXCEPTION WHEN OTHERS THEN v_project_id := NULL; END;
  END IF;

  -- Skip noisy updates: only log meaningful UPDATEs
  IF TG_OP = 'UPDATE' THEN
    IF row_to_json(NEW)::text = row_to_json(OLD)::text THEN
      RETURN NEW;
    END IF;
  END IF;

  v_summary := initcap(TG_TABLE_NAME) || ' "' || v_name || '" ' || v_action;

  INSERT INTO public.activity_events (user_id, entity_type, entity_id, project_id, action, summary, source)
  VALUES (v_user_id, TG_TABLE_NAME, v_entity_id, v_project_id, v_action, v_summary, 'trigger');

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers
CREATE TRIGGER log_projects_activity AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_features_activity AFTER INSERT OR UPDATE OR DELETE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_sandbox_activity AFTER INSERT OR UPDATE OR DELETE ON public.sandbox_items
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_decisions_activity AFTER INSERT OR UPDATE OR DELETE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_assets_activity AFTER INSERT OR UPDATE OR DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_capabilities_activity AFTER INSERT OR UPDATE OR DELETE ON public.capabilities
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_workflows_activity AFTER INSERT OR UPDATE OR DELETE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
