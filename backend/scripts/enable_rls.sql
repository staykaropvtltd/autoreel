-- Enable Row Level Security (RLS) on all public tables to secure them
-- from unauthorized public access via Supabase PostgREST API (anon key).
-- The backend connects via DATABASE_URL as postgres superuser which bypasses RLS.

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.uploaded_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.editor_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reel_jobs ENABLE ROW LEVEL SECURITY;
