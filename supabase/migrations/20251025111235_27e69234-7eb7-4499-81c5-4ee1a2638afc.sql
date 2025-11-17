-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.update_payment_status_from_installments()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_installments INTEGER;
  paid_installments INTEGER;
  overdue_installments INTEGER;
BEGIN
  -- Count total, paid, and overdue installments for this payment
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE))
  INTO total_installments, paid_installments, overdue_installments
  FROM public.installments
  WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id);

  -- Update payment status based on installments
  UPDATE public.payments
  SET status = CASE
    WHEN paid_installments = total_installments THEN 'paid'::payment_status
    WHEN paid_installments > 0 THEN 'partial'::payment_status
    WHEN overdue_installments > 0 THEN 'overdue'::payment_status
    ELSE 'pending'::payment_status
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;