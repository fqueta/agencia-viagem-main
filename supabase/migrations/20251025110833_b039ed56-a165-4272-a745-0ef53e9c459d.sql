-- Create installments table for payment splits
CREATE TABLE public.installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_installment_number CHECK (installment_number > 0 AND installment_number <= total_installments)
);

-- Enable RLS
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own installments" 
ON public.installments 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create installments" 
ON public.installments 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own installments" 
ON public.installments 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own installments" 
ON public.installments 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_installments_updated_at
BEFORE UPDATE ON public.installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_installments_payment_id ON public.installments(payment_id);
CREATE INDEX idx_installments_due_date ON public.installments(due_date);
CREATE INDEX idx_installments_status ON public.installments(status);

-- Add function to automatically update payment status based on installments
CREATE OR REPLACE FUNCTION public.update_payment_status_from_installments()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to update payment status when installments change
CREATE TRIGGER update_payment_status_on_installment_change
AFTER INSERT OR UPDATE OR DELETE ON public.installments
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_status_from_installments();