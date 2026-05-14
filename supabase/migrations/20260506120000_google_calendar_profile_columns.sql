-- Google Calendar identity on CRM profile (per user, scoped by existing RLS on profiles)

ALTER TABLE public.crm_inmobiliario_profiles
  ADD COLUMN IF NOT EXISTS google_calendar_email text,
  ADD COLUMN IF NOT EXISTS google_calendar_linked_at timestamptz;

COMMENT ON COLUMN public.crm_inmobiliario_profiles.google_calendar_email IS 'Google account email last used for Calendar OAuth in this CRM app';
COMMENT ON COLUMN public.crm_inmobiliario_profiles.google_calendar_linked_at IS 'When the user last completed Google Calendar OAuth';
