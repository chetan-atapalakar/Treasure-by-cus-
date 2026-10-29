-- CüS Treasure — migration 0001: core schema + Row Level Security.
-- Money is stored as integer paise (₹1 = 100 paise). Never floats.

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  currency char(3) not null default 'INR',
  locale text not null default 'en-IN',
  marketing_consent boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- financial_accounts ----------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('cash', 'bank', 'card', 'wallet', 'investment', 'loan')),
  opening_balance_paise bigint not null default 0,
  currency char(3) not null default 'INR',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- ---------- categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name, kind)
);

-- ---------- transactions ----------
-- 'transfer' rows move money between the user's own accounts and are
-- excluded from income/expense totals, so they are never double-counted.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_paise bigint not null check (amount_paise > 0),
  occurred_on date not null,
  description text not null check (char_length(description) between 1 and 200),
  merchant text check (merchant is null or char_length(merchant) <= 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  tags text[] not null default '{}',
  transfer_group_id uuid,
  source text not null default 'user_entered' check (source in ('user_entered', 'imported', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite FKs: a transaction can only reference the SAME user's account/category.
  foreign key (account_id, user_id) references public.financial_accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_account_idx on public.transactions (user_id, account_id);
create index transactions_user_category_idx on public.transactions (user_id, category_id);

-- ---------- budgets ----------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid, -- null = overall budget
  period text not null check (period in ('monthly', 'custom')),
  starts_on date not null,
  ends_on date,
  amount_paise bigint not null check (amount_paise > 0),
  alert_threshold_pct int not null default 80 check (alert_threshold_pct between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period = 'monthly' or ends_on is not null),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ---------- financial_goals + contributions ----------
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_paise bigint not null check (target_paise > 0),
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  contributed_on date not null,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.financial_goals (id, user_id) on delete cascade
);

create index goal_contributions_goal_idx on public.goal_contributions (user_id, goal_id);

-- ---------- notifications (created server-side; users read and mark read) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  deep_link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Deduplication: the same event can only notify a user once.
create unique index notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'financial_accounts', 'categories', 'transactions', 'budgets', 'financial_goals'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- No insert/delete policy: rows are created by the signup trigger and removed with the auth user.

do $$
declare t text;
begin
  foreach t in array array[
    'financial_accounts', 'categories', 'transactions', 'budgets',
    'financial_goals', 'goal_contributions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Users may only change read_at on notifications (everything else is server-controlled).
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Anonymous (signed-out) visitors get no access to any of these tables.
revoke all on
  public.profiles, public.financial_accounts, public.categories, public.transactions,
  public.budgets, public.financial_goals, public.goal_contributions, public.notifications
from anon;