-- 007_pit_details_and_samples.sql
-- Run AFTER 006_primary_mining.sql. Only adds things; existing data is kept.
--  * shafts: location (GPS coordinates and/or a map link) and phase_history, the list
--    of exploration/production switches with their dates, so a pit or shaft can go back
--    to exploration after production and every result keeps the phase of its own date.
--  * sack_counts (the daily entry): depth reached in metres and the vein
--    (found / lost / not reached). A day can have 0 sacks (digging, no ore yet).
--  * shaft_samples: dated quartz/stone samples per pit or shaft, with depth, a written
--    description of what is seen, visible gold yes/no, and photos.
--  * Storage folder "samples" for the photos. Private: only people assigned to the
--    site can see them; site managers and the super admin add; only the super admin deletes.
-- Safe to run more than once.
begin;

alter table public.shafts add column if not exists latitude numeric check (latitude between -90 and 90);
alter table public.shafts add column if not exists longitude numeric check (longitude between -180 and 180);
alter table public.shafts add column if not exists map_link text;
alter table public.shafts add column if not exists phase_history jsonb not null default '[]'::jsonb;

-- Pits and shafts already switched to production keep that date in the new history.
update public.shafts
   set phase_history = jsonb_build_array(jsonb_build_object('phase', 'production', 'from', production_from))
 where production_from is not null and phase_history = '[]'::jsonb;

alter table public.sack_counts add column if not exists depth_m numeric check (depth_m >= 0);
alter table public.sack_counts add column if not exists vein text check (vein in ('found', 'lost', 'not_reached'));
alter table public.sack_counts drop constraint if exists sack_counts_sacks_check;
alter table public.sack_counts add constraint sack_counts_sacks_check check (sacks >= 0);

create table if not exists public.shaft_samples (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  shaft_id uuid not null,
  date date not null,
  depth_m numeric check (depth_m >= 0),
  sample_type text not null default 'quartz' check (sample_type in ('quartz', 'stone', 'other')),
  visible_gold boolean not null default false,
  description text not null check (length(btrim(description)) > 0),
  photo_paths text[] not null default '{}',
  logged_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (shaft_id, site_id) references public.shafts (id, site_id) on delete restrict
);
create index if not exists shaft_samples_site_date on public.shaft_samples (site_id, date);

alter table public.shaft_samples enable row level security;
revoke all on public.shaft_samples from anon;
grant select, insert, update, delete on public.shaft_samples to authenticated;

drop policy if exists shaft_samples_select on public.shaft_samples;
create policy shaft_samples_select on public.shaft_samples for select to authenticated
  using (public.has_site_access(site_id));
drop policy if exists shaft_samples_insert on public.shaft_samples;
create policy shaft_samples_insert on public.shaft_samples for insert to authenticated
  with check (public.can_write_daily_logs(site_id) and logged_by = auth.uid());
drop policy if exists shaft_samples_update on public.shaft_samples;
create policy shaft_samples_update on public.shaft_samples for update to authenticated
  using (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()))
  with check (public.can_edit_delete_operational(site_id) or (public.can_write_daily_logs(site_id) and logged_by = auth.uid()));
drop policy if exists shaft_samples_delete on public.shaft_samples;
create policy shaft_samples_delete on public.shaft_samples for delete to authenticated
  using (public.can_edit_delete_operational(site_id));

drop trigger if exists shaft_samples_audit on public.shaft_samples;
create trigger shaft_samples_audit after insert or update or delete on public.shaft_samples
  for each row execute function public.write_audit_log();

-- Photo storage. Files are saved as <site id>/<pit or shaft id>/<file>.jpg.
insert into storage.buckets (id, name, public)
values ('samples', 'samples', false)
on conflict (id) do update set public = false;

drop policy if exists samples_photos_read on storage.objects;
create policy samples_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'samples' and public.has_site_access(((storage.foldername(name))[1])::uuid));
drop policy if exists samples_photos_add on storage.objects;
create policy samples_photos_add on storage.objects for insert to authenticated
  with check (bucket_id = 'samples' and public.can_write_daily_logs(((storage.foldername(name))[1])::uuid));
drop policy if exists samples_photos_delete on storage.objects;
create policy samples_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'samples' and public.can_edit_delete_operational(((storage.foldername(name))[1])::uuid));

commit;

notify pgrst, 'reload schema';

-- Check: every row must say ok = true.
select 'pits and shafts have location and phase history' as check_name,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'shafts'
          and column_name in ('latitude', 'longitude', 'map_link', 'phase_history')) = 4 as ok
union all
select 'daily entries have depth and vein',
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'sack_counts'
          and column_name in ('depth_m', 'vein')) = 2
union all
select 'samples are protected, with read, add, change and delete rules',
       (select relrowsecurity from pg_class where oid = 'public.shaft_samples'::regclass)
       and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'shaft_samples') = 4
union all
select 'people who are not logged in cannot read samples',
       not has_table_privilege('anon', 'public.shaft_samples', 'select')
union all
select 'samples are recorded in the history',
       exists (select 1 from pg_trigger where tgname = 'shaft_samples_audit' and tgrelid = 'public.shaft_samples'::regclass)
union all
select 'the photo folder exists and is private',
       exists (select 1 from storage.buckets where id = 'samples' and not public)
union all
select 'photo rules are in place',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('samples_photos_read', 'samples_photos_add', 'samples_photos_delete')) = 3;

-- UNDO (only before real samples are entered; deletes samples and their photo rules):
-- drop policy if exists samples_photos_read on storage.objects;
-- drop policy if exists samples_photos_add on storage.objects;
-- drop policy if exists samples_photos_delete on storage.objects;
-- drop table if exists public.shaft_samples;
-- alter table public.sack_counts drop column if exists vein, drop column if exists depth_m;
-- alter table public.shafts drop column if exists phase_history, drop column if exists map_link,
--   drop column if exists longitude, drop column if exists latitude;
