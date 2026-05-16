-- Trigger: when a refund invoice is inserted, auto-mark the matching pending invoice as paid
CREATE OR REPLACE FUNCTION public.auto_pay_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_refund = true AND NEW.supplier IS NOT NULL THEN
    UPDATE public.invoices
    SET status = 'paid',
        paid_at = COALESCE(paid_at, now())
    WHERE user_id = NEW.user_id
      AND is_refund = false
      AND status = 'pending'
      AND supplier = NEW.supplier
      AND id <> NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS invoices_auto_pay_on_refund ON public.invoices;
CREATE TRIGGER invoices_auto_pay_on_refund
AFTER INSERT OR UPDATE OF is_refund ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_pay_on_refund();
