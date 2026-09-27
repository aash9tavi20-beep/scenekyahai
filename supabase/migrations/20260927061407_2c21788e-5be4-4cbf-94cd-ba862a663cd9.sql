ALTER TABLE public.curations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.curations ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS curations_device_id_idx ON public.curations(device_id);