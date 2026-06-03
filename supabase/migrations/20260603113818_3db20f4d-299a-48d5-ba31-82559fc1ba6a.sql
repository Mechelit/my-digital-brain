
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text;
  v_summary text;
  v_name text;
  v_entity_id uuid;
  v_project_id uuid;
  v_user_id uuid;
  v_row jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'updated';
  ELSE v_action := 'deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_entity_id := NULLIF(v_row->>'id','')::uuid;
  v_user_id   := NULLIF(v_row->>'user_id','')::uuid;
  v_project_id := NULLIF(v_row->>'project_id','')::uuid;
  v_name := COALESCE(v_row->>'name', v_row->>'title', TG_TABLE_NAME);

  IF TG_OP = 'UPDATE' AND to_jsonb(NEW)::text = to_jsonb(OLD)::text THEN
    RETURN NEW;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_summary := initcap(TG_TABLE_NAME) || ' "' || v_name || '" ' || v_action;

  INSERT INTO public.activity_events (user_id, entity_type, entity_id, project_id, action, summary, source)
  VALUES (v_user_id, TG_TABLE_NAME, v_entity_id, v_project_id, v_action, v_summary, 'trigger');

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;
