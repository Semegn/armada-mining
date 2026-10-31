-- 008_telegram_primary.sql
-- Run AFTER 004 and 007. Telegram reports for primary sites: when a daily entry (sacks,
-- depth, vein), a milling result, an excavator day or a sample is added, changed or deleted
-- for a day whose report is already in the channel, the bot updates that report, the same
-- way it already does for daily logs and statement entries. Only the list of watched
-- tables changes; the function from 004 is reused as it is. Safe to run more than once.
begin;

drop trigger if exists telegram_notify_change on public.audit_log;
create trigger telegram_notify_change
  after insert on public.audit_log
  for each row
  when (new.table_name in ('daily_logs', 'transactions',
                           'sack_counts', 'milling_results', 'excavator_logs', 'shaft_samples'))
  execute function public.telegram_notify_change();

commit;

-- Check: must say ok = true.
select 'report corrections also watch the primary-site tables' as check_name,
       exists (select 1 from pg_trigger
               where tgname = 'telegram_notify_change' and tgrelid = 'public.audit_log'::regclass
                 and pg_get_triggerdef(oid) like '%sack_counts%milling_results%excavator_logs%shaft_samples%') as ok;

-- UNDO: put back the trigger from 004 (daily logs and statement only):
-- drop trigger if exists telegram_notify_change on public.audit_log;
-- create trigger telegram_notify_change after insert on public.audit_log for each row
--   when (new.table_name in ('daily_logs', 'transactions')) execute function public.telegram_notify_change();
