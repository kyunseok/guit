begin;
alter table public.room_reservations add column has_password boolean not null default false;
alter table public.room_reservations add column cancelled_at timestamptz;
alter table public.room_reservations drop constraint room_reservations_no_overlap;
alter table public.room_reservations add constraint room_reservations_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&) where (cancelled_at is null);
alter table public.room_reservations drop constraint room_reservations_user_name;
alter table public.room_reservations add constraint room_reservations_user_name check (cancelled_at is not null or (user_name is not null and char_length(btrim(user_name)) between 1 and 100 and user_name ~ '[^[:space:]]')) not valid;
alter table public.room_reservations drop constraint room_reservations_purpose_choice;
alter table public.room_reservations add constraint room_reservations_purpose_choice check (cancelled_at is not null or purpose in ('기타교실', '합주연습')) not valid;
alter policy room_reservations_public_read on public.room_reservations using (cancelled_at is null);
revoke insert (id, starts_at, ends_at, user_name, purpose, people) on public.room_reservations from anon;
drop policy room_reservations_future_booking on public.room_reservations;

create table guitarhana_private.room_reservation_secrets (
 reservation_id uuid primary key references public.room_reservations(id) on delete cascade,
 password_hash text,
 failed_attempts integer not null default 0,
 locked_until timestamptz
);
alter table guitarhana_private.room_reservation_secrets enable row level security;
revoke all on guitarhana_private.room_reservation_secrets from public, anon, authenticated;

create function guitarhana_private.room_reserve(p_id uuid, p_start timestamptz, p_end timestamptz, p_user text, p_purpose text, p_people integer, p_password text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.room_reservations%rowtype; pwd text := coalesce(p_password,'');
begin
 if p_id is null or char_length(pwd)>128 then raise exception using errcode='23514',message='Invalid reservation'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into r from public.room_reservations where id=p_id;
 if found then
  if r.cancelled_at is null and r.starts_at=p_start and r.ends_at=p_end and r.user_name=btrim(p_user) and r.purpose=p_purpose and r.people=p_people and r.has_password=(pwd<>'') then return p_id; end if;
  raise exception using errcode='23505',message='Request already used';
 end if;
 if p_start is null or p_start<=now() then raise exception using errcode='42501',message='Start must be in the future'; end if;
 insert into public.room_reservations(id,starts_at,ends_at,user_name,purpose,people,has_password)
 values(p_id,p_start,p_end,btrim(p_user),p_purpose,p_people,pwd<>'');
 insert into guitarhana_private.room_reservation_secrets(reservation_id,password_hash)
 values(p_id,case when pwd='' then null else extensions.crypt(encode(extensions.digest(pwd,'sha256'),'hex'),extensions.gen_salt('bf',10)) end);
 return p_id;
end;
$$;

create function guitarhana_private.room_cancel(p_id uuid, p_password text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare r public.room_reservations%rowtype; s guitarhana_private.room_reservation_secrets%rowtype; pwd text := coalesce(p_password,'');
begin
 if p_id is null or char_length(pwd)>128 then return 'invalid_password'; end if;
 select * into r from public.room_reservations where id=p_id for update;
 if not found or r.cancelled_at is not null then return 'already_cancelled'; end if;
 if r.has_password then
  if pwd='' then return 'password_required'; end if;
  select * into s from guitarhana_private.room_reservation_secrets where reservation_id=p_id for update;
  if not found or s.password_hash is null then return 'unavailable'; end if;
  if s.locked_until>now() then return 'rate_limited'; end if;
  if extensions.crypt(encode(extensions.digest(pwd,'sha256'),'hex'),s.password_hash)<>s.password_hash then
   update guitarhana_private.room_reservation_secrets set
    failed_attempts=case when failed_attempts>=4 then 0 else failed_attempts+1 end,
    locked_until=case when failed_attempts>=4 then now()+interval '5 minutes' else null end
   where reservation_id=p_id;
   if s.failed_attempts>=4 then return 'rate_limited'; end if;
   return 'invalid_password';
  end if;
 end if;
 update public.room_reservations set cancelled_at=now() where id=p_id;
 return 'cancelled';
end;
$$;

create function public.guitarhana_reserve_room_v1(p_id uuid, p_start timestamptz, p_end timestamptz, p_user text, p_purpose text, p_people integer, p_password text default '') returns uuid
language sql security invoker set search_path = '' as $$
 select guitarhana_private.room_reserve(p_id,p_start,p_end,p_user,p_purpose,p_people,p_password);
$$;
create function public.guitarhana_cancel_room_v1(p_id uuid, p_password text default '') returns text
language sql security invoker set search_path = '' as $$
 select guitarhana_private.room_cancel(p_id,p_password);
$$;
revoke all on function guitarhana_private.room_reserve(uuid,timestamptz,timestamptz,text,text,integer,text) from public, anon, authenticated;
revoke all on function guitarhana_private.room_cancel(uuid,text) from public, anon, authenticated;
revoke all on function public.guitarhana_reserve_room_v1(uuid,timestamptz,timestamptz,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.guitarhana_cancel_room_v1(uuid,text) from public, anon, authenticated;
grant execute on function guitarhana_private.room_reserve(uuid,timestamptz,timestamptz,text,text,integer,text) to anon;
grant execute on function guitarhana_private.room_cancel(uuid,text) to anon;
grant execute on function public.guitarhana_reserve_room_v1(uuid,timestamptz,timestamptz,text,text,integer,text) to anon;
grant execute on function public.guitarhana_cancel_room_v1(uuid,text) to anon;
notify pgrst,'reload schema';
commit;
