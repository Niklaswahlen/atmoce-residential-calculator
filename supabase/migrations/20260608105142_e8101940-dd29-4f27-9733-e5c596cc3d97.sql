
-- 1) price_settings
CREATE TABLE public.price_settings (
  id text PRIMARY KEY,
  margin_pct numeric NOT NULL DEFAULT 0.25,
  vat_pct numeric NOT NULL DEFAULT 0.25,
  gta_pv_pct numeric NOT NULL DEFAULT 0.20,
  gta_ess_pct numeric NOT NULL DEFAULT 0.50,
  default_panels integer NOT NULL DEFAULT 14,
  default_wp_panel integer NOT NULL DEFAULT 460,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_settings TO anon, authenticated;
GRANT ALL ON public.price_settings TO service_role;
ALTER TABLE public.price_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read price_settings" ON public.price_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert price_settings" ON public.price_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update price_settings" ON public.price_settings FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER touch_price_settings_updated_at
BEFORE UPDATE ON public.price_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_system_prices_updated_at();

-- 2) components
CREATE TABLE public.components (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  side text NOT NULL CHECK (side IN ('pv','ess')),
  unit text NOT NULL DEFAULT 'st',
  unit_price_ex_vat numeric NOT NULL DEFAULT 0,
  unit_kwh numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.components TO anon, authenticated;
GRANT ALL ON public.components TO service_role;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read components" ON public.components FOR SELECT USING (true);
CREATE POLICY "Anyone can insert components" ON public.components FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update components" ON public.components FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete components" ON public.components FOR DELETE USING (true);

CREATE TRIGGER touch_components_updated_at
BEFORE UPDATE ON public.components
FOR EACH ROW EXECUTE FUNCTION public.touch_system_prices_updated_at();

-- 3) system_configs
CREATE TABLE public.system_configs (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  battery_module_id text REFERENCES public.components(id) ON DELETE SET NULL,
  default_battery_modules integer NOT NULL DEFAULT 1,
  pv_override_inc_vat numeric,
  ess_override_inc_vat numeric,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_configs TO anon, authenticated;
GRANT ALL ON public.system_configs TO service_role;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read system_configs" ON public.system_configs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert system_configs" ON public.system_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update system_configs" ON public.system_configs FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER touch_system_configs_updated_at
BEFORE UPDATE ON public.system_configs
FOR EACH ROW EXECUTE FUNCTION public.touch_system_prices_updated_at();

-- 4) system_component_lines
CREATE TABLE public.system_component_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id text NOT NULL REFERENCES public.system_configs(id) ON DELETE CASCADE,
  component_id text NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  side text NOT NULL CHECK (side IN ('pv','ess')),
  qty_kind text NOT NULL CHECK (qty_kind IN ('fixed','per_panel','half_per_panel','per_battery_module')),
  qty_value numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_component_lines TO anon, authenticated;
GRANT ALL ON public.system_component_lines TO service_role;
ALTER TABLE public.system_component_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read scl" ON public.system_component_lines FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scl" ON public.system_component_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scl" ON public.system_component_lines FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete scl" ON public.system_component_lines FOR DELETE USING (true);

CREATE TRIGGER touch_scl_updated_at
BEFORE UPDATE ON public.system_component_lines
FOR EACH ROW EXECUTE FUNCTION public.touch_system_prices_updated_at();

CREATE INDEX scl_system_idx ON public.system_component_lines(system_id);

-- ============ SEEDS ============

INSERT INTO public.price_settings (id) VALUES ('current');

-- Shared / PV-side components
INSERT INTO public.components (id, name, category, side, unit, unit_price_ex_vat, unit_kwh) VALUES
  ('panel',                    'Solpanel 460Wp',                      'panel',              'pv', 'st',  750,    NULL),
  ('mounting',                 'Montagesystem',                       'mounting',           'pv', 'st',  500,    NULL),
  ('scaffolding',              'Ställning',                           'scaffolding',        'pv', 'st',  5000,   NULL),
  ('montage_ppp',              'Montage PPP',                         'panel_install',      'pv', 'st',  1000,   NULL),
  ('cabling_misc',             'Kablage & Övrigt',                    'cabling',            'pv', 'st',  1000,   NULL),
  ('cabling_misc_2000',        'Kablage & Övrigt (2000)',             'cabling',            'pv', 'st',  2000,   NULL),
  ('panel_install_labor',      'Installationskostnad solpaneler',     'panel_install',      'pv', 'st',  1000,   NULL),
  ('atmoce_microinverter',     'Atmoce mikroväxelriktare (2-i-1)',    'microinverter',      'pv', 'st',  1300,   NULL),
  ('atmoce_combiner',          'Atmoce Combiner',                     'accessory',          'pv', 'st',  7900,   NULL),
  ('atmoce_trunk_cable',       'Atmoce Trunk-kabel',                  'accessory',          'pv', 'st',  329,    NULL),
  ('atmoce_ac_material',       'AC-material (Atmoce)',                'ac_material',        'pv', 'st',  2000,   NULL),
  ('atmoce_electrical',        'Elinstallation (Atmoce)',             'electrical_install', 'pv', 'st',  10000,  NULL),
  ('atmoce_ct_clamps',         'CT-klämmor',                          'accessory',          'pv', 'st',  5500,   NULL),
  ('atmoce_freight',           'Frakt (Atmoce)',                      'freight',            'pv', 'st',  2000,   NULL),
  ('solis_10',                 'Solis 10 växelriktare',               'string_inverter',    'pv', 'st',  11300,  NULL),
  ('sigenstor',                'SigenStor',                           'string_inverter',    'pv', 'st',  18374,  NULL),
  ('saj_hs3_12kw',             'SAJ HS3 12kW',                        'string_inverter',    'pv', 'st',  15000,  NULL),
  ('huawei_m1',                'Huawei M1',                           'string_inverter',    'pv', 'st',  10600,  NULL),
  ('huawei_optimizer',         'Huawei optimerare (600W)',            'accessory',          'pv', 'st',  455,    NULL),
  -- ESS-side: battery modules
  ('atmoce_elv_module',        'Atmoce ELV batterimodul 7 kWh',       'battery_module',     'ess','st',  27500,  7.00),
  ('dyness_stack100_module',   'Dyness Stack100 modul 5.12 kWh',      'battery_module',     'ess','st',  31640,  5.12),
  ('sigenor_bat_9',            'Sigenor bat 9 kWh modul',             'battery_module',     'ess','st',  26362,  9.00),
  ('saj_hs3_battery_5',        'SAJ HS3 batterimodul 5 kWh',          'battery_module',     'ess','st',  13500,  5.00),
  ('qapasity_battery_module',  'Qapasity batterimodul 5.42 kWh',      'battery_module',     'ess','st',  10875,  5.42),
  ('huawei_s1_14',             'Huawei S1 14 kWh batteri',            'battery_module',     'ess','st',  54460,  14.00),
  -- ESS-side: accessory / labor for battery installation
  ('saj_hs3_base',             'SAJ HS3 Bas',                         'accessory',          'ess','st',  430,    NULL),
  ('sigen_sensor_tp',          'Sigen sensor tp',                     'accessory',          'ess','st',  1488,   NULL),
  ('sigen_install_kit',        'Sigen installation kit',              'accessory',          'ess','st',  1137,   NULL),
  ('qapasity_bms',             'Qapasity BMS',                        'accessory',          'ess','st',  6995,   NULL),
  ('ess_ac_material',          'AC-material (batteri)',               'ac_material',        'ess','st',  2000,   NULL),
  ('ess_electrical',           'Elinstallation (batteri)',            'electrical_install', 'ess','st',  8000,   NULL);

-- System configs
INSERT INTO public.system_configs (id, name, short, battery_module_id, default_battery_modules, sort_order) VALUES
  ('atmoce',         'Atmoce',                   'Atmoce',         'atmoce_elv_module',       2, 1),
  ('solis_dyness',   'Solis + Dyness Stack100',  'Solis/Dyness',   'dyness_stack100_module',  3, 2),
  ('sigenergy',      'Sigenergy',                'Sigenergy',      'sigenor_bat_9',           2, 3),
  ('saj_hs3',        'SAJ HS3',                  'SAJ HS3',        'saj_hs3_battery_5',       3, 4),
  ('solis_qapasity', 'Solis + Qapasity',         'Solis/Qapasity', 'qapasity_battery_module', 3, 5),
  ('huawei',         'Huawei (med Optimerare)',  'Huawei',         'huawei_s1_14',            1, 6);

-- ATMOCE lines
INSERT INTO public.system_component_lines (system_id, component_id, side, qty_kind, qty_value, sort_order) VALUES
  ('atmoce', 'panel',                  'pv',  'per_panel',      1, 1),
  ('atmoce', 'atmoce_microinverter',   'pv',  'half_per_panel', 1, 2),
  ('atmoce', 'mounting',               'pv',  'per_panel',      1, 3),
  ('atmoce', 'scaffolding',            'pv',  'fixed',          1, 4),
  ('atmoce', 'montage_ppp',            'pv',  'per_panel',      1, 5),
  ('atmoce', 'cabling_misc',           'pv',  'fixed',          1, 6),
  ('atmoce', 'atmoce_elv_module',      'ess', 'per_battery_module', 1, 1),
  ('atmoce', 'atmoce_combiner',        'ess', 'fixed',          1, 2),
  ('atmoce', 'atmoce_trunk_cable',     'ess', 'fixed',          1, 3),
  ('atmoce', 'atmoce_ac_material',     'ess', 'fixed',          1, 4),
  ('atmoce', 'atmoce_electrical',      'ess', 'fixed',          1, 5),
  ('atmoce', 'atmoce_ct_clamps',       'ess', 'fixed',          0, 6),
  ('atmoce', 'atmoce_freight',         'ess', 'fixed',          1, 7);

-- Solis + Dyness Stack100
INSERT INTO public.system_component_lines (system_id, component_id, side, qty_kind, qty_value, sort_order) VALUES
  ('solis_dyness', 'panel',                  'pv',  'per_panel', 1, 1),
  ('solis_dyness', 'mounting',               'pv',  'per_panel', 1, 2),
  ('solis_dyness', 'solis_10',               'pv',  'fixed',     1, 3),
  ('solis_dyness', 'panel_install_labor',    'pv',  'per_panel', 1, 4),
  ('solis_dyness', 'cabling_misc_2000',      'pv',  'fixed',     1, 5),
  ('solis_dyness', 'scaffolding',            'pv',  'fixed',     1, 6),
  ('solis_dyness', 'dyness_stack100_module', 'ess', 'per_battery_module', 1, 1),
  ('solis_dyness', 'ess_ac_material',        'ess', 'fixed',     1, 2),
  ('solis_dyness', 'ess_electrical',         'ess', 'fixed',     1, 3);

-- Sigenergy
INSERT INTO public.system_component_lines (system_id, component_id, side, qty_kind, qty_value, sort_order) VALUES
  ('sigenergy', 'panel',         'pv',  'per_panel', 1, 1),
  ('sigenergy', 'mounting',      'pv',  'per_panel', 1, 2),
  ('sigenergy', 'montage_ppp',   'pv',  'per_panel', 1, 3),
  ('sigenergy', 'cabling_misc_2000', 'pv', 'fixed',  1, 4),
  ('sigenergy', 'sigenstor',     'pv',  'fixed',     1, 5),
  ('sigenergy', 'scaffolding',   'pv',  'fixed',     1, 6),
  ('sigenergy', 'sigenor_bat_9',      'ess', 'per_battery_module', 1, 1),
  ('sigenergy', 'sigen_sensor_tp',    'ess', 'fixed', 1, 2),
  ('sigenergy', 'sigen_install_kit',  'ess', 'fixed', 1, 3),
  ('sigenergy', 'ess_ac_material',    'ess', 'fixed', 1, 4),
  ('sigenergy', 'ess_electrical',     'ess', 'fixed', 1, 5);

-- SAJ HS3
INSERT INTO public.system_component_lines (system_id, component_id, side, qty_kind, qty_value, sort_order) VALUES
  ('saj_hs3', 'panel',         'pv',  'per_panel', 1, 1),
  ('saj_hs3', 'mounting',      'pv',  'per_panel', 1, 2),
  ('saj_hs3', 'montage_ppp',   'pv',  'per_panel', 1, 3),
  ('saj_hs3', 'cabling_misc_2000', 'pv', 'fixed',  1, 4),
  ('saj_hs3', 'saj_hs3_12kw',  'pv',  'fixed',     1, 5),
  ('saj_hs3', 'scaffolding',   'pv',  'fixed',     1, 6),
  ('saj_hs3', 'saj_hs3_battery_5',  'ess', 'per_battery_module', 1, 1),
  ('saj_hs3', 'saj_hs3_base',       'ess', 'fixed', 1, 2),
  ('saj_hs3', 'sigen_install_kit',  'ess', 'fixed', 1, 3),
  ('saj_hs3', 'ess_ac_material',    'ess', 'fixed', 1, 4),
  ('saj_hs3', 'ess_electrical',     'ess', 'fixed', 1, 5);

-- Solis + Qapasity
INSERT INTO public.system_component_lines (system_id, component_id, side, qty_kind, qty_value, sort_order) VALUES
  ('solis_qapasity', 'panel',         'pv',  'per_panel', 1, 1),
  ('solis_qapasity', 'mounting',      'pv',  'per_panel', 1, 2),
  ('solis_qapasity', 'montage_ppp',   'pv',  'per_panel', 1, 3),
  ('solis_qapasity', 'cabling_misc_2000', 'pv', 'fixed',  1, 4),
  ('solis_qapasity', 'solis_10',      'pv',  'fixed',     1, 5),
  ('solis_qapasity', 'scaffolding',   'pv',  'fixed',     1, 6),
  ('solis_qapasity', 'qapasity_battery_module', 'ess', 'per_battery_module', 1, 1),
  ('solis_qapasity', 'qapasity_bms',  'ess', 'fixed', 1, 2),
  ('solis_qapasity', 'ess_ac_material','ess','fixed', 1, 3),
  ('solis_qapasity', 'ess_electrical', 'ess','fixed', 1, 4);

-- Huawei (med Optimerare)
INSERT INTO public.system_component_lines (system_id, component_id, side, qty_kind, qty_value, sort_order) VALUES
  ('huawei', 'panel',         'pv',  'per_panel', 1, 1),
  ('huawei', 'mounting',      'pv',  'per_panel', 1, 2),
  ('huawei', 'montage_ppp',   'pv',  'per_panel', 1, 3),
  ('huawei', 'cabling_misc_2000', 'pv', 'fixed',  1, 4),
  ('huawei', 'huawei_optimizer','pv','per_panel', 1, 5),
  ('huawei', 'huawei_m1',     'pv',  'fixed',     1, 6),
  ('huawei', 'scaffolding',   'pv',  'fixed',     1, 7),
  ('huawei', 'huawei_s1_14',  'ess', 'per_battery_module', 1, 1),
  ('huawei', 'ess_ac_material','ess','fixed', 1, 2),
  ('huawei', 'ess_electrical', 'ess','fixed', 1, 3);
