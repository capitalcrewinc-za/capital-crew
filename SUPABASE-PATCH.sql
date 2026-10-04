-- Run this AFTER the original supabase/schema.sql.
-- It creates a profile/wallet automatically when a new Supabase Auth user signs up.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), 'Member'),
    new.email
  )
  on conflict (id) do update set email=excluded.email, updated_at=now();

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Existing Auth users that were created before this trigger can be backfilled.
insert into public.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1), 'Member'), email
from auth.users
on conflict (id) do nothing;

insert into public.wallets (user_id)
select id from public.profiles
on conflict (user_id) do nothing;
