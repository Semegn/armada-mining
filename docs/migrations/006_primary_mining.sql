-- 006_primary_mining.sql
-- Primary (hard-rock) gold mine sites. Existing sites are not changed: they all
-- stay "alluvial" and keep working exactly as before.
--  * sites.site_type: 'alluvial' (default) or 'primary', chosen by the super admin
--    when a new site is created.
--  * inputs: sack weight (25 kg), production cut-off (0.4 g per sack) and the
--    "Excavator on this site" switch (off).
--  * shafts: the pits (dug by excavator) and shafts (dug by hand) of a primary site.
--    A pit or shaft is in exploration until production_from is set; results dated
--    on or after that day count as production.
--  * sack_counts: sacks dug per pit or shaft per day.
--  * milling_results: sacks milled and the grams of gold they gave.
--  * excavator_logs: excavator hours (exploration, production, idle) and the fuel
--    barrels used by the excavator and the mill each day.
--
-- Who can do what on the four new tables (the same as daily logs):
--  * read:   everyone assigned to the site (super admin: every site)
--  * add:    site managers and the super admin
--  * change: the super admin; a site manager only their own entries, and any pit
--            or shaft at their site (so they can switch it to production)
--  * delete: the super admin only
-- Every add, change and delete is recorded in the change history.
--
-- The app works before and after this is run. Safe to run more than once.
begin;

alter table public.sites
  add column if not exists site_type text not null default 'alluvial'
  check (site_type in ('alluvial', 'primary'));

alter table public.inputs
  add column if not exists sack_kg numeric not null default 25 check (sack_kg > 0);
alter table public.inputs
  add column if not exists cutoff_g_per_sack numeric not null default 0.4 check (cutoff_g_per_sack >= 0);
alter table public.inputs
  add column if not exists excavator_on boolean not null default false;

create table if not exists public.shafts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'shaft' check (kind in ('shaft', 'pit')),
  opened_on date not null default current_date,
  production_from date,
  closed_on date,
  notes text,
  logged_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (site_id, name),
  unique (id, site_id)
);

create table if not exists public.sack_counts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  shaft_id uuid not null,
  date date not null,
  sacks integer not null check (sacks > 0),
  notes text,
  logged_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (shaft_id, site_id) references public.shafts (id, site_id) on delete restrict
);

create table if not exists public.milling_results (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  shaft_id uuid not null,
  date date not null,
  sacks_milled integer not null check (sacks_milled > 0),
  gold_g numeric not null check (gold_g >= 0),
  notes text,
  logged_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (shaft_id, site_id) references public.shafts (id, site_id) on delete restrict
);

create table if not exists public.excavator_logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  date date not null,
  exploration_hrs numeric not null default 0 check (exploration_hrs >= 0),
  production_hrs numeric not null default 0 check (production_hrs >= 0),
  idle_hrs numeric not null default 0 check (idle_hrs >= 0),
  excavator_fuel_barrels numeric not null default 0 check (excavator_fuel_barrels >= 0),
  mill_fuel_barrels numeric not null default 0 check (mill_fuel_barrels >= 0),
  notes text,
  logged_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists sack_counts_site_date on public.sack_counts (site_id, date);
create index if not exists milling_results_site_date on public.milling_results (site_id, date);
create index if not exists excavator_logs_site_date on public.excavator_logs (site_id, date);

-- Read, add, change and delete rules (row level security).
alter table public.shafts enable row level security;
alter table public.sack_counts enable row level security;
alter table public.milling_results enable row level security;
alter table public.excavator_logs enable row level security;

revoke all on public.shafts, public.sack_counts, public.milling_results, public.excavator_logs from anon;
grant select, insert, update, delete
  on public.shafts, public.sack_counts, public.milling_results, public.excavator_logs to authenticated;

drop policy if exists shafts_select on public.shafts;
create policy shafts_select on public.shafts for select to authenticated
  using (public.has_site_access(site_id));
drop policy if exists shafts_insert on public.shafts;
create policy shafts_insert on public.shafts for insert to authenticated
  with check (public.can_write_daily_logs(site_id) and logged_by = auth.uid());
drop policy if exists shafts_update on public.shafts;
create policy shafts_update on public.shafts for update to authenticated
  using (public.can_write_daily_logs(site_id))
  with check (public.can_write_daily_logs(site_id));
drop policy if exists shafts_delete on public.shafts;
create policy shafts_delete on public.shafts for delete to authenticated
  using (public.can_edit_delete_operational(site_id));

drop policy if exists sack_counts_select on public.sack_counts;
create policy sack_counts_select on public.sack_counts for select to authenticated
  using (public.has_site_access(site_id));
drop policy if exists sack_counts_insert on public.sack_counts;
create policy sack_counts_insert on public.sack_counts for insert to authenticated
  with check (public.can_write_daily_logs(site_id) and logged_by = auth.uid());
drop policy if exists sack_counts_update on public.sack_counts;
create policy sack_counts_update on public.sack_counts for update to authenticated
  using (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()))
  with check (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()));
drop policy if exists sack_counts_delete on public.sack_counts;
create policy sack_counts_delete on public.sack_counts for delete to authenticated
  using (public.can_edit_delete_operational(site_id));

drop policy if exists milling_results_select on public.milling_results;
create policy milling_results_select on public.milling_results for select to authenticated
  using (public.has_site_access(site_id));
drop policy if exists milling_results_insert on public.milling_results;
create policy milling_results_insert on public.milling_results for insert to authenticated
  with check (public.can_write_daily_logs(site_id) and logged_by = auth.uid());
drop policy if exists milling_results_update on public.milling_results;
create policy milling_results_update on public.milling_results for update to authenticated
  using (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()))
  with check (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()));
drop policy if exists milling_results_delete on public.milling_results;
create policy milling_results_delete on public.milling_results for delete to authenticated
  using (public.can_edit_delete_operational(site_id));

drop policy if exists excavator_logs_select on public.excavator_logs;
create policy excavator_logs_select on public.excavator_logs for select to authenticated
  using (public.has_site_access(site_id));
drop policy if exists excavator_logs_insert on public.excavator_logs;
create policy excavator_logs_insert on public.excavator_logs for insert to authenticated
  with check (public.can_write_daily_logs(site_id) and logged_by = auth.uid());
drop policy if exists excavator_logs_update on public.excavator_logs;
create policy excavator_logs_update on public.excavator_logs for update to authenticated
  using (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()))
  with check (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()));
drop policy if exists excavator_logs_delete on public.excavator_logs;
create policy excavator_logs_delete on public.excavator_logs for delete to authenticated
  using (public.can_edit_delete_operational(site_id));

-- Change history: the same recorder the daily logs and statement use.
drop trigger if exists shafts_audit on public.shafts;
create trigger shafts_audit after insert or update or delete on public.shafts
  for each row execute function public.write_audit_log();
drop trigger if exists sack_counts_audit on public.sack_counts;
create trigger sack_counts_audit after insert or update or delete on public.sack_counts
  for each row execute function public.write_audit_log();
drop trigger if exists milling_results_audit on public.milling_results;
create trigger milling_results_audit after insert or update or delete on public.milling_results
  for each row execute function public.write_audit_log();
drop trigger if exists excavator_logs_audit on public.excavator_logs;
create trigger excavator_logs_audit after insert or update or delete on public.excavator_logs
  for each row execute function public.write_audit_log();

commit;

notify pgrst, 'reload schema';

-- Check: every row must say ok = true.
select 'every site has a type, and existing sites are alluvial' as check_name,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'sites' and column_name = 'site_type'
                 and column_default like '%alluvial%') as ok
union all
select 'Inputs have sack weight, cut-off and the excavator switch',
       (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'inputs'
          and column_name in ('sack_kg', 'cutoff_g_per_sack', 'excavator_on')) = 3
union all
select 'the four new tables are protected',
       (select count(*) from pg_class
        where oid in ('public.shafts'::regclass, 'public.sack_counts'::regclass,
                      'public.milling_results'::regclass, 'public.excavator_logs'::regclass)
          and relrowsecurity) = 4
union all
select 'people who are not logged in cannot read them',
       not (has_table_privilege('anon', 'public.shafts', 'select')
         or has_table_privilege('anon', 'public.sack_counts', 'select')
         or has_table_privilege('anon', 'public.milling_results', 'select')
         or has_table_privilege('anon', 'public.excavator_logs', 'select'))
union all
select 'each new table has its read, add, change and delete rules',
       (select count(*) from pg_policies
        where schemaname = 'public'
          and tablename in ('shafts', 'sack_counts', 'milling_results', 'excavator_logs')) = 16
union all
select 'only the super admin can delete',
       (select count(*) from pg_policies
        where schemaname = 'public'
          and tablename in ('shafts', 'sack_counts', 'milling_results', 'excavator_logs')
          and cmd = 'DELETE' and qual like '%can_edit_delete_operational%') = 4
union all
select 'every add, change and delete is recorded in the history',
       (select count(*) from pg_trigger t
        join pg_proc p on p.oid = t.tgfoid
        where p.proname = 'write_audit_log' and not t.tgisinternal
          and t.tgrelid in ('public.shafts'::regclass, 'public.sack_counts'::regclass,
                            'public.milling_results'::regclass, 'public.excavator_logs'::regclass)) = 4
union all
select 'sacks and results can only use a pit or shaft from the same site',
       (select count(*) from pg_constraint
        where contype = 'f' and confrelid = 'public.shafts'::regclass and cardinality(conkey) = 2
          and conrelid in ('public.sack_counts'::regclass, 'public.milling_results'::regclass)) = 2;

-- UNDO (only if something goes wrong). This deletes every pit, shaft, sack count,
-- milling result and excavator day, so only use it before real data is entered:
-- drop table if exists public.excavator_logs, public.milling_results, public.sack_counts, public.shafts;
-- alter table public.inputs drop column if exists excavator_on,
--   drop column if exists cutoff_g_per_sack, drop column if exists sack_kg;
-- alter table public.sites drop column if exists site_type;
