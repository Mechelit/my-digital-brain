
-- 1. Storage: UPDATE policy for invoice-scans bucket (owner only)
DROP POLICY IF EXISTS "invoice-scans owner update" ON storage.objects;
CREATE POLICY "invoice-scans owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'invoice-scans' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'invoice-scans' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2. Realtime authorization: restrict channel subscriptions to owner of scan session
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan session owner can listen" ON realtime.messages;
CREATE POLICY "scan session owner can listen"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mobile_scan_sessions s
    WHERE s.user_id = (SELECT auth.uid())
      AND realtime.topic() = 'scan-' || s.token
  )
);

DROP POLICY IF EXISTS "scan session owner can broadcast" ON realtime.messages;
CREATE POLICY "scan session owner can broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.mobile_scan_sessions s
    WHERE s.user_id = (SELECT auth.uid())
      AND realtime.topic() = 'scan-' || s.token
  )
);
