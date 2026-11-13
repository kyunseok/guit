begin;

create schema if not exists guitarhana_private;
revoke all on schema guitarhana_private from public, anon, authenticated;
grant usage on schema guitarhana_private to anon;

create table if not exists guitarhana_private.admin_settings (
    id integer primary key check (id = 1),
    password_hash text not null
);
alter table guitarhana_private.admin_settings enable row level security;
revoke all on table guitarhana_private.admin_settings from public, anon, authenticated;

alter table public.applicants enable row level security;
alter table public.interview_slots enable row level security;
revoke all on table public.applicants, public.interview_slots from public, anon, authenticated;
revoke all on sequence public.interview_slots_id_seq from public, anon, authenticated;
drop policy if exists "Enable read access for all users" on public.applicants;
drop policy if exists "Enable read access for all users" on public.interview_slots;
drop policy if exists "Enable insert access for all users" on public.applicants;
drop policy if exists "Enable insert access for all users" on public.interview_slots;
drop policy if exists guitarhana_pages_public_read_v1 on public.applicants;
drop policy if exists guitarhana_pages_public_read_v1 on public.interview_slots;

create or replace function guitarhana_private.submit_application_v1(
    p_name text,
    p_student_id text,
    p_phone text,
    p_motive text,
    p_slots text[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_code text;
    v_inserted text;
    v_slot text;
    v_attempt integer;
begin
    if coalesce(length(btrim(p_name)), 0) not between 1 and 10
       or coalesce(length(btrim(p_student_id)), 0) not between 1 and 20
       or coalesce(length(btrim(p_phone)), 0) not between 1 and 15
       or coalesce(length(btrim(p_motive)), 0) not between 1 and 1000
       or coalesce(cardinality(p_slots), 0) not between 1 and 100 then
        raise exception 'Invalid application fields' using errcode = '22023';
    end if;
    foreach v_slot in array p_slots loop
        if coalesce(length(btrim(v_slot)), 0) not between 1 and 200 then
            raise exception 'Invalid interview slot' using errcode = '22023';
        end if;
    end loop;

    for v_attempt in 1..10 loop
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        v_inserted := null;
        insert into public.applicants (id, name, student_id, phone, motive)
        values (v_code, btrim(p_name), btrim(p_student_id), btrim(p_phone), btrim(p_motive))
        on conflict (id) do nothing
        returning id into v_inserted;
        exit when v_inserted is not null;
    end loop;
    if v_inserted is null then
        raise exception 'Application code unavailable' using errcode = 'P0001';
    end if;

    insert into public.interview_slots (applicant_id, interview_time)
    select v_code, slot from (select distinct btrim(unnest(p_slots)) as slot) as selected_slots;

    return v_code;
end;
$$;


create or replace function guitarhana_private.lookup_application_v1(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
begin
    if p_code is null or p_code !~ '^[A-Z0-9]{6}$' then
        raise exception 'Invalid application code' using errcode = '22023';
    end if;
    select to_jsonb(a) || jsonb_build_object('interview_slots',
        coalesce((select jsonb_agg(jsonb_build_object('interview_time', s.interview_time) order by s.id)
            from public.interview_slots s where s.applicant_id = a.id), '[]'::jsonb))
    into v_result from public.applicants a where a.id = p_code;
    return v_result;
end;
$$;

create or replace function guitarhana_private.admin_applicants_v1(p_password text, p_offset integer, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_hash text;
    v_rows jsonb;
    v_total bigint;
begin
    if coalesce(octet_length(p_password), 0) not between 1 and 72 then
        raise exception 'Invalid administrator password' using errcode = '42501';
    end if;
    select password_hash into v_hash from guitarhana_private.admin_settings where id = 1;
    if v_hash is null or extensions.crypt(p_password, v_hash) is distinct from v_hash then
        raise exception 'Invalid administrator password' using errcode = '42501';
    end if;
    if p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 500 then
        raise exception 'Invalid pagination' using errcode = '22023';
    end if;
    select count(*) into v_total from public.applicants;
    select coalesce(jsonb_agg(row_data order by created_at desc, id desc), '[]'::jsonb)
    into v_rows from (
        select a.id, a.created_at, to_jsonb(a) || jsonb_build_object('interview_slots',
            coalesce((select jsonb_agg(jsonb_build_object('interview_time', s.interview_time) order by s.id)
                from public.interview_slots s where s.applicant_id = a.id), '[]'::jsonb)) as row_data
        from public.applicants a order by a.created_at desc, a.id desc limit p_limit offset p_offset
    ) page;
    return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

create or replace function public.guitarhana_submit_application_v1(p_name text, p_student_id text, p_phone text, p_motive text, p_slots text[])
returns text language sql security invoker set search_path = ''
as $$ select guitarhana_private.submit_application_v1(p_name, p_student_id, p_phone, p_motive, p_slots); $$;

create or replace function public.guitarhana_lookup_application_v1(p_code text)
returns jsonb language sql security invoker set search_path = ''
as $$ select guitarhana_private.lookup_application_v1(p_code); $$;

create or replace function public.guitarhana_admin_applicants_v1(p_password text, p_offset integer default 0, p_limit integer default 500)
returns jsonb language sql security invoker set search_path = ''
as $$ select guitarhana_private.admin_applicants_v1(p_password, p_offset, p_limit); $$;

revoke all on function guitarhana_private.submit_application_v1(text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function guitarhana_private.lookup_application_v1(text) from public, anon, authenticated;
revoke all on function guitarhana_private.admin_applicants_v1(text, integer, integer) from public, anon, authenticated;
revoke all on function public.guitarhana_submit_application_v1(text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.guitarhana_lookup_application_v1(text) from public, anon, authenticated;
revoke all on function public.guitarhana_admin_applicants_v1(text, integer, integer) from public, anon, authenticated;

grant execute on function guitarhana_private.submit_application_v1(text, text, text, text, text[]) to anon;
grant execute on function guitarhana_private.lookup_application_v1(text) to anon;
grant execute on function guitarhana_private.admin_applicants_v1(text, integer, integer) to anon;
grant execute on function public.guitarhana_submit_application_v1(text, text, text, text, text[]) to anon;
grant execute on function public.guitarhana_lookup_application_v1(text) to anon;
grant execute on function public.guitarhana_admin_applicants_v1(text, integer, integer) to anon;

notify pgrst, 'reload schema';
commit;

