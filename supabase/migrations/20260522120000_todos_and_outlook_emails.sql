-- ============================================
-- TODOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'mila', 'email')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own todos"
  ON public.todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos"
  ON public.todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos"
  ON public.todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos"
  ON public.todos FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS todos_status_idx ON public.todos(user_id, status);

-- ============================================
-- OUTLOOK EMAILS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.outlook_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT UNIQUE,
  subject TEXT,
  sender_name TEXT,
  sender_email TEXT,
  body_preview TEXT,
  body_full TEXT,
  received_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_replied BOOLEAN DEFAULT false,
  draft_reply TEXT,
  draft_status TEXT DEFAULT 'none' CHECK (draft_status IN ('none', 'pending_review', 'approved', 'sent', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.outlook_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outlook emails"
  ON public.outlook_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outlook emails"
  ON public.outlook_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outlook emails"
  ON public.outlook_emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outlook emails"
  ON public.outlook_emails FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS outlook_emails_user_id_idx ON public.outlook_emails(user_id);
CREATE INDEX IF NOT EXISTS outlook_emails_read_idx ON public.outlook_emails(user_id, is_read);
CREATE INDEX IF NOT EXISTS outlook_emails_external_id_idx ON public.outlook_emails(external_id);
