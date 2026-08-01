create or replace function public.delete_my_almost_human_data(confirm_phrase text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if confirm_phrase <> 'DELETE MY ALMOST HUMAN DATA' then
    raise exception 'Confirmation phrase mismatch' using errcode = '22023';
  end if;

  delete from public.ai_entities where user_id = uid;
  delete from public.admin_events where user_id = uid;
  update public.profiles
    set onboarding_complete = false, updated_at = now()
    where id = uid;
  update public.app_settings
    set last_growth_check_at = null, last_export_at = null
    where user_id = uid;

  return true;
end;
$$;

revoke all on function public.delete_my_almost_human_data(text) from public, anon;
grant execute on function public.delete_my_almost_human_data(text) to authenticated;
