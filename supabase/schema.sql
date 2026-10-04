-- Capital Crew production database starter
-- Run in Supabase SQL Editor after reviewing with your developer/legal team.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  address text,
  kyc_status text not null default 'unverified' check (kyc_status in ('unverified','pending','verified','rejected')),
  kyc_rejection_reason text,
  verified_at timestamptz,
  profile_picture_url text,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_balance numeric(14,2) not null default 0,
  pending_balance numeric(14,2) not null default 0,
  currency text not null default 'ZAR',
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  type text not null check (type in ('contribution','allocation','earning','withdrawal','refund','fee','adjustment')),
  amount numeric(14,2) not null,
  currency text not null default 'ZAR',
  status text not null default 'pending',
  external_reference text,
  provider text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  provider text not null,
  method text not null,
  external_reference text,
  amount numeric(14,2) not null,
  currency text not null default 'ZAR',
  status text not null default 'pending',
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  amount numeric(14,2) not null,
  status text not null default 'requested',
  bank_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- IMPORTANT:
-- Enable Row Level Security and write restrictive policies.
-- Never allow a browser client to INSERT wallet balances or mark payments as completed.
-- Only trusted server-side functions/webhooks should post confirmed payment ledger entries.


-- Identity-verification submissions. Keep this table private; members should only
-- see their own submissions and staff/service-role should perform approvals.
create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists kyc_documents_user_idx on public.kyc_documents(user_id);
create index if not exists kyc_documents_status_idx on public.kyc_documents(status);
-- One-time login confirmation challenges. In production, create these server-side
-- and deliver the code through a verified email/SMS provider. Never expose the
-- stored code to the browser or store plaintext passwords in localStorage.
create table if not exists public.login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  channel text not null check (channel in ('email','sms')),
  destination_hint text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists login_challenges_user_idx on public.login_challenges(user_id, created_at desc);


-- Server-side deposit gate. Payment creation must call this check before
-- creating any pending payment session.
create or replace function public.user_can_deposit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and kyc_status = 'verified'
  );
$$;

-- Recommended RLS baseline. Review these policies with the final auth/RBAC design.
alter table public.profiles enable row level security;
alter table public.kyc_documents enable row level security;

drop policy if exists "members read own profile" on public.profiles;
create policy "members read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members read own kyc documents" on public.kyc_documents;
create policy "members read own kyc documents" on public.kyc_documents
  for select to authenticated using (user_id = auth.uid());

-- Do NOT give normal members permission to set profiles.kyc_status to
-- 'verified'. Approval must happen through a protected staff workflow or
-- service-role Edge Function.


-- ============================================================
-- CAPITAL CREW ADMIN / STAFF RBAC
-- ============================================================
create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','finance','compliance','support')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists staff_roles_role_idx on public.staff_roles(role, active);

alter table public.staff_roles enable row level security;

create or replace function public.is_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = coalesce(p_user_id, auth.uid())
      and active = true
  );
$$;

create or replace function public.has_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = coalesce(p_user_id, auth.uid())
      and role = p_role
      and active = true
  );
$$;

drop policy if exists "staff read own role" on public.staff_roles;
create policy "staff read own role" on public.staff_roles
  for select to authenticated using (user_id = auth.uid());

-- Staff can monitor operational data; members retain access only to their own
-- profile/KYC records. Financial state must still be changed through trusted
-- server-side payment/webhook/RPC workflows.
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;
alter table public.withdrawals enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "members read own wallet" on public.wallets;
create policy "members read own wallet" on public.wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "staff read wallets" on public.wallets;
create policy "staff read wallets" on public.wallets
  for select to authenticated using (public.is_staff());

drop policy if exists "members read own ledger" on public.ledger_entries;
create policy "members read own ledger" on public.ledger_entries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "staff read ledger" on public.ledger_entries;
create policy "staff read ledger" on public.ledger_entries
  for select to authenticated using (public.is_staff());

drop policy if exists "members read own payments" on public.payments;
create policy "members read own payments" on public.payments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "staff read payments" on public.payments;
create policy "staff read payments" on public.payments
  for select to authenticated using (public.is_staff());

drop policy if exists "members read own withdrawals" on public.withdrawals;
create policy "members read own withdrawals" on public.withdrawals
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "staff read withdrawals" on public.withdrawals;
create policy "staff read withdrawals" on public.withdrawals
  for select to authenticated using (public.is_staff());

drop policy if exists "staff read audit log" on public.audit_log;
create policy "staff read audit log" on public.audit_log
  for select to authenticated using (public.is_staff());

drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "staff update profiles" on public.profiles;
create policy "staff update profiles" on public.profiles
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff read kyc documents" on public.kyc_documents;
create policy "staff read kyc documents" on public.kyc_documents
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

drop policy if exists "staff update kyc documents" on public.kyc_documents;
create policy "staff update kyc documents" on public.kyc_documents
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- KYC review helper. It updates both the submission and profile and records
-- who performed the review. This does not credit funds or alter wallets.
create or replace function public.review_kyc(
  p_document_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'invalid KYC decision';
  end if;

  select user_id into v_user
  from public.kyc_documents
  where id = p_document_id
  for update;

  if v_user is null then
    raise exception 'KYC document not found';
  end if;

  update public.kyc_documents
    set status = p_decision,
        rejection_reason = case when p_decision = 'rejected' then p_reason else null end,
        reviewed_by = auth.uid(),
        reviewed_at = now()
  where id = p_document_id;

  update public.profiles
    set kyc_status = case when p_decision = 'approved' then 'verified' else 'rejected' end,
        kyc_rejection_reason = case when p_decision = 'rejected' then p_reason else null end,
        verified_at = case when p_decision = 'approved' then now() else null end,
        updated_at = now()
  where id = v_user;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when p_decision = 'approved' then 'kyc_approved' else 'kyc_rejected' end,
    'kyc_document',
    p_document_id::text,
    jsonb_build_object('user_id', v_user, 'reason', p_reason)
  );
end;
$$;

-- Staff can approve/reject withdrawal requests, but actual payment execution
-- should be performed by a trusted server/provider integration and then
-- reconciled back into the ledger.
create or replace function public.review_withdrawal(
  p_withdrawal_id uuid,
  p_decision text,
  p_bank_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff access required';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'invalid withdrawal decision';
  end if;

  update public.withdrawals
    set status = p_decision,
        bank_reference = case when p_decision = 'approved' then p_bank_reference else bank_reference end,
        updated_at = now()
  where id = p_withdrawal_id
    and status = 'requested';

  if not found then
    raise exception 'withdrawal is missing or no longer pending';
  end if;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'withdrawal_' || p_decision,
    'withdrawal',
    p_withdrawal_id::text,
    jsonb_build_object('bank_reference', p_bank_reference)
  );
end;
$$;

grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.has_role(text, uuid) to authenticated;
grant execute on function public.review_kyc(uuid, text, text) to authenticated;
grant execute on function public.review_withdrawal(uuid, text, text) to authenticated;
