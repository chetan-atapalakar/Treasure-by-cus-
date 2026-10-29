-- CüS Treasure — migration 0004: calendar, billing, AI usage, referrals, admin.

-- ---------- calendar ----------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('bill','emi','card_payment','subscription','sip','fd_maturity','milestone','other')),
  due_on date not null,
  amount_paise bigint check (amount_paise is null or amount_paise > 0),
  recurrence text not null default 'none' check (recurrence in ('none','monthly','yearly')),
  status text not null default 'scheduled' check (status in ('scheduled','completed','skipped')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_user_due_idx on public.calendar_events (user_id, due_on);
create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
create policy calendar_events_select_own on public.calendar_events for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_events_insert_own on public.calendar_events for insert to authenticated with check (user_id = (select auth.uid()));
create policy calendar_events_update_own on public.calendar_events for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy calendar_events_delete_own on public.calendar_events for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.calendar_events from anon;

-- ---------- subscriptions (written ONLY by the verified payment webhook) ----------
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  status text not null default 'inactive' check (status in ('inactive','active','past_due','cancelled','expired')),
  current_period_end timestamptz,
  provider text,
  provider_subscription_id text unique,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

-- Idempotency log: a provider event id can only be processed once.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

-- ---------- AI usage limits ----------
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_select_own on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

-- Atomically counts one request; returns false when the daily limit is reached.
create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  insert into public.ai_usage (user_id, day, requests) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set requests = public.ai_usage.requests + 1
    where public.ai_usage.requests < p_limit
  returning requests into n;
  return n is not null;
end;
$$;
revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;

-- ---------- referrals ----------
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  reward_paise bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
create policy referral_codes_select_own on public.referral_codes for select to authenticated using (user_id = (select auth.uid()));
create policy referrals_select_own on public.referrals for select to authenticated using (referrer_id = (select auth.uid()));
revoke all on public.referral_codes, public.referrals from anon;
revoke insert, update, delete on public.referral_codes, public.referrals from authenticated;

create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); c text;
begin
  if uid is null then raise exception 'referral: Please sign in.'; end if;
  select code into c from public.referral_codes where user_id = uid;
  if c is not null then return c; end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    begin
      insert into public.referral_codes (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      select code into c from public.referral_codes where user_id = uid;
      if c is not null then return c; end if;
    end;
  end loop;
end;
$$;

create or replace function public.claim_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); ref uuid;
begin
  if uid is null then raise exception 'referral: Please sign in.'; end if;
  select user_id into ref from public.referral_codes where code = upper(trim(p_code));
  if ref is null then raise exception 'referral: That code was not found.'; end if;
  if ref = uid then raise exception 'referral: You cannot use your own code.'; end if;
  if exists (select 1 from public.referrals where referred_user_id = uid) then
    raise exception 'referral: A referral code has already been applied to your account.';
  end if;
  insert into public.referrals (referrer_id, referred_user_id) values (ref, uid);
end;
$$;
revoke all on function public.get_or_create_referral_code() from public, anon;
grant execute on function public.get_or_create_referral_code() to authenticated;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- ---------- admin (aggregates only; no access to private transactions) ----------
create table public.admin_users (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.audit_logs (actor_id, action) values (auth.uid(), 'admin_metrics_viewed');
  return jsonb_build_object(
    'registered_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'active_users_30d', (select count(distinct user_id) from public.transactions where created_at >= now() - interval '30 days'),
    'premium_active', (select count(*) from public.subscriptions
                        where plan = 'premium' and status in ('active','cancelled') and current_period_end > now()),
    'ai_requests_today', coalesce((select sum(requests) from public.ai_usage where day = current_date), 0),
    'ai_requests_7d', coalesce((select sum(requests) from public.ai_usage where day >= current_date - 6), 0),
    'referrals_total', (select count(*) from public.referrals),
    'referrals_pending', (select count(*) from public.referrals where status = 'pending'),
    'generated_at', now()
  );
end;
$$;
revoke all on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;