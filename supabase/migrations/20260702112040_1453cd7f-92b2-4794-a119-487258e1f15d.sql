
-- Remove all "Anyone can *" permissive policies. Access will go through
-- server functions (createServerFn) using the service-role client, with a
-- password check for admin mutations.

DROP POLICY IF EXISTS "Anyone can insert price_settings" ON public.price_settings;
DROP POLICY IF EXISTS "Anyone can read price_settings" ON public.price_settings;
DROP POLICY IF EXISTS "Anyone can update price_settings" ON public.price_settings;

DROP POLICY IF EXISTS "Anyone can insert prices" ON public.system_prices;
DROP POLICY IF EXISTS "Anyone can read prices" ON public.system_prices;
DROP POLICY IF EXISTS "Anyone can update prices" ON public.system_prices;

DROP POLICY IF EXISTS "Anyone can delete system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "Anyone can insert system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "Anyone can read system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "Anyone can update system_configs" ON public.system_configs;

DROP POLICY IF EXISTS "Anyone can delete components" ON public.components;
DROP POLICY IF EXISTS "Anyone can insert components" ON public.components;
DROP POLICY IF EXISTS "Anyone can read components" ON public.components;
DROP POLICY IF EXISTS "Anyone can update components" ON public.components;

DROP POLICY IF EXISTS "Anyone can delete scl" ON public.system_component_lines;
DROP POLICY IF EXISTS "Anyone can insert scl" ON public.system_component_lines;
DROP POLICY IF EXISTS "Anyone can read scl" ON public.system_component_lines;
DROP POLICY IF EXISTS "Anyone can update scl" ON public.system_component_lines;

DROP POLICY IF EXISTS "Anyone can delete battery_configs" ON public.battery_configs;
DROP POLICY IF EXISTS "Anyone can insert battery_configs" ON public.battery_configs;
DROP POLICY IF EXISTS "Anyone can read battery_configs" ON public.battery_configs;
DROP POLICY IF EXISTS "Anyone can update battery_configs" ON public.battery_configs;

-- RLS remains enabled on all tables. With no policies, anon/authenticated
-- clients cannot read or write. All access is now brokered by server
-- functions running under the service role.
