begin;

create table public.room_reservations (
    id uuid primary key default gen_random_uuid(),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    user_name text not null,
    purpose text not null,
    people integer not null,
    created_at timestamptz not null default now(),
    constraint room_reservations_finite check (isfinite(starts_at) and isfinite(ends_at)),
    constraint room_reservations_duration check (ends_at > starts_at and ends_at - starts_at <= interval '2 hours'),
    constraint room_reservations_purpose check (char_length(btrim(purpose)) between 1 and 300 and purpose ~ '[^[:space:]]'),
    constraint room_reservations_user_name check (char_length(btrim(user_name)) between 1 and 100 and user_name ~ '[^[:space:]]'),
    constraint room_reservations_purpose_choice check (purpose in ('기타교실', '합주연습')),
    constraint room_reservations_people check (people > 0),
    constraint room_reservations_no_overlap exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
);

create index room_reservations_start_idx on public.room_reservations (starts_at, id);
alter table public.room_reservations enable row level security;
revoke all on public.room_reservations from public, anon, authenticated;
grant select on public.room_reservations to anon;
grant insert (id, starts_at, ends_at, user_name, purpose, people) on public.room_reservations to anon;
create policy room_reservations_public_read on public.room_reservations for select to anon using (true);
create policy room_reservations_future_booking on public.room_reservations for insert to anon
with check (starts_at >= (select now()));

notify pgrst, 'reload schema';
commit;
