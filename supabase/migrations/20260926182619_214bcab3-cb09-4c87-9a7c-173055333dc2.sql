CREATE TABLE public.curations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text,
  was_free boolean NOT NULL DEFAULT false,
  price_inr integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.curations TO authenticated;
GRANT ALL ON public.curations TO service_role;
ALTER TABLE public.curations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own curations read" ON public.curations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own curations insert" ON public.curations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX curations_user_idx ON public.curations(user_id);