CREATE POLICY "Anyone can delete system_configs" ON public.system_configs FOR DELETE USING (true);
GRANT DELETE ON public.system_configs TO anon, authenticated;