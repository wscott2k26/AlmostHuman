alter function public.almost_human_stage(numeric) set search_path = public;
alter function public.almost_human_stage_label(text) set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
