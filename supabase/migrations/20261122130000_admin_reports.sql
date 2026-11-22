-- Admin reports brought over from MK Gadgets (2026-11-22):
-- Live shoppers, End of Day, Products sold, Expenses and Profit margins.
-- The tables are read and written only by the server (service role), so
-- row level security is on with no policies for the public keys.

begin;

-- ── Tables ──────────────────────────────────────────────────────────────
create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  supplier_name text,
  cost_price numeric not null check (cost_price >= 0),
  notes text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  visitor_id text primary key,
  page text not null,
  stage text not null,
  cart_items integer not null default 0,
  cart_value numeric not null default 0,
  last_seen timestamptz not null default now()
);
create index if not exists live_sessions_last_seen_idx on public.live_sessions (last_seen);

create table if not exists public.site_visits (
  id bigserial primary key,
  visitor_id text not null,
  visited_at timestamptz not null default now()
);
create index if not exists site_visits_day_idx on public.site_visits (visited_at, visitor_id);

create table if not exists public.staff_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  staff_name text,
  staff_email text,
  amount numeric not null check (amount >= 0),
  description text not null,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists staff_expenses_spent_on_idx on public.staff_expenses (spent_on desc, created_at desc);

alter table public.product_costs enable row level security;
alter table public.live_sessions enable row level security;
alter table public.site_visits enable row level security;
alter table public.staff_expenses enable row level security;
revoke all on public.product_costs, public.live_sessions, public.site_visits, public.staff_expenses from anon, authenticated;
grant all on public.product_costs, public.live_sessions, public.site_visits, public.staff_expenses to service_role;
grant usage, select on sequence public.site_visits_id_seq to service_role;

-- ── Live shoppers ───────────────────────────────────────────────────────
create or replace function public.admin_live_ping(p_visitor text, p_page text, p_stage text, p_items integer, p_value numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into live_sessions (visitor_id, page, stage, cart_items, cart_value, last_seen)
  values (p_visitor, p_page, p_stage, p_items, p_value, now())
  on conflict (visitor_id) do update
    set page = excluded.page, stage = excluded.stage, cart_items = excluded.cart_items,
        cart_value = excluded.cart_value, last_seen = now();

  insert into site_visits (visitor_id)
  select p_visitor
   where not exists (
     select 1 from site_visits
      where visitor_id = p_visitor
        and visited_at >= date_trunc('day', now() at time zone 'Africa/Accra') at time zone 'Africa/Accra'
   );

  if random() < 0.02 then
    delete from live_sessions where last_seen < now() - interval '1 day';
  end if;
end;
$$;

create or replace function public.admin_live_summary(p_window_seconds integer default 90)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with today as (
    select date_trunc('day', now() at time zone 'Africa/Accra') at time zone 'Africa/Accra' as start
  )
  select jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(s order by s.last_seen desc)
        from (select visitor_id, page, stage, cart_items, cart_value, last_seen
                from live_sessions
               where last_seen > now() - make_interval(secs => p_window_seconds)
               order by last_seen desc
               limit 300) s), '[]'::jsonb),
    'visitors', (select count(distinct visitor_id) from site_visits, today where visited_at >= today.start),
    'web_orders', (select count(*) from orders, today
                    where payment_status = 'paid' and coalesce(metadata->>'pos_sale', '') <> 'true'
                      and status not in ('cancelled', 'refunded') and created_at >= today.start),
    'web_revenue', (select coalesce(sum(total), 0) from orders, today
                     where payment_status = 'paid' and coalesce(metadata->>'pos_sale', '') <> 'true'
                       and status not in ('cancelled', 'refunded') and created_at >= today.start)
  );
$$;

-- ── Products sold / sales totals ────────────────────────────────────────
-- A sale counts once it is paid and has not been cancelled or refunded.
create or replace function public.admin_sales_totals(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'revenue', coalesce(sum(o.total), 0),
    'orders', count(*),
    'itemsSold', coalesce(sum(i.qty), 0),
    'itemsRevenue', coalesce(sum(i.amount), 0)
  )
    from orders o
    left join (select order_id, sum(quantity) as qty, sum(total_price) as amount from order_items group by order_id) i
      on i.order_id = o.id
   where o.payment_status = 'paid' and o.status not in ('cancelled', 'refunded')
     and (p_from is null or o.created_at >= p_from) and (p_to is null or o.created_at < p_to);
$$;

create or replace function public.admin_sold_by_product(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(r order by r.revenue desc, r.name asc), '[]'::jsonb)
    from (
      select coalesce(oi.product_id::text, 'name:' || oi.product_name) as key,
             max(oi.product_id::text) as "productId",
             coalesce(max(p.name), max(oi.product_name), 'Unnamed product') as name,
             coalesce(max(p.sku), max(oi.sku)) as sku,
             max(c.name) as category,
             coalesce(sum(oi.quantity), 0)::int as "unitsSold",
             count(distinct oi.order_id)::int as orders,
             coalesce(sum(oi.total_price), 0)::float as revenue
        from order_items oi
        join orders o on o.id = oi.order_id
        left join products p on p.id = oi.product_id
        left join categories c on c.id = p.category_id
       where o.payment_status = 'paid' and o.status not in ('cancelled', 'refunded')
         and (p_from is null or o.created_at >= p_from) and (p_to is null or o.created_at < p_to)
       group by 1
    ) r;
$$;

-- ── Profit margins ──────────────────────────────────────────────────────
create or replace function public.admin_profit_products()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(r order by r.name), '[]'::jsonb)
    from (
      select p.id, p.name, p.sku, p.status::text as status, p.price::float as price,
             p.compare_at_price::float as compare_at_price, p.quantity, c.name as category,
             (select url from product_images pi where pi.product_id = p.id order by position nulls last limit 1) as image,
             (select min(v.price)::float from product_variants v where v.product_id = p.id and v.price > 0) as min_variant_price,
             pc.cost_price::float as cost_price, pc.supplier_name, pc.notes, pc.updated_at as cost_updated_at,
             coalesce(sold.units, 0)::int as units_sold_30d
        from products p
        left join categories c on c.id = p.category_id
        left join product_costs pc on pc.product_id = p.id
        left join (
          select oi.product_id, sum(oi.quantity) as units
            from order_items oi join orders o on o.id = oi.order_id
           where o.payment_status = 'paid' and o.status not in ('cancelled', 'refunded')
             and o.created_at > now() - interval '30 days'
           group by oi.product_id
        ) sold on sold.product_id = p.id
       where p.status::text <> 'archived'
    ) r;
$$;

-- ── End of Day ──────────────────────────────────────────────────────────
-- Accra is UTC+0 all year, so a calendar day is a plain UTC range.
create or replace function public.admin_end_of_day(p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  d_start timestamptz := (p_day::text || 'T00:00:00Z')::timestamptz;
  d_end timestamptz := (p_day::text || 'T23:59:59.999Z')::timestamptz;
  result jsonb;
begin
  with o as (
    select *,
           coalesce(metadata->>'pos_sale', '') = 'true' as is_pos,
           status in ('cancelled', 'refunded') as is_closed,
           payment_status = 'paid' and status not in ('cancelled', 'refunded') as is_sold
      from orders
     where created_at between d_start and d_end
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'paid_orders', count(*) filter (where is_sold),
        'unpaid_orders', count(*) filter (where payment_status <> 'paid' and not is_closed),
        'cancelled_orders', count(*) filter (where is_closed),
        'cancelled_paid_orders', count(*) filter (where payment_status = 'paid' and is_closed),
        'cancelled_paid_value', coalesce(sum(total) filter (where payment_status = 'paid' and is_closed), 0),
        'pos_orders', count(*) filter (where is_sold and is_pos),
        'web_orders', count(*) filter (where is_sold and not is_pos),
        'revenue', coalesce(sum(total) filter (where is_sold), 0),
        'pos_revenue', coalesce(sum(total) filter (where is_sold and is_pos), 0),
        'web_revenue', coalesce(sum(total) filter (where is_sold and not is_pos), 0),
        'discounts', coalesce(sum(discount_total) filter (where is_sold), 0),
        'to_fulfil', count(*) filter (where is_sold and status::text not in ('shipped', 'delivered'))
      ) from o
    ),
    'payments', coalesce((
      select jsonb_agg(x order by x.revenue desc) from (
        select coalesce(nullif(payment_method, ''), 'other') as method,
               case when is_pos then 'POS' else 'Website' end as channel,
               count(*)::int as orders,
               coalesce(sum(total), 0)::float as revenue
          from o where is_sold group by 1, 2
      ) x), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(x order by x.revenue desc) from (
        select oi.product_id,
               coalesce(p.name, oi.product_name, 'Unknown item') as name,
               sum(oi.quantity)::int as units,
               coalesce(sum(oi.quantity) filter (where o.is_pos), 0)::int as pos_units,
               coalesce(sum(oi.quantity) filter (where not o.is_pos), 0)::int as web_units,
               coalesce(sum(oi.total_price), 0)::float as revenue,
               p.quantity::int as stock_left,
               coalesce(pc.cost_price, p.cost_per_item)::float as unit_cost
          from order_items oi
          join o on o.id = oi.order_id
          left join products p on p.id = oi.product_id
          left join product_costs pc on pc.product_id = oi.product_id
         where o.is_sold
         group by oi.product_id, coalesce(p.name, oi.product_name, 'Unknown item'), p.quantity, pc.cost_price, p.cost_per_item
         limit 200
      ) x), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(x order by x.revenue desc) from (
        select coalesce(nullif(coalesce(o.metadata->>'sold_by_name', o.metadata->>'cashier'), ''), 'Unassigned') as name,
               count(*)::int as orders,
               coalesce(sum(o.total), 0)::float as revenue,
               coalesce(sum(u.qty), 0)::int as units
          from o
          left join (select order_id, sum(quantity) as qty from order_items group by order_id) u on u.order_id = o.id
         where o.is_sold and o.is_pos
         group by 1
      ) x), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select id, order_number, total::float as total, payment_status, payment_method, status, created_at,
               coalesce(metadata->>'sold_by_name', metadata->>'cashier') as staff_name,
               case when is_pos then 'POS' else 'Website' end as channel,
               trim(coalesce(metadata->>'first_name', '') || ' ' || coalesce(metadata->>'last_name', '')) as customer
          from o order by created_at desc limit 300
      ) x), '[]'::jsonb),
    'prior', (
      select jsonb_build_object(
        'yesterday', coalesce(sum(total) filter (where created_at >= (p_day - 1) and created_at < p_day), 0),
        'last_week', coalesce(sum(total) filter (where created_at >= (p_day - 7) and created_at < (p_day - 6)), 0)
      )
        from orders
       where payment_status = 'paid' and status not in ('cancelled', 'refunded')
         and created_at >= (p_day - 7) and created_at < p_day
    )
  ) into result;
  return result;
end;
$$;

-- Server only
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in (
              'admin_live_ping', 'admin_live_summary', 'admin_sales_totals',
              'admin_sold_by_product', 'admin_profit_products', 'admin_end_of_day')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
