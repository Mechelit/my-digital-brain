
-- todos
CREATE TYPE public.todo_status AS ENUM ('open', 'in_progress', 'done');
CREATE TYPE public.todo_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.todo_source AS ENUM ('manual', 'mila', 'email');

CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status public.todo_status NOT NULL DEFAULT 'open',
  priority public.todo_priority NOT NULL DEFAULT 'normal',
  source public.todo_source NOT NULL DEFAULT 'manual',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own todos all" ON public.todos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER todos_touch_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- outlook_emails
CREATE TYPE public.email_draft_status AS ENUM ('none', 'pending_review', 'approved', 'sent', 'rejected');

CREATE TABLE public.outlook_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text,
  subject text,
  sender_name text,
  sender_email text,
  body_preview text,
  received_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  is_replied boolean NOT NULL DEFAULT false,
  draft_reply text,
  draft_status public.email_draft_status NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlook_emails TO authenticated;
GRANT ALL ON public.outlook_emails TO service_role;

ALTER TABLE public.outlook_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own outlook emails all" ON public.outlook_emails
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER outlook_emails_touch_updated_at
  BEFORE UPDATE ON public.outlook_emails
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
