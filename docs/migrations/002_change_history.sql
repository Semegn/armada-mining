-- 002_change_history.sql
-- Lets everyone read the change history of the sites they work on (super admin: all
-- sites), with the name of the person who made each change. This is read-only:
-- nobody can add, change or delete history entries, and the audit_log table itself
-- stays readable by the super admin only. The History tab in the app uses this.
--
-- Run BEFORE deploying the app update that adds the History tab.
-- Safe to run more than once.
begin;

create or replace function public.site_change_history(
  p_site_id uuid,
  p_before_time timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  created_at timestamptz,
  table_name text,
  action text,
  changed_by uuid,
  changed_by_name text,
  old_data jsonb,
  new_data jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select a.id, a.created_at, a.table_name, a.action,
         coalesce(a.changed_by, a.user_id),
         u.name,
         coalesce(a.old_data, a.old_value),
         coalesce(a.new_data, a.new_value)
  from public.audit_log a
  left join public.users u on u.id = coalesce(a.changed_by, a.user_id)
  where public.has_site_access(p_site_id)
    and coalesce(a.new_data, a.new_value, a.old_data, a.old_value) ->> 'site_id' = p_site_id::text
    and (p_before_time is null or (a.created_at, a.id) < (p_before_time, p_before_id))
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$function$;

revoke all on function public.site_change_history(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.site_change_history(uuid, timestamptz, uuid, integer) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Check: every row must say ok = true.
select 'logged-in users can open the history' as check_name,
       has_function_privilege('authenticated',
         'public.site_change_history(uuid, timestamptz, uuid, integer)', 'execute') as ok
union all
select 'people who are not logged in cannot',
       not has_function_privilege('anon',
         'public.site_change_history(uuid, timestamptz, uuid, integer)', 'execute')
union all
select 'the history screen can read history and names',
       p.prosecdef
         and (r.rolsuper or r.rolbypassrls
              or (p.proowner = al.relowner and not al.relforcerowsecurity
                  and p.proowner = us.relowner and not us.relforcerowsecurity))
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
join pg_roles r on r.oid = p.proowner
cross join (select relowner, relforcerowsecurity from pg_class
            where oid = 'public.audit_log'::regclass) al
cross join (select relowner, relforcerowsecurity from pg_class
            where oid = 'public.users'::regclass) us
where p.proname = 'site_change_history';

-- UNDO (only if something goes wrong):
-- drop function if exists public.site_change_history(uuid, timestamptz, uuid, integer);
