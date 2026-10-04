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

-- Owner/admin controls
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','owner','admin','compliance'));

alter table public.withdrawals add column if not exists eligible_at timestamptz;
alter table public.withdrawals add column if not exists payment_method text;
alter table public.withdrawals add column if not exists approved_by uuid references auth.users(id);
alter table public.withdrawals add column if not exists approved_at timestamptz;
alter table public.withdrawals add column if not exists paid_by uuid references auth.users(id);
alter table public.withdrawals add column if not exists paid_at timestamptz;
alter table public.withdrawals add column if not exists payout_reference text;
alter table public.withdrawals add column if not exists rejection_reason text;

create or replace function public.is_staff(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id=p_user_id and role in ('owner','admin','compliance'));
$$;

create or replace function public.is_owner(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id=p_user_id and role='owner');
$$;

alter table public.withdrawals enable row level security;
alter table public.payments enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_log enable row level security;
alter table public.login_challenges enable row level security;

-- Members may see only their own financial records. Staff access is server/RLS controlled.
drop policy if exists "members read own withdrawals" on public.withdrawals;
create policy "members read own withdrawals" on public.withdrawals
  for select to authenticated using (user_id=auth.uid());

drop policy if exists "members read own payments" on public.payments;
create policy "members read own payments" on public.payments
  for select to authenticated using (user_id=auth.uid());

drop policy if exists "members read own wallet" on public.wallets;
create policy "members read own wallet" on public.wallets
  for select to authenticated using (user_id=auth.uid());

drop policy if exists "members read own ledger" on public.ledger_entries;
create policy "members read own ledger" on public.ledger_entries
  for select to authenticated using (user_id=auth.uid());

-- Staff read policies. Sensitive KYC documents should still be served through a
-- protected function/storage policy rather than exposing raw storage paths to members.
drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff read kyc" on public.kyc_documents;
create policy "staff read kyc" on public.kyc_documents
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff read withdrawals" on public.withdrawals;
create policy "staff read withdrawals" on public.withdrawals
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff read payments" on public.payments;
create policy "staff read payments" on public.payments
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff read wallets" on public.wallets;
create policy "staff read wallets" on public.wallets
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff read ledger" on public.ledger_entries;
create policy "staff read ledger" on public.ledger_entries
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff read audit" on public.audit_log;
create policy "staff read audit" on public.audit_log
  for select to authenticated using (public.is_staff(auth.uid()));

-- Protected KYC approval. Never let the browser directly set kyc_status.
create or replace function public.admin_approve_kyc(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.kyc_documents%rowtype;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  select * into d from public.kyc_documents where id=p_document_id for update;
  if d.id is null then raise exception 'KYC document not found'; end if;
  update public.kyc_documents set status='approved', reviewed_by=auth.uid(), reviewed_at=now(), rejection_reason=null where id=d.id;
  update public.profiles set kyc_status='verified', verified_at=now(), kyc_rejection_reason=null, updated_at=now() where id=d.user_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'kyc_approved','kyc_document',d.id::text,jsonb_build_object('user_id',d.user_id));
end;
$$;

create or replace function public.admin_reject_kyc(p_document_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.kyc_documents%rowtype;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  select * into d from public.kyc_documents where id=p_document_id for update;
  if d.id is null then raise exception 'KYC document not found'; end if;
  update public.kyc_documents set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), rejection_reason=coalesce(nullif(trim(p_reason),''),'Rejected') where id=d.id;
  update public.profiles set kyc_status='rejected', kyc_rejection_reason=coalesce(nullif(trim(p_reason),''),'Rejected'), updated_at=now() where id=d.user_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'kyc_rejected','kyc_document',d.id::text,jsonb_build_object('user_id',d.user_id,'reason',p_reason));
end;
$$;

-- Approve only an eligible withdrawal. The actual money movement should then
-- be performed by a trusted payout provider/Edge Function, not by browser code.
create or replace function public.admin_approve_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare w public.withdrawals%rowtype;
begin
  if not public.is_owner(auth.uid()) then raise exception 'Owner authorisation required'; end if;
  select * into w from public.withdrawals where id=p_withdrawal_id for update;
  if w.id is null then raise exception 'Withdrawal not found'; end if;
  if w.status <> 'requested' then raise exception 'Withdrawal is not awaiting approval'; end if;
  if w.eligible_at is null or now() < w.eligible_at then raise exception 'Withdrawal is not yet eligible'; end if;
  update public.withdrawals set status='approved', approved_by=auth.uid(), approved_at=now(), updated_at=now() where id=w.id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'withdrawal_approved','withdrawal',w.id::text,jsonb_build_object('user_id',w.user_id,'amount',w.amount));
end;
$$;

create or replace function public.admin_mark_withdrawal_paid(p_withdrawal_id uuid,p_payout_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare w public.withdrawals%rowtype;
begin
  if not public.is_owner(auth.uid()) then raise exception 'Owner authorisation required'; end if;
  select * into w from public.withdrawals where id=p_withdrawal_id for update;
  if w.id is null then raise exception 'Withdrawal not found'; end if;
  if w.status not in ('approved','processing') then raise exception 'Withdrawal is not ready to be recorded as paid'; end if;
  if nullif(trim(p_payout_reference),'') is null then raise exception 'Payout reference required'; end if;
  update public.withdrawals set status='paid', paid_by=auth.uid(), paid_at=now(), payout_reference=trim(p_payout_reference), updated_at=now() where id=w.id;
  insert into public.ledger_entries(user_id,type,amount,currency,status,external_reference,description) values(w.user_id,'withdrawal',-abs(w.amount),'ZAR','completed',trim(p_payout_reference),'Owner-recorded payout after authorised settlement');
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'withdrawal_paid','withdrawal',w.id::text,jsonb_build_object('user_id',w.user_id,'amount',w.amount,'payout_reference',p_payout_reference));
end;
$$;

-- Grant only the function execution to authenticated users; the functions
-- themselves enforce owner/staff authorisation.
grant execute on function public.admin_approve_kyc(uuid) to authenticated;
grant execute on function public.admin_reject_kyc(uuid,text) to authenticated;
grant execute on function public.admin_approve_withdrawal(uuid) to authenticated;
grant execute on function public.admin_mark_withdrawal_paid(uuid,text) to authenticated;

-- Replace the broad profile-update policy: members must not be able to edit
-- their role, KYC status, verification timestamps or other privileged fields.
drop policy if exists "members update own profile" on public.profiles;
create or replace function public.member_update_profile(
  p_full_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_profile_picture_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set full_name=p_full_name,
      phone=p_phone,
      email=p_email,
      address=p_address,
      profile_picture_url=coalesce(p_profile_picture_url,profile_picture_url),
      updated_at=now()
  where id=auth.uid();
  if not found then raise exception 'Profile not found'; end if;
end;
$$;
grant execute on function public.member_update_profile(text,text,text,text,text) to authenticated;

-- Admin accounting and account-maintenance workflows.
-- These functions keep sensitive balance/payment mutations out of browser SQL.
create or replace function public.admin_update_member_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_email text
) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  update public.profiles set full_name=nullif(trim(p_full_name),''), phone=nullif(trim(p_phone),''), email=nullif(trim(p_email),''), updated_at=now() where id=p_user_id;
  if not found then raise exception 'Member not found'; end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'member_profile_updated','profile',p_user_id::text,jsonb_build_object('fields',jsonb_build_array('full_name','phone','email')));
end; $$;

grant execute on function public.admin_update_member_profile(uuid,text,text,text) to authenticated;

create or replace function public.admin_adjust_balance(
  p_user_id uuid,
  p_amount numeric,
  p_reason text,
  p_reference text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare w public.wallets%rowtype; new_balance numeric;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  if p_amount=0 then raise exception 'Adjustment cannot be zero'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reason is required'; end if;
  select * into w from public.wallets where user_id=p_user_id for update;
  if w.user_id is null then raise exception 'Wallet not found'; end if;
  new_balance:=w.available_balance+p_amount;
  if new_balance < 0 then raise exception 'Adjustment would make the available balance negative'; end if;
  update public.wallets set available_balance=new_balance, updated_at=now() where user_id=p_user_id;
  insert into public.ledger_entries(user_id,type,amount,currency,status,external_reference,description)
    values(p_user_id,'adjustment',p_amount,w.currency,'completed',nullif(trim(p_reference),''),trim(p_reason));
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'balance_adjusted','wallet',p_user_id::text,jsonb_build_object('amount',p_amount,'reason',p_reason,'reference',p_reference,'new_balance',new_balance));
end; $$;

grant execute on function public.admin_adjust_balance(uuid,numeric,text,text) to authenticated;

create or replace function public.admin_confirm_payment_received(
  p_payment_id uuid,
  p_external_reference text
) returns void
language plpgsql security definer set search_path=public as $$
declare p public.payments%rowtype; w public.wallets%rowtype;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  if nullif(trim(p_external_reference),'') is null then raise exception 'Bank reference is required'; end if;
  select * into p from public.payments where id=p_payment_id for update;
  if p.id is null then raise exception 'Payment not found'; end if;
  if p.status not in ('pending','submitted') then raise exception 'Payment is not awaiting confirmation'; end if;
  select * into w from public.wallets where user_id=p.user_id for update;
  if w.user_id is null then raise exception 'Wallet not found'; end if;
  update public.payments set status='received', external_reference=trim(p_external_reference), updated_at=now() where id=p.id;
  update public.wallets set available_balance=available_balance+p.amount, updated_at=now() where user_id=p.user_id;
  insert into public.ledger_entries(user_id,type,amount,currency,status,external_reference,provider,description)
    values(p.user_id,'contribution',abs(p.amount),p.currency,'completed',trim(p_external_reference),p.provider,'Admin-confirmed bank payment received');
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'payment_received','payment',p.id::text,jsonb_build_object('user_id',p.user_id,'amount',p.amount,'reference',p_external_reference));
end; $$;

grant execute on function public.admin_confirm_payment_received(uuid,text) to authenticated;

create or replace function public.admin_record_bank_transfer(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if nullif(trim(p_reference),'') is null then raise exception 'Bank reference is required'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Member not found'; end if;
  insert into public.payments(user_id,provider,method,external_reference,amount,currency,status,raw_event)
    values(p_user_id,'TymeBank','bank_transfer',trim(p_reference),p_amount,'ZAR','received',jsonb_build_object('recorded_by',auth.uid(),'source','admin_console')) returning id into pid;
  insert into public.wallets(user_id,available_balance,pending_balance,currency) values(p_user_id,p_amount,0,'ZAR')
    on conflict(user_id) do update set available_balance=public.wallets.available_balance+excluded.available_balance,updated_at=now();
  insert into public.ledger_entries(user_id,type,amount,currency,status,external_reference,provider,description)
    values(p_user_id,'contribution',p_amount,'ZAR','completed',trim(p_reference),'TymeBank','Admin-recorded bank transfer received');
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'bank_transfer_recorded','payment',pid::text,jsonb_build_object('user_id',p_user_id,'amount',p_amount,'reference',p_reference));
  return pid;
end; $$;

grant execute on function public.admin_record_bank_transfer(uuid,numeric,text) to authenticated;
