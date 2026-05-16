CREATE OR REPLACE FUNCTION public.auto_pay_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_refund = true THEN
    NEW.status := 'paid';
    NEW.paid_at := COALESCE(NEW.paid_at, now());

    IF NEW.supplier IS NOT NULL THEN
      UPDATE public.invoices
      SET status = 'paid',
          paid_at = COALESCE(paid_at, now())
      WHERE user_id = NEW.user_id
        AND is_refund = false
        AND status = 'pending'
        AND supplier = NEW.supplier
        AND id <> NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_pay_on_refund() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS invoices_auto_pay_on_refund ON public.invoices;
CREATE TRIGGER invoices_auto_pay_on_refund
BEFORE INSERT OR UPDATE OF is_refund, supplier
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_pay_on_refund();

WITH refund_suppliers AS (
  SELECT DISTINCT user_id, supplier
  FROM public.invoices
  WHERE is_refund = true
    AND supplier IS NOT NULL
)
UPDATE public.invoices i
SET status = 'paid',
    paid_at = COALESCE(i.paid_at, now())
WHERE i.status = 'pending'
  AND (
    i.is_refund = true
    OR EXISTS (
      SELECT 1
      FROM refund_suppliers r
      WHERE r.user_id = i.user_id
        AND r.supplier = i.supplier
    )
  );