ALTER TABLE public.battery_configs
  ADD COLUMN IF NOT EXISTS warranty_years integer,
  ADD COLUMN IF NOT EXISTS warranty_cycles integer;

UPDATE public.battery_configs SET warranty_years = 15, warranty_cycles = 8000 WHERE id = 'atmoce_melv';
UPDATE public.battery_configs SET warranty_years = 10, warranty_cycles = 6000 WHERE warranty_years IS NULL;