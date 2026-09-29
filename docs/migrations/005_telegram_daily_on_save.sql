-- 005_telegram_daily_on_save.sql
-- Daily Telegram reports are posted when the day's log is in, not at a fixed 8 pm:
--  * every 10 minutes: post the report of any day whose daily log was saved at least
--    30 minutes ago and isn't posted yet (logs from the last 3 days only);
--  * every morning at 9:00 Ethiopia time: post yesterday's report if it still isn't
--    posted, saying its daily log is missing.
-- The Sunday 20:05 weekly summary is unchanged.
--
-- Needs 003 and 004 first, and the bot version that knows these checks (the app's
-- Telegram section warns when the bot in Supabase is out of date). Safe to run more than once.
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'telegram-daily-report') then
    perform cron.unschedule('telegram-daily-report');
  end if;
end $$;

-- Schedules run in UTC; Ethiopia is UTC+3. Scheduling an existing job name replaces it.
select cron.schedule(
  'telegram-daily-due',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://fweibxyncvjmuxxbqhan.supabase.co/functions/v1/telegram-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret')),
    body := '{"action":"run","kind":"due"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

select cron.schedule(
  'telegram-morning-check',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://fweibxyncvjmuxxbqhan.supabase.co/functions/v1/telegram-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret')),
    body := '{"action":"run","kind":"morning"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

commit;

-- Check: every row must say ok = true.
select 'fixed 8 pm daily report removed' as check_name,
       not exists (select 1 from cron.job where jobname = 'telegram-daily-report') as ok
union all
select 'new logs checked every 10 minutes',
       exists (select 1 from cron.job where jobname = 'telegram-daily-due' and schedule = '*/10 * * * *' and active)
union all
select 'morning check at 9 am',
       exists (select 1 from cron.job where jobname = 'telegram-morning-check' and schedule = '0 6 * * *' and active)
union all
select 'Sunday weekly summary unchanged',
       exists (select 1 from cron.job where jobname = 'telegram-weekly-report' and schedule = '5 17 * * 0' and active);

-- UNDO (only if something goes wrong):
-- select cron.unschedule('telegram-daily-due');
-- select cron.unschedule('telegram-morning-check');
-- then run the 'telegram-daily-report' cron.schedule block from 003_telegram_reports.sql again.
