
CREATE TABLE public.system_prices (
  id text PRIMARY KEY,
  name text NOT NULL,
  pv_price numeric NOT NULL DEFAULT 0,
  ess_price numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_prices TO anon, authenticated;
GRANT ALL ON public.system_prices TO service_role;

ALTER TABLE public.system_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read prices"
  ON public.system_prices FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update prices"
  ON public.system_prices FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert prices"
  ON public.system_prices FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_system_prices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_system_prices_updated_at
  BEFORE UPDATE ON public.system_prices
  FOR EACH ROW EXECUTE FUNCTION public.touch_system_prices_updated_at();

INSERT INTO public.system_prices (id, name, pv_price, ess_price) VALUES
  ('atmoce', 'Atmoce', 62918.75, 60335.16),
  ('solis_dyness', 'Solis + Dyness Stack100', 65062.50, 32531.25),
  ('sigenergy', 'Sigenergy', 74265.00, 56211.72),
  ('saj_hs3', 'SAJ HS3', 69687.50, 40677.34),
  ('solis_qapasity', 'Solis + Qapasity', 65062.50, 47937.50),
  ('huawei', 'Huawei (med Optimerare)', 72718.75, 50359.38);
