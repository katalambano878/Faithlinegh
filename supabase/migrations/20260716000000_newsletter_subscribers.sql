-- Newsletter subscribers captured from the storefront newsletter section.
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  source text DEFAULT 'homepage',
  subscribed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON public.newsletter_subscribers USING btree (email);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Only admin/staff can read the list; inserts go through the service role API.
DROP POLICY IF EXISTS "newsletter_admin" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_admin" ON public.newsletter_subscribers
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
