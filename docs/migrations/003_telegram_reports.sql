-- 003_telegram_reports.sql
-- Telegram reports: each site can post a daily report (20:00 Ethiopia time) and a
-- weekly summary (Sundays 20:05) to its own Telegram channel.
--  * site_telegram: which channel belongs to which site. Super admin only.
--  * telegram_cron_secret: a random password created inside the database (Vault).
--    The schedule sends it, and the telegram-reports Edge Function checks it,
--    so nobody else can trigger reports. No one ever needs to copy it.
--  * Two pg_cron schedules that call the telegram-reports Edge Function.
--
-- Before running: deploy the telegram-reports Edge Function (see docs/SETUP.md).
-- Safe to run more than once.
begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.site_telegram (
  site_id uuid primary key references public.sites(id) on delete cascade,
  chat_id bigint not null,
  chat_title text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.site_telegram enable row level security;
revoke all on public.site_telegram from anon;

drop policy if exists site_telegram_super_admin on public.site_telegram;
create policy site_telegram_super_admin on public.site_telegram
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'telegram_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'telegram_cron_secret',
      'Lets pg_cron trigger the telegram-reports Edge Function');
  end if;
end $$;

create or replace function public.telegram_cron_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'telegram_cron_secret' and decrypted_secret = p_secret
  );
$function$;

revoke all on function public.telegram_cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.telegram_cron_secret_ok(text) to service_role;

-- Schedules run in UTC. 17:00 UTC = 20:00 in Ethiopia (UTC+3, no daylight saving).
-- Scheduling an existing job name replaces it, so re-running does not duplicate.
select cron.schedule(
  'telegram-daily-report',
  '0 17 * * *',
  $cron$
  select net.http_post(
    url := 'https://fweibxyncvjmuxxbqhan.supabase.co/functions/v1/telegram-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret')),
    body := '{"action":"run","kind":"daily"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

select cron.schedule(
  'telegram-weekly-report',
  '5 17 * * 0',
  $cron$
  select net.http_post(
    url := 'https://fweibxyncvjmuxxbqhan.supabase.co/functions/v1/telegram-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret')),
    body := '{"action":"run","kind":"weekly"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

commit;

notify pgrst, 'reload schema';

-- Check: every row must say ok = true.
select 'channel settings are locked to the super admin' as check_name,
       (select relrowsecurity from pg_class where oid = 'public.site_telegram'::regclass) as ok
union all
select 'internal schedule password exists',
       exists (select 1 from vault.secrets where name = 'telegram_cron_secret')
union all
select 'daily 8 pm schedule is set',
       exists (select 1 from cron.job where jobname = 'telegram-daily-report' and schedule = '0 17 * * *' and active)
union all
select 'Sunday 8 pm schedule is set',
       exists (select 1 from cron.job where jobname = 'telegram-weekly-report' and schedule = '5 17 * * 0' and active)
union all
select 'only the bot can check the schedule password',
       has_function_privilege('service_role', 'public.telegram_cron_secret_ok(text)', 'execute')
       and not has_function_privilege('authenticated', 'public.telegram_cron_secret_ok(text)', 'execute')
       and not has_function_privilege('anon', 'public.telegram_cron_secret_ok(text)', 'execute');

-- UNDO (only if something goes wrong):
-- select cron.unschedule('telegram-daily-report');
-- select cron.unschedule('telegram-weekly-report');
-- drop function if exists public.telegram_cron_secret_ok(text);
-- delete from vault.secrets where name = 'telegram_cron_secret';
-- drop table if exists public.site_telegram;
