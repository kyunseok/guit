begin;
lock table public.room_reservations in share row exclusive mode;

create table public.room_fixed_slots (
 id bigint generated always as identity primary key,
 weekday smallint not null check (weekday between 1 and 7),
 starts_local time not null,
 ends_local time not null,
 user_name text not null check (char_length(btrim(user_name)) between 1 and 100),
 purpose text not null default '기타교실' check (purpose in ('기타교실','합주연습')),
 people integer not null check (people > 0),
 effective_from date not null,
 effective_until date,
 check (ends_local > starts_local and ends_local - starts_local <= interval '2 hours'),
 check (effective_until is null or effective_until >= effective_from),
 unique (weekday, starts_local, effective_from)
);
alter table public.room_fixed_slots enable row level security;
revoke all on public.room_fixed_slots from public, anon, authenticated;
grant select on public.room_fixed_slots to anon;
create policy room_fixed_slots_public_read on public.room_fixed_slots for select to anon using (true);

insert into public.room_fixed_slots(weekday,starts_local,ends_local,user_name,people,effective_from) values
 (1,'18:00','19:00','기타교실 6조',6,(now() at time zone 'Asia/Seoul')::date),
 (2,'21:00','22:00','기타교실 2조',5,(now() at time zone 'Asia/Seoul')::date),
 (3,'21:00','22:00','기타교실 4조',5,(now() at time zone 'Asia/Seoul')::date),
 (3,'22:00','23:00','기타교실 3조',5,(now() at time zone 'Asia/Seoul')::date),
 (4,'20:00','21:00','기타교실 1조',6,(now() at time zone 'Asia/Seoul')::date),
 (5,'19:00','20:00','기타교실 5조',6,(now() at time zone 'Asia/Seoul')::date);

create function public.guitarhana_room_fixed_occurrences_v1(p_from timestamptz, p_to timestamptz)
returns table(id text,starts_at timestamptz,ends_at timestamptz,user_name text,purpose text,people integer,has_password boolean,is_fixed boolean)
language plpgsql stable security invoker set search_path = '' as $$
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to <= p_from or p_to-p_from > interval '366 days' then
  raise exception using errcode='22023',message='Invalid date range';
 end if;
 return query
 with dates as (
  select (p_from at time zone 'Asia/Seoul')::date + n as day
  from pg_catalog.generate_series(0,(p_to at time zone 'Asia/Seoul')::date-(p_from at time zone 'Asia/Seoul')::date) n
 ), occurrences as (
  select s.id as slot_id, d.day,
   (d.day+s.starts_local) at time zone 'Asia/Seoul' as starts_at,
   (d.day+s.ends_local) at time zone 'Asia/Seoul' as ends_at,
   s.user_name,s.purpose,s.people
  from dates d join public.room_fixed_slots s on s.weekday=extract(isodow from d.day)
  where d.day >= s.effective_from and (s.effective_until is null or d.day <= s.effective_until)
 )
 select 'fixed:'||o.slot_id::text||':'||o.day::text,o.starts_at,o.ends_at,o.user_name,o.purpose,o.people,false,true
 from occurrences o where o.starts_at < p_to and o.ends_at > p_from
 order by o.starts_at,o.slot_id;
end;
$$;
revoke all on function public.guitarhana_room_fixed_occurrences_v1(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.guitarhana_room_fixed_occurrences_v1(timestamptz,timestamptz) to anon;

do $$
begin
 if exists (
  select 1 from public.room_reservations r
  cross join lateral public.guitarhana_room_fixed_occurrences_v1(r.starts_at,r.ends_at) f
  where r.cancelled_at is null and r.ends_at > now()
 ) then raise exception 'Fixed schedule conflicts with existing reservations'; end if;
end;
$$;

create function guitarhana_private.enforce_room_fixed_slots() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.cancelled_at is not null then return new; end if;
 if new.starts_at is null or new.ends_at is null or not isfinite(new.starts_at) or not isfinite(new.ends_at) or new.ends_at <= new.starts_at or new.ends_at-new.starts_at > interval '2 hours' then
  raise exception using errcode='23514',message='Invalid reservation duration';
 end if;
 if exists(select 1 from public.guitarhana_room_fixed_occurrences_v1(new.starts_at,new.ends_at)) then
  raise exception using errcode='P0001',message='ROOM_FIXED_SLOT_CONFLICT';
 end if;
 return new;
end;
$$;
revoke all on function guitarhana_private.enforce_room_fixed_slots() from public,anon,authenticated;
create trigger room_reservations_fixed_slots before insert or update of starts_at,ends_at,cancelled_at on public.room_reservations
for each row execute function guitarhana_private.enforce_room_fixed_slots();

alter table public.room_reservations
 add column starts_at_kst timestamp generated always as (starts_at at time zone 'Asia/Seoul') stored,
 add column ends_at_kst timestamp generated always as (ends_at at time zone 'Asia/Seoul') stored;
notify pgrst,'reload schema';
commit;
