-- CüS Treasure — migration 0002: server-side totals.
-- security invoker: Row Level Security still applies, so each user only ever
-- aggregates their own rows. Transfers are excluded so they are never counted
-- as income or expense.

create or replace function public.period_summary(
  p_start date,
  p_end date,
  p_bucket text default 'day'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with t as (
    select tx.type, tx.amount_paise, tx.occurred_on, tx.category_id, tx.user_id
    from public.transactions tx
    where tx.occurred_on between p_start and p_end
      and tx.type in ('income', 'expense')
  ),
  totals as (
    select
      coalesce(sum(amount_paise) filter (where type = 'income'), 0)::bigint as income,
      coalesce(sum(amount_paise) filter (where type = 'expense'), 0)::bigint as expense,
      count(*)::bigint as n
    from t
  ),
  cats as (
    select coalesce(c.name, 'Uncategorised') as name, sum(t.amount_paise)::bigint as paise
    from t
    left join public.categories c on c.id = t.category_id and c.user_id = t.user_id
    where t.type = 'expense'
    group by coalesce(c.name, 'Uncategorised')
  ),
  buckets as (
    select
      case when p_bucket = 'month'
        then date_trunc('month', t.occurred_on::timestamp)::date
        else t.occurred_on
      end as b,
      coalesce(sum(t.amount_paise) filter (where t.type = 'income'), 0)::bigint as income,
      coalesce(sum(t.amount_paise) filter (where t.type = 'expense'), 0)::bigint as expense
    from t
    group by 1
  )
  select jsonb_build_object(
    'income', (select income from totals),
    'expense', (select expense from totals),
    'count', (select n from totals),
    'categories', coalesce(
      (select jsonb_agg(jsonb_build_object('name', name, 'paise', paise) order by paise desc) from cats),
      '[]'::jsonb),
    'buckets', coalesce(
      (select jsonb_agg(
         jsonb_build_object('day', to_char(b, 'YYYY-MM-DD'), 'income', income, 'expense', expense)
         order by b) from buckets),
      '[]'::jsonb)
  );
$$;

create or replace function public.account_balances()
returns table (account_id uuid, income_paise bigint, expense_paise bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    tx.account_id,
    coalesce(sum(tx.amount_paise) filter (where tx.type = 'income'), 0)::bigint,
    coalesce(sum(tx.amount_paise) filter (where tx.type = 'expense'), 0)::bigint
  from public.transactions tx
  group by tx.account_id;
$$;

revoke all on function public.period_summary(date, date, text) from public, anon;
grant execute on function public.period_summary(date, date, text) to authenticated;
revoke all on function public.account_balances() from public, anon;
grant execute on function public.account_balances() to authenticated;