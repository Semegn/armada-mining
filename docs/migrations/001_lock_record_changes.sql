-- 001_lock_record_changes.sql
-- Applied to production on 2026-09-27.
--
-- 1) Only the super admin can change or delete saved daily logs and transactions.
--    (A site manager can still fix their own daily log; that rule is unchanged.)
-- 2) Nobody can write to the change history (audit_log) directly.
--    The automatic triggers keep recording every change.
--
-- Safe to run more than once.
begin;

create or replace function public.can_edit_delete_operational(target_site_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.has_site_access(target_site_id)
    and public.is_super_admin();
$function$;

drop policy if exists "System inserts audit log entries" on public.audit_log;

commit;

-- Check: every row must say ok = true.
select 'partners can no longer edit or delete' as check_name,
       pg_get_functiondef('public.can_edit_delete_operational(uuid)'::regprocedure)
         not ilike '%partner%' as ok
union all
select 'nobody can write to the history directly',
       not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'audit_log'
                     and cmd in ('INSERT', 'ALL'))
union all
select 'history recorder still works: ' || p.proname,
       p.prosecdef
         and (r.rolsuper or r.rolbypassrls
              or (p.proowner = c.relowner and not c.relforcerowsecurity))
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
join pg_roles r on r.oid = p.proowner
cross join (select relowner, relforcerowsecurity
            from pg_class where oid = 'public.audit_log'::regclass) c
where p.proname in ('write_audit_log', 'audit_log_changes');

-- UNDO (only if something goes wrong):
-- create or replace function public.can_edit_delete_operational(target_site_id uuid)
-- returns boolean language sql stable security definer set search_path to 'public'
-- as $function$ select public.has_site_access(target_site_id)
--   and (public.is_super_admin() or public.current_user_role() = 'partner'); $function$;
-- create policy "System inserts audit log entries" on public.audit_log
--   for insert to public with check (true);
