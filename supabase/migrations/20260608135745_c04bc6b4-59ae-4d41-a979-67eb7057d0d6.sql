
CREATE TABLE public.battery_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  base_component_id text REFERENCES public.components(id),
  module_component_id text NOT NULL REFERENCES public.components(id),
  bms_component_id text REFERENCES public.components(id),
  min_modules integer NOT NULL DEFAULT 1,
  max_modules integer NOT NULL DEFAULT 15,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.battery_configs TO anon, authenticated;
GRANT ALL ON public.battery_configs TO service_role;

ALTER TABLE public.battery_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read battery_configs" ON public.battery_configs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert battery_configs" ON public.battery_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update battery_configs" ON public.battery_configs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete battery_configs" ON public.battery_configs FOR DELETE USING (true);

ALTER TABLE public.system_configs
  ADD COLUMN battery_config_id text REFERENCES public.battery_configs(id);
