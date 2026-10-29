-- CüS Treasure — migration 0003: budgets and goals support.

-- One monthly budget per category (or one overall monthly budget) per user.
create unique index if not exists budgets_monthly_unique
  on public.budgets (user_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where period = 'monthly';

-- Spending against each budget for its current window. RLS applies (security invoker).
create or replace function public.budget_progress()
returns table (budget_id uuid, window_start date, window_end date, spent_paise bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    b.id,
    w.ws,
    w.we,
    coalesce((
      select sum(t.amount_paise)
      from public.transactions t
      where t.type = 'expense'
        and t.occurred_on between w.ws and w.we
        and (b.category_id is null or t.category_id = b.category_id)
    ), 0)::bigint
  from public.budgets b
  cross join lateral (
    select
      case when b.period = 'monthly'
        then date_trunc('month', current_date)::date else b.starts_on end as ws,
      case when b.period = 'monthly'
        then (date_trunc('month', current_date) + interval '1 month - 1 day')::date else b.ends_on end as we
  ) w;
$$;

create or replace function public.goal_progress()
returns table (goal_id uuid, saved_paise bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, coalesce(sum(c.amount_paise), 0)::bigint
  from public.financial_goals g
  left join public.goal_contributions c on c.goal_id = g.id and c.user_id = g.user_id
  group by g.id;
$$;

-- Creates budget alert notifications for the CALLING user only.
-- security definer is required because users cannot insert notifications directly.
-- The unique dedupe_key means one event can only ever notify once.
create or replace function public.sync_budget_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inserted_total int := 0;
  inserted_now int := 0;
  r record;
  label text;
  level text;
  used_pct int;
begin
  if uid is null then
    return 0;
  end if;

  for r in
    select
      b.id,
      b.amount_paise,
      b.alert_threshold_pct,
      b.category_id,
      w.ws,
      coalesce((
        select sum(t.amount_paise)
        from public.transactions t
        where t.user_id = uid
          and t.type = 'expense'
          and t.occurred_on between w.ws and w.we
          and (b.category_id is null or t.category_id = b.category_id)
      ), 0)::bigint as spent
    from public.budgets b
    cross join lateral (
      select
        case when b.period = 'monthly'
          then date_trunc('month', current_date)::date else b.starts_on end as ws,
        case when b.period = 'monthly'
          then (date_trunc('month', current_date) + interval '1 month - 1 day')::date else b.ends_on end as we
    ) w
    where b.user_id = uid
      and current_date between w.ws and w.we
  loop
    if r.spent > r.amount_paise then
      level := 'exceeded';
    elsif r.spent * 100 >= r.amount_paise::numeric * r.alert_threshold_pct then
      level := 'threshold';
    else
      continue;
    end if;

    if r.category_id is null then
      label := 'overall spending';
    else
      select c.name into label from public.categories c where c.id = r.category_id and c.user_id = uid;
      label := coalesce(label, 'category');
    end if;

    used_pct := floor(r.spent * 100 / r.amount_paise);

    insert into public.notifications (user_id, type, title, body, deep_link, dedupe_key)
    values (
      uid,
      case when level = 'exceeded' then 'budget_exceeded' else 'budget_threshold' end,
      case when level = 'exceeded' then 'A budget has been passed' else 'A budget is nearly used' end,
      case when level = 'exceeded'
        then 'Spending has gone past your ' || label || ' budget (' || used_pct || '% used).'
        else 'You have used ' || used_pct || '% of your ' || label || ' budget.' end,
      '/budgets',
      'budget:' || r.id::text || ':' || r.ws::text || ':' || level
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    get diagnostics inserted_now = row_count;
    inserted_total := inserted_total + inserted_now;
  end loop;

  return inserted_total;
end;
$$;

revoke all on function public.budget_progress() from public, anon;
grant execute on function public.budget_progress() to authenticated;
revoke all on function public.goal_progress() from public, anon;
grant execute on function public.goal_progress() to authenticated;
revoke all on function public.sync_budget_alerts() from public, anon;
grant execute on function public.sync_budget_alerts() to authenticated;