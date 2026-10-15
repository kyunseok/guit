begin;

alter table public.applicants enable row level security;
alter table public.interview_slots enable row level security;

grant usage on schema public to anon;
grant select on table public.applicants to anon;
grant select on table public.interview_slots to anon;

do $$
begin
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applicants' and policyname = 'guitarhana_pages_public_read_v1') then
        create policy guitarhana_pages_public_read_v1 on public.applicants for select to anon using (true);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interview_slots' and policyname = 'guitarhana_pages_public_read_v1') then
        create policy guitarhana_pages_public_read_v1 on public.interview_slots for select to anon using (true);
    end if;
end;
$$;

create or replace function public.guitarhana_submit_application_v1(
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

revoke all on function public.guitarhana_submit_application_v1(text, text, text, text, text[]) from public;
grant execute on function public.guitarhana_submit_application_v1(text, text, text, text, text[]) to anon;

notify pgrst, 'reload schema';
commit;
