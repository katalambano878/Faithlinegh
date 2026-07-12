-- Per-user feature permissions for staff members.
-- When set, overrides the role-level defaults from the roles table.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT NULL;
