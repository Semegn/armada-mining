-- 004_telegram_history.sql
-- Telegram report history and corrections (needs 003 first).
--  * telegram_posts: which Telegram message holds which site's daily report or weekly
--    summary. Used to post past reports once only, and to update a report later.
--    Only the bot (service role) can read or write it.
--  * A trigger on audit_log: when a daily log or statement entry changes for a day whose
--    report (or that week's summary) is already in the channel, it asks the bot to
--    update the report and post a correction notice. It never blocks the save itself.
--
-- Safe to run more than once.
begin;

create table if not exists public.telegram_posts (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('daily', 'weekly')),
  report_date date not null,           -- daily: the day; weekly: the Monday the week starts
  chat_id bigint not null,
  message_ids bigint[] not null,       -- a long report can span several messages
  corrections jsonb not null default '[]'::jsonb,
  posted_at timestamptz not null default now(),
  edited_at timestamptz,
  unique (site_id, kind, report_date, chat_id)
);

alter table public.telegram_posts enable row level security;
revoke all on public.telegram_posts from anon, authenticated;

create or replace function public.telegram_notify_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row jsonb := coalesce(new.new_data, new.old_data);
  v_site uuid;
  v_dates date[];
begin
  begin
    v_site := (v_row ->> 'site_id')::uuid;
    v_dates := array_remove(array[(new.new_data ->> 'date')::date, (new.old_data ->> 'date')::date], null);
    if v_site is not null and exists (
      select 1 from public.telegram_posts p
      where p.site_id = v_site
        and ((p.kind = 'daily' and p.report_date = any (v_dates))
          or (p.kind = 'weekly' and p.report_date = any (
                select date_trunc('week', d)::date from unnest(v_dates) as d)))
    ) then
      perform net.http_post(
        url := 'https://fweibxyncvjmuxxbqhan.supabase.co/functions/v1/telegram-reports',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret')),
        body := jsonb_build_object('action', 'record_changed', 'audit_id', new.id),
        timeout_milliseconds := 60000
      );
    end if;
  exception when others then
    -- A problem here must never stop a daily log or statement entry from saving.
    raise warning 'telegram_notify_change: %', sqlerrm;
  end;
  return null;
end;
$function$;

drop trigger if exists telegram_notify_change on public.audit_log;
create trigger telegram_notify_change
  after insert on public.audit_log
  for each row
  when (new.table_name in ('daily_logs', 'transactions'))
  execute function public.telegram_notify_change();

commit;

-- Check: every row must say ok = true.
select 'report history is readable by the bot only' as check_name,
       (select relrowsecurity from pg_class where oid = 'public.telegram_posts'::regclass)
       and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_posts') as ok
union all
select 'changes to posted days are sent to the bot',
       exists (select 1 from pg_trigger
               where tgname = 'telegram_notify_change' and tgrelid = 'public.audit_log'::regclass and not tgisinternal)
union all
select 'a failed notice can never block saving',
       (select prosrc like '%exception when others%' from pg_proc where proname = 'telegram_notify_change');

-- UNDO (only if something goes wrong):
-- drop trigger if exists telegram_notify_change on public.audit_log;
-- drop function if exists public.telegram_notify_change();
-- drop table if exists public.telegram_posts;
