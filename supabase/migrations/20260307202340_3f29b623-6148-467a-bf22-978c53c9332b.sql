
-- Enums
CREATE TYPE public.cash_transaction_type AS ENUM ('IN', 'OUT', 'RESET');
CREATE TYPE public.cash_source_type AS ENUM ('SERVICE_ORDER', 'MANUAL', 'WITHDRAWAL', 'CORRECTION');

-- Cash Transactions
CREATE TABLE public.cash_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type cash_transaction_type NOT NULL,
  source_type cash_source_type NOT NULL DEFAULT 'MANUAL',
  related_order_id UUID REFERENCES public.service_orders(id),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cash_transactions_date ON public.cash_transactions(transaction_date);
CREATE INDEX idx_cash_transactions_type ON public.cash_transactions(transaction_type);
CREATE INDEX idx_cash_transactions_order ON public.cash_transactions(related_order_id);

-- RLS
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cash_transactions" ON public.cash_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cash_transactions" ON public.cash_transactions FOR INSERT TO authenticated WITH CHECK (true);
