begin;

create table public.song_feedback (
    id uuid primary key default gen_random_uuid(),
    song_key text not null check (song_key ~ '^[a-f0-9]{64}$'),
    song_title text not null check (char_length(btrim(song_title)) between 1 and 500),
    performance text not null check (char_length(btrim(performance)) between 1 and 100),
    author_name text not null default '익명' check (char_length(btrim(author_name)) between 1 and 30),
    body text not null check (char_length(btrim(body)) between 1 and 1000),
    created_at timestamptz not null default now()
);

create index song_feedback_song_created_idx on public.song_feedback (song_key, created_at desc, id desc);
alter table public.song_feedback enable row level security;
revoke all on public.song_feedback from public, anon, authenticated;
grant select on public.song_feedback to anon;
grant insert (id, song_key, song_title, performance, author_name, body) on public.song_feedback to anon;
create policy song_feedback_public_read on public.song_feedback for select to anon using (true);
create policy song_feedback_public_write on public.song_feedback for insert to anon
with check (song_key ~ '^[a-f0-9]{64}$' and char_length(btrim(body)) between 1 and 1000 and char_length(btrim(author_name)) between 1 and 30);

notify pgrst, 'reload schema';
commit;
