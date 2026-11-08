-- Boli-Khata core schema (reviewed source; not yet applied to a hosted project).
-- Target: Supabase Postgres 17. Apply only to a dedicated Boli-Khata project after review.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now()
);

create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','admin','cashier','viewer')),
  status text not null default 'active' check (status in ('active','suspended','invited')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table private.business_onboarding_claims (
  actor_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  request_fingerprint text not null,
  business_id uuid references public.businesses(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (actor_id,idempotency_key)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  phone_e164 text,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  unit_label text not null default 'piece',
  unit_price_paise bigint not null check (unit_price_paise > 0),
  stock_on_hand numeric(14,3) not null default 0 check (stock_on_hand >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('credit_sale','payment','reversal')),
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null check (currency = 'INR'),
  payment_method text check (payment_method in ('cash','upi','bank','other')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  reversal_of uuid unique references public.business_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete restrict,
  unique (business_id, actor_id, idempotency_key),
  check ((transaction_type in ('credit_sale','payment') and reversal_of is null) or (transaction_type = 'reversal' and reversal_of is not null)),
  check ((transaction_type = 'payment' and payment_method is not null) or (transaction_type <> 'payment' and payment_method is null))
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  transaction_id uuid not null references public.business_transactions(id) on delete restrict,
  product_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_paise bigint not null check (unit_price_paise > 0),
  line_total_paise bigint not null check (line_total_paise > 0),
  foreign key (business_id, product_id) references public.products(business_id, id) on delete restrict
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null,
  transaction_id uuid not null unique references public.business_transactions(id) on delete restrict,
  entry_type text not null check (entry_type in ('credit_sale','sale_reversal','payment','payment_reversal')),
  amount_paise bigint not null check (amount_paise <> 0),
  currency text not null check (currency = 'INR'),
  created_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete restrict,
  check ((entry_type in ('credit_sale','payment_reversal') and amount_paise > 0) or (entry_type in ('sale_reversal','payment') and amount_paise < 0))
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  product_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  transaction_id uuid references public.business_transactions(id) on delete restrict,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reason text not null check (reason in ('opening_balance','credit_sale','reversal','stock_adjustment')),
  created_at timestamptz not null default now(),
  foreign key (business_id, product_id) references public.products(business_id, id) on delete restrict
);

create table public.idempotency_claims (
  business_id uuid not null references public.businesses(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  transaction_id uuid references public.business_transactions(id) on delete restrict,
  request_fingerprint text not null check (length(request_fingerprint) between 2 and 16000),
  created_at timestamptz not null default now(),
  primary key (business_id, actor_id, idempotency_key)
);

create index customers_business_name_idx on public.customers(business_id, display_name);
create index products_business_name_idx on public.products(business_id, name);
create index ledger_customer_created_idx on public.ledger_entries(business_id, customer_id, created_at desc);
create index inventory_product_created_idx on public.inventory_movements(business_id, product_id, created_at desc);

-- All exposed tables use RLS. Membership is resolved from the authenticated JWT subject,
-- never from user-editable user_metadata or a client-supplied role.
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.business_transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.idempotency_claims enable row level security;

create policy "members read their businesses" on public.businesses for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "users read own memberships" on public.business_memberships for select to authenticated
using (user_id = (select auth.uid()));
create policy "members read customers" on public.customers for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = customers.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read products" on public.products for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = products.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read transactions" on public.business_transactions for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = business_transactions.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read transaction items" on public.transaction_items for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = transaction_items.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read ledger" on public.ledger_entries for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = ledger_entries.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read inventory movements" on public.inventory_movements for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = inventory_movements.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "users read own idempotency claims" on public.idempotency_claims for select to authenticated
using (actor_id = (select auth.uid()));

-- New Supabase projects no longer auto-expose new tables. Grant read access explicitly;
-- there are intentionally no direct client write grants or write policies.
grant usage on schema public to authenticated;
grant select on public.businesses, public.business_memberships, public.customers, public.products,
  public.business_transactions, public.transaction_items, public.ledger_entries,
  public.inventory_movements, public.idempotency_claims to authenticated;

create or replace function private.prevent_immutable_row_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'append-only records cannot be updated or deleted';
end;
$$;
revoke all on function private.prevent_immutable_row_change() from public, anon, authenticated;

create trigger ledger_entries_append_only before update or delete on public.ledger_entries
for each row execute function private.prevent_immutable_row_change();
create trigger inventory_movements_append_only before update or delete on public.inventory_movements
for each row execute function private.prevent_immutable_row_change();
create trigger transaction_items_append_only before update or delete on public.transaction_items
for each row execute function private.prevent_immutable_row_change();
create trigger transactions_append_only before update or delete on public.business_transactions
for each row execute function private.prevent_immutable_row_change();

-- Privileged write implementation is isolated in an unexposed schema. It validates auth.uid()
-- and membership itself, then performs all ledger/stock writes in one database transaction.
create or replace function private.record_credit_sale(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount_paise bigint,
  p_currency text,
  p_idempotency_key text,
  p_items jsonb,
  p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tx_id uuid;
  v_total bigint := 0;
  v_item record;
  v_line_total bigint;
  v_catalog_price bigint;
  v_claimed integer;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'amount must be positive paise' using errcode = '22023'; end if;
  if p_currency is distinct from 'INR' then raise exception 'unsupported currency' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'items must be an array' using errcode = '22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception '1 to 50 items are required' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin','cashier')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  perform 1 from public.customers c where c.id = p_customer_id and c.business_id = p_business_id for update;
  if not found then raise exception 'customer not found in this business' using errcode = '22023'; end if;

  v_fingerprint := jsonb_build_object('customer_id',p_customer_id,'amount_paise',p_amount_paise,'currency',p_currency,'items',p_items)::text;
  insert into public.idempotency_claims(business_id, actor_id, idempotency_key, request_fingerprint)
  values (p_business_id, v_actor, p_idempotency_key, v_fingerprint)
  on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    select ic.transaction_id, ic.request_fingerprint into v_tx_id, v_existing_fingerprint from public.idempotency_claims ic
    where ic.business_id = p_business_id and ic.actor_id = v_actor and ic.idempotency_key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_tx_id is not null then return jsonb_build_object('transaction_id', v_tx_id, 'replayed', true); end if;
    raise exception 'idempotent request is already being processed; retry safely' using errcode = '40001';
  end if;

  for v_item in
    select x.product_id, x.quantity, x.unit_price_paise
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric, unit_price_paise bigint)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0
      or scale(v_item.quantity) > 3 or v_item.unit_price_paise is null or v_item.unit_price_paise <= 0 then
      raise exception 'invalid item values' using errcode = '22023';
    end if;
    select p.unit_price_paise into v_catalog_price
      from public.products p
      where p.id=v_item.product_id and p.business_id=p_business_id and p.is_active
      for update;
    if not found then raise exception 'product unavailable' using errcode = '22023'; end if;
    if v_catalog_price <> v_item.unit_price_paise then raise exception 'product price changed; refresh and review the bill' using errcode = '22023'; end if;
    if v_item.quantity * v_item.unit_price_paise <> trunc(v_item.quantity * v_item.unit_price_paise) then
      raise exception 'item line total must resolve to whole paise' using errcode = '22023';
    end if;
    v_line_total := (v_item.quantity * v_item.unit_price_paise)::bigint;
    if v_line_total <= 0 then raise exception 'item line total must be positive' using errcode = '22023'; end if;
    v_total := v_total + v_line_total;
  end loop;
  if v_total <> p_amount_paise then raise exception 'amount does not match item total' using errcode = '22023'; end if;

  insert into public.business_transactions(business_id, customer_id, actor_id, transaction_type, amount_paise, currency, idempotency_key)
  values (p_business_id, p_customer_id, v_actor, 'credit_sale', p_amount_paise, p_currency, p_idempotency_key)
  returning id into v_tx_id;

  for v_item in
    select x.product_id, x.quantity, x.unit_price_paise
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric, unit_price_paise bigint)
  loop
    v_line_total := round(v_item.quantity * v_item.unit_price_paise)::bigint;
    update public.products p
      set stock_on_hand = p.stock_on_hand - v_item.quantity
      where p.id = v_item.product_id and p.business_id = p_business_id
        and p.is_active and p.stock_on_hand >= v_item.quantity;
    if not found then raise exception 'product unavailable or insufficient stock' using errcode = '22023'; end if;

    insert into public.transaction_items(business_id, transaction_id, product_id, quantity, unit_price_paise, line_total_paise)
    values (p_business_id, v_tx_id, v_item.product_id, v_item.quantity, v_item.unit_price_paise, v_line_total);
    insert into public.inventory_movements(business_id, product_id, actor_id, transaction_id, quantity_delta, reason)
    values (p_business_id, v_item.product_id, v_actor, v_tx_id, -v_item.quantity, 'credit_sale');
  end loop;

  insert into public.ledger_entries(business_id, customer_id, transaction_id, entry_type, amount_paise, currency)
  values (p_business_id, p_customer_id, v_tx_id, 'credit_sale', p_amount_paise, p_currency);
  update public.idempotency_claims set transaction_id = v_tx_id
    where business_id = p_business_id and actor_id = v_actor and idempotency_key = p_idempotency_key;
  return jsonb_build_object('transaction_id', v_tx_id, 'replayed', false);
end;
$$;

create or replace function public.record_credit_sale(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount_paise bigint,
  p_currency text,
  p_idempotency_key text,
  p_items jsonb,
  p_confirmed boolean
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_credit_sale($1, $2, $3, $4, $5, $6, $7);
$$;
revoke all on function private.record_credit_sale(uuid, uuid, bigint, text, text, jsonb, boolean) from public, anon;
grant execute on function private.record_credit_sale(uuid, uuid, bigint, text, text, jsonb, boolean) to authenticated;
revoke all on function public.record_credit_sale(uuid, uuid, bigint, text, text, jsonb, boolean) from public, anon;
grant execute on function public.record_credit_sale(uuid, uuid, bigint, text, text, jsonb, boolean) to authenticated;


-- Full reversals are compensating records: the original sale is never edited or deleted.
create or replace function private.reverse_credit_sale(
  p_business_id uuid,
  p_original_transaction_id uuid,
  p_idempotency_key text,
  p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_original public.business_transactions%rowtype;
  v_reversal_id uuid;
  v_claimed integer;
  v_item record;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;

  v_fingerprint := jsonb_build_object('original_transaction_id',p_original_transaction_id)::text;
  insert into public.idempotency_claims(business_id, actor_id, idempotency_key, request_fingerprint)
  values (p_business_id, v_actor, p_idempotency_key, v_fingerprint)
  on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    select ic.transaction_id, ic.request_fingerprint into v_reversal_id, v_existing_fingerprint from public.idempotency_claims ic
    where ic.business_id = p_business_id and ic.actor_id = v_actor and ic.idempotency_key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_reversal_id is not null then return jsonb_build_object('transaction_id', v_reversal_id, 'replayed', true); end if;
    raise exception 'idempotent request is already being processed; retry safely' using errcode = '40001';
  end if;

  select t.* into v_original
  from public.business_transactions t
  where t.id = p_original_transaction_id and t.business_id = p_business_id
    and t.transaction_type = 'credit_sale'
  for update;
  if not found then raise exception 'original sale not found' using errcode = '22023'; end if;
  perform 1 from public.customers c where c.id=v_original.customer_id and c.business_id=p_business_id for update;
  if not found then raise exception 'customer not found in this business' using errcode = '22023'; end if;
  if exists (select 1 from public.business_transactions r where r.reversal_of = v_original.id) then
    raise exception 'sale has already been reversed' using errcode = '23505';
  end if;
  if coalesce((select sum(le.amount_paise) from public.ledger_entries le where le.business_id=p_business_id and le.customer_id=v_original.customer_id),0) < v_original.amount_paise then
    raise exception 'sale cannot be reversed while its value has been settled; reverse the payment first' using errcode = '22023';
  end if;

  insert into public.business_transactions(
    business_id, customer_id, actor_id, transaction_type, amount_paise,
    currency, idempotency_key, reversal_of
  ) values (
    p_business_id, v_original.customer_id, v_actor, 'reversal',
    v_original.amount_paise, v_original.currency, p_idempotency_key, v_original.id
  ) returning id into v_reversal_id;

  insert into public.ledger_entries(business_id, customer_id, transaction_id, entry_type, amount_paise, currency)
  values (p_business_id, v_original.customer_id, v_reversal_id, 'sale_reversal', -v_original.amount_paise, v_original.currency);

  for v_item in
    select i.product_id, i.quantity, i.unit_price_paise, i.line_total_paise
    from public.transaction_items i
    where i.transaction_id = v_original.id
  loop
    update public.products p set stock_on_hand = p.stock_on_hand + v_item.quantity
    where p.id = v_item.product_id and p.business_id = p_business_id;
    if not found then raise exception 'original product no longer exists' using errcode = '23503'; end if;
    insert into public.transaction_items(business_id, transaction_id, product_id, quantity, unit_price_paise, line_total_paise)
    values (p_business_id, v_reversal_id, v_item.product_id, v_item.quantity, v_item.unit_price_paise, v_item.line_total_paise);
    insert into public.inventory_movements(business_id, product_id, actor_id, transaction_id, quantity_delta, reason)
    values (p_business_id, v_item.product_id, v_actor, v_reversal_id, v_item.quantity, 'reversal');
  end loop;

  update public.idempotency_claims set transaction_id = v_reversal_id
    where business_id = p_business_id and actor_id = v_actor and idempotency_key = p_idempotency_key;
  return jsonb_build_object('transaction_id', v_reversal_id, 'replayed', false);
end;
$$;

create or replace function public.reverse_credit_sale(
  p_business_id uuid,
  p_original_transaction_id uuid,
  p_idempotency_key text,
  p_confirmed boolean
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reverse_credit_sale($1, $2, $3, $4);
$$;
revoke all on function private.reverse_credit_sale(uuid, uuid, text, boolean) from public, anon;
grant execute on function private.reverse_credit_sale(uuid, uuid, text, boolean) to authenticated;
revoke all on function public.reverse_credit_sale(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.reverse_credit_sale(uuid, uuid, text, boolean) to authenticated;


-- First-run business setup and master-data writes are also server-validated RPCs.
create or replace function private.create_business(p_name text,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_business_id uuid;
  v_claimed integer;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'business name is required' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}

create or replace function private.create_customer(p_business_id uuid,p_display_name text,p_phone_e164 text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_customer_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin','cashier')) then
    raise exception 'business access denied' using errcode = '42501';
  end if;
  if p_display_name is null or length(trim(p_display_name)) not between 1 and 120 then raise exception 'customer name is required' using errcode = '22023'; end if;
  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'phone must be E.164 format' using errcode = '22023'; end if;
  insert into public.customers(business_id,display_name,phone_e164)
  values (p_business_id,trim(p_display_name),p_phone_e164) returning id into v_customer_id;
  return jsonb_build_object('customer_id',v_customer_id);
end;
$$;

create or replace function public.create_customer(p_business_id uuid,p_display_name text,p_phone_e164 text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_customer($1,$2,$3); $$;

create or replace function private.create_product(
  p_business_id uuid,p_name text,p_unit_label text,p_unit_price_paise bigint,p_opening_stock numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_product_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin')) then
    raise exception 'business access denied' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 then raise exception 'product name is required' using errcode = '22023'; end if;
  if p_unit_label is null or length(trim(p_unit_label)) not between 1 and 24 then raise exception 'unit label is required' using errcode = '22023'; end if;
  if p_unit_price_paise is null or p_unit_price_paise <= 0 then raise exception 'unit price must be positive paise' using errcode = '22023'; end if;
  if p_opening_stock is null or p_opening_stock < 0 or scale(p_opening_stock) > 3 then raise exception 'opening stock must be non-negative with at most three decimals' using errcode = '22023'; end if;
  insert into public.products(business_id,name,unit_label,unit_price_paise,stock_on_hand)
  values (p_business_id,trim(p_name),trim(p_unit_label),p_unit_price_paise,p_opening_stock)
  returning id into v_product_id;
  if p_opening_stock > 0 then
    insert into public.inventory_movements(business_id,product_id,actor_id,transaction_id,quantity_delta,reason)
    values (p_business_id,v_product_id,v_actor,null,p_opening_stock,'opening_balance');
  end if;
  return jsonb_build_object('product_id',v_product_id);
end;
$$;

create or replace function public.create_product(
  p_business_id uuid,p_name text,p_unit_label text,p_unit_price_paise bigint,p_opening_stock numeric default 0
) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.create_product($1,$2,$3,$4,$5); $$;

revoke all on function private.create_business(text,text) from public, anon;
grant execute on function private.create_business(text,text) to authenticated;
revoke all on function public.create_business(text,text) from public, anon;
grant execute on function public.create_business(text,text) to authenticated;

revoke all on function private.create_customer(uuid,text,text) from public, anon;
grant execute on function private.create_customer(uuid,text,text) to authenticated;
revoke all on function public.create_customer(uuid,text,text) from public, anon;
grant execute on function public.create_customer(uuid,text,text) to authenticated;

revoke all on function private.create_product(uuid,text,text,bigint,numeric) from public, anon;
grant execute on function private.create_product(uuid,text,text,bigint,numeric) to authenticated;
revoke all on function public.create_product(uuid,text,text,bigint,numeric) from public, anon;
grant execute on function public.create_product(uuid,text,text,bigint,numeric) to authenticated;

-- Customer payments reduce the khata balance and are committed atomically with their transaction.
create or replace function private.record_customer_payment(
  p_business_id uuid,p_customer_id uuid,p_amount_paise bigint,p_currency text,
  p_idempotency_key text,p_payment_method text,p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_balance bigint;
  v_tx_id uuid;
  v_claimed integer;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'payment must be positive paise' using errcode = '22023'; end if;
  if p_currency is distinct from 'INR' then raise exception 'unsupported currency' using errcode = '22023'; end if;
  if p_payment_method not in ('cash','upi','bank','other') then raise exception 'unsupported payment method' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m where m.business_id=p_business_id
      and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin','cashier')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  perform 1 from public.customers c where c.id=p_customer_id and c.business_id=p_business_id for update;
  if not found then raise exception 'customer not found in this business' using errcode = '22023'; end if;

  v_fingerprint := jsonb_build_object('customer_id',p_customer_id,'amount_paise',p_amount_paise,'currency',p_currency,'payment_method',p_payment_method)::text;
  insert into public.idempotency_claims(business_id,actor_id,idempotency_key,request_fingerprint)
  values (p_business_id,v_actor,p_idempotency_key,v_fingerprint) on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select ic.transaction_id,ic.request_fingerprint into v_tx_id,v_existing_fingerprint
    from public.idempotency_claims ic where ic.business_id=p_business_id and ic.actor_id=v_actor and ic.idempotency_key=p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_tx_id is not null then return jsonb_build_object('transaction_id',v_tx_id,'replayed',true); end if;
    raise exception 'idempotent request is already being processed; retry safely' using errcode = '40001';
  end if;

  select coalesce(sum(le.amount_paise),0) into v_balance
  from public.ledger_entries le where le.business_id=p_business_id and le.customer_id=p_customer_id;
  if v_balance <= 0 or p_amount_paise > v_balance then
    raise exception 'payment exceeds the current outstanding khata balance' using errcode = '22023';
  end if;

  insert into public.business_transactions(business_id,customer_id,actor_id,transaction_type,amount_paise,currency,payment_method,idempotency_key)
  values (p_business_id,p_customer_id,v_actor,'payment',p_amount_paise,p_currency,p_payment_method,p_idempotency_key)
  returning id into v_tx_id;
  insert into public.ledger_entries(business_id,customer_id,transaction_id,entry_type,amount_paise,currency)
  values (p_business_id,p_customer_id,v_tx_id,'payment',-p_amount_paise,p_currency);
  update public.idempotency_claims set transaction_id=v_tx_id
  where business_id=p_business_id and actor_id=v_actor and idempotency_key=p_idempotency_key;
  return jsonb_build_object('transaction_id',v_tx_id,'replayed',false);
end;
$$;

create or replace function public.record_customer_payment(
  p_business_id uuid,p_customer_id uuid,p_amount_paise bigint,p_currency text,
  p_idempotency_key text,p_payment_method text,p_confirmed boolean
) returns jsonb language sql security invoker set search_path = ''
as $$ select private.record_customer_payment($1,$2,$3,$4,$5,$6,$7); $$;

-- A mistaken payment can be compensated without editing the original receipt or ledger row.
create or replace function private.reverse_customer_payment(
  p_business_id uuid,p_original_transaction_id uuid,p_idempotency_key text,p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_original public.business_transactions%rowtype;
  v_reversal_id uuid;
  v_claimed integer;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m where m.business_id=p_business_id
      and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;

  v_fingerprint := jsonb_build_object('original_transaction_id',p_original_transaction_id)::text;
  insert into public.idempotency_claims(business_id,actor_id,idempotency_key,request_fingerprint)
  values (p_business_id,v_actor,p_idempotency_key,v_fingerprint) on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select ic.transaction_id,ic.request_fingerprint into v_reversal_id,v_existing_fingerprint
    from public.idempotency_claims ic where ic.business_id=p_business_id and ic.actor_id=v_actor and ic.idempotency_key=p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_reversal_id is not null then return jsonb_build_object('transaction_id',v_reversal_id,'replayed',true); end if;
    raise exception 'idempotent request is already being processed; retry safely' using errcode = '40001';
  end if;

  select t.* into v_original from public.business_transactions t
  where t.id=p_original_transaction_id and t.business_id=p_business_id and t.transaction_type='payment'
  for update;
  if not found then raise exception 'original payment not found' using errcode = '22023'; end if;
  perform 1 from public.customers c where c.id=v_original.customer_id and c.business_id=p_business_id for update;
  if not found then raise exception 'customer not found in this business' using errcode = '22023'; end if;
  if exists (select 1 from public.business_transactions r where r.reversal_of=v_original.id) then
    raise exception 'payment has already been reversed' using errcode = '23505';
  end if;

  insert into public.business_transactions(business_id,customer_id,actor_id,transaction_type,amount_paise,currency,idempotency_key,reversal_of)
  values (p_business_id,v_original.customer_id,v_actor,'reversal',v_original.amount_paise,v_original.currency,p_idempotency_key,v_original.id)
  returning id into v_reversal_id;
  insert into public.ledger_entries(business_id,customer_id,transaction_id,entry_type,amount_paise,currency)
  values (p_business_id,v_original.customer_id,v_reversal_id,'payment_reversal',v_original.amount_paise,v_original.currency);
  update public.idempotency_claims set transaction_id=v_reversal_id
  where business_id=p_business_id and actor_id=v_actor and idempotency_key=p_idempotency_key;
  return jsonb_build_object('transaction_id',v_reversal_id,'replayed',false);
end;
$$;

create or replace function public.reverse_customer_payment(
  p_business_id uuid,p_original_transaction_id uuid,p_idempotency_key text,p_confirmed boolean
) returns jsonb language sql security invoker set search_path = ''
as $$ select private.reverse_customer_payment($1,$2,$3,$4); $$;

revoke all on function private.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) from public,anon;
grant execute on function private.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) to authenticated;
revoke all on function public.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) from public,anon;
grant execute on function public.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) to authenticated;

revoke all on function private.reverse_customer_payment(uuid,uuid,text,boolean) from public,anon;
grant execute on function private.reverse_customer_payment(uuid,uuid,text,boolean) to authenticated;
revoke all on function public.reverse_customer_payment(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.reverse_customer_payment(uuid,uuid,text,boolean) to authenticated;
 then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  v_fingerprint := jsonb_build_object('name',trim(p_name))::text;
  insert into private.business_onboarding_claims(actor_id,idempotency_key,request_fingerprint)
  values (v_actor,p_idempotency_key,v_fingerprint) on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select c.business_id,c.request_fingerprint into v_business_id,v_existing_fingerprint
    from private.business_onboarding_claims c where c.actor_id=v_actor and c.idempotency_key=p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_business_id is not null then return jsonb_build_object('business_id',v_business_id,'role','owner','replayed',true); end if;
    raise exception 'onboarding request is already being processed; retry safely' using errcode = '40001';
  end if;
  insert into public.businesses(name,currency) values (trim(p_name),'INR') returning id into v_business_id;
  insert into public.business_memberships(business_id,user_id,role,status) values (v_business_id,v_actor,'owner','active');
  update private.business_onboarding_claims set business_id=v_business_id where actor_id=v_actor and idempotency_key=p_idempotency_key;
  return jsonb_build_object('business_id',v_business_id,'role','owner','replayed',false);
end;
$;

create or replace function public.create_business(p_name text,p_idempotency_key text)
returns jsonb language sql security invoker set search_path = ''
as $ select private.create_business($1,$2); $;

create or replace function private.create_customer(p_business_id uuid,p_display_name text,p_phone_e164 text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_customer_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin','cashier')) then
    raise exception 'business access denied' using errcode = '42501';
  end if;
  if p_display_name is null or length(trim(p_display_name)) not between 1 and 120 then raise exception 'customer name is required' using errcode = '22023'; end if;
  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'phone must be E.164 format' using errcode = '22023'; end if;
  insert into public.customers(business_id,display_name,phone_e164)
  values (p_business_id,trim(p_display_name),p_phone_e164) returning id into v_customer_id;
  return jsonb_build_object('customer_id',v_customer_id);
end;
$$;

create or replace function public.create_customer(p_business_id uuid,p_display_name text,p_phone_e164 text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.create_customer($1,$2,$3); $$;

create or replace function private.create_product(
  p_business_id uuid,p_name text,p_unit_label text,p_unit_price_paise bigint,p_opening_stock numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_product_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin')) then
    raise exception 'business access denied' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 then raise exception 'product name is required' using errcode = '22023'; end if;
  if p_unit_label is null or length(trim(p_unit_label)) not between 1 and 24 then raise exception 'unit label is required' using errcode = '22023'; end if;
  if p_unit_price_paise is null or p_unit_price_paise <= 0 then raise exception 'unit price must be positive paise' using errcode = '22023'; end if;
  if p_opening_stock is null or p_opening_stock < 0 or scale(p_opening_stock) > 3 then raise exception 'opening stock must be non-negative with at most three decimals' using errcode = '22023'; end if;
  insert into public.products(business_id,name,unit_label,unit_price_paise,stock_on_hand)
  values (p_business_id,trim(p_name),trim(p_unit_label),p_unit_price_paise,p_opening_stock)
  returning id into v_product_id;
  if p_opening_stock > 0 then
    insert into public.inventory_movements(business_id,product_id,actor_id,transaction_id,quantity_delta,reason)
    values (p_business_id,v_product_id,v_actor,null,p_opening_stock,'opening_balance');
  end if;
  return jsonb_build_object('product_id',v_product_id);
end;
$$;

create or replace function public.create_product(
  p_business_id uuid,p_name text,p_unit_label text,p_unit_price_paise bigint,p_opening_stock numeric default 0
) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.create_product($1,$2,$3,$4,$5); $$;

revoke all on function private.create_business(text) from public, anon;
grant execute on function private.create_business(text) to authenticated;
revoke all on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;

revoke all on function private.create_customer(uuid,text,text) from public, anon;
grant execute on function private.create_customer(uuid,text,text) to authenticated;
revoke all on function public.create_customer(uuid,text,text) from public, anon;
grant execute on function public.create_customer(uuid,text,text) to authenticated;

revoke all on function private.create_product(uuid,text,text,bigint,numeric) from public, anon;
grant execute on function private.create_product(uuid,text,text,bigint,numeric) to authenticated;
revoke all on function public.create_product(uuid,text,text,bigint,numeric) from public, anon;
grant execute on function public.create_product(uuid,text,text,bigint,numeric) to authenticated;

-- Customer payments reduce the khata balance and are committed atomically with their transaction.
create or replace function private.record_customer_payment(
  p_business_id uuid,p_customer_id uuid,p_amount_paise bigint,p_currency text,
  p_idempotency_key text,p_payment_method text,p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_balance bigint;
  v_tx_id uuid;
  v_claimed integer;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then raise exception 'payment must be positive paise' using errcode = '22023'; end if;
  if p_currency is distinct from 'INR' then raise exception 'unsupported currency' using errcode = '22023'; end if;
  if p_payment_method not in ('cash','upi','bank','other') then raise exception 'unsupported payment method' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m where m.business_id=p_business_id
      and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin','cashier')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  perform 1 from public.customers c where c.id=p_customer_id and c.business_id=p_business_id for update;
  if not found then raise exception 'customer not found in this business' using errcode = '22023'; end if;

  v_fingerprint := jsonb_build_object('customer_id',p_customer_id,'amount_paise',p_amount_paise,'currency',p_currency,'payment_method',p_payment_method)::text;
  insert into public.idempotency_claims(business_id,actor_id,idempotency_key,request_fingerprint)
  values (p_business_id,v_actor,p_idempotency_key,v_fingerprint) on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select ic.transaction_id,ic.request_fingerprint into v_tx_id,v_existing_fingerprint
    from public.idempotency_claims ic where ic.business_id=p_business_id and ic.actor_id=v_actor and ic.idempotency_key=p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_tx_id is not null then return jsonb_build_object('transaction_id',v_tx_id,'replayed',true); end if;
    raise exception 'idempotent request is already being processed; retry safely' using errcode = '40001';
  end if;

  select coalesce(sum(le.amount_paise),0) into v_balance
  from public.ledger_entries le where le.business_id=p_business_id and le.customer_id=p_customer_id;
  if v_balance <= 0 or p_amount_paise > v_balance then
    raise exception 'payment exceeds the current outstanding khata balance' using errcode = '22023';
  end if;

  insert into public.business_transactions(business_id,customer_id,actor_id,transaction_type,amount_paise,currency,payment_method,idempotency_key)
  values (p_business_id,p_customer_id,v_actor,'payment',p_amount_paise,p_currency,p_payment_method,p_idempotency_key)
  returning id into v_tx_id;
  insert into public.ledger_entries(business_id,customer_id,transaction_id,entry_type,amount_paise,currency)
  values (p_business_id,p_customer_id,v_tx_id,'payment',-p_amount_paise,p_currency);
  update public.idempotency_claims set transaction_id=v_tx_id
  where business_id=p_business_id and actor_id=v_actor and idempotency_key=p_idempotency_key;
  return jsonb_build_object('transaction_id',v_tx_id,'replayed',false);
end;
$$;

create or replace function public.record_customer_payment(
  p_business_id uuid,p_customer_id uuid,p_amount_paise bigint,p_currency text,
  p_idempotency_key text,p_payment_method text,p_confirmed boolean
) returns jsonb language sql security invoker set search_path = ''
as $$ select private.record_customer_payment($1,$2,$3,$4,$5,$6,$7); $$;

-- A mistaken payment can be compensated without editing the original receipt or ledger row.
create or replace function private.reverse_customer_payment(
  p_business_id uuid,p_original_transaction_id uuid,p_idempotency_key text,p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_original public.business_transactions%rowtype;
  v_reversal_id uuid;
  v_claimed integer;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m where m.business_id=p_business_id
      and m.user_id=v_actor and m.status='active' and m.role in ('owner','admin')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;

  v_fingerprint := jsonb_build_object('original_transaction_id',p_original_transaction_id)::text;
  insert into public.idempotency_claims(business_id,actor_id,idempotency_key,request_fingerprint)
  values (p_business_id,v_actor,p_idempotency_key,v_fingerprint) on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select ic.transaction_id,ic.request_fingerprint into v_reversal_id,v_existing_fingerprint
    from public.idempotency_claims ic where ic.business_id=p_business_id and ic.actor_id=v_actor and ic.idempotency_key=p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then raise exception 'idempotency key reused with different request' using errcode = '23505'; end if;
    if v_reversal_id is not null then return jsonb_build_object('transaction_id',v_reversal_id,'replayed',true); end if;
    raise exception 'idempotent request is already being processed; retry safely' using errcode = '40001';
  end if;

  select t.* into v_original from public.business_transactions t
  where t.id=p_original_transaction_id and t.business_id=p_business_id and t.transaction_type='payment'
  for update;
  if not found then raise exception 'original payment not found' using errcode = '22023'; end if;
  perform 1 from public.customers c where c.id=v_original.customer_id and c.business_id=p_business_id for update;
  if not found then raise exception 'customer not found in this business' using errcode = '22023'; end if;
  if exists (select 1 from public.business_transactions r where r.reversal_of=v_original.id) then
    raise exception 'payment has already been reversed' using errcode = '23505';
  end if;

  insert into public.business_transactions(business_id,customer_id,actor_id,transaction_type,amount_paise,currency,idempotency_key,reversal_of)
  values (p_business_id,v_original.customer_id,v_actor,'reversal',v_original.amount_paise,v_original.currency,p_idempotency_key,v_original.id)
  returning id into v_reversal_id;
  insert into public.ledger_entries(business_id,customer_id,transaction_id,entry_type,amount_paise,currency)
  values (p_business_id,v_original.customer_id,v_reversal_id,'payment_reversal',v_original.amount_paise,v_original.currency);
  update public.idempotency_claims set transaction_id=v_reversal_id
  where business_id=p_business_id and actor_id=v_actor and idempotency_key=p_idempotency_key;
  return jsonb_build_object('transaction_id',v_reversal_id,'replayed',false);
end;
$$;

create or replace function public.reverse_customer_payment(
  p_business_id uuid,p_original_transaction_id uuid,p_idempotency_key text,p_confirmed boolean
) returns jsonb language sql security invoker set search_path = ''
as $$ select private.reverse_customer_payment($1,$2,$3,$4); $$;

revoke all on function private.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) from public,anon;
grant execute on function private.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) to authenticated;
revoke all on function public.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) from public,anon;
grant execute on function public.record_customer_payment(uuid,uuid,bigint,text,text,text,boolean) to authenticated;

revoke all on function private.reverse_customer_payment(uuid,uuid,text,boolean) from public,anon;
grant execute on function private.reverse_customer_payment(uuid,uuid,text,boolean) to authenticated;
revoke all on function public.reverse_customer_payment(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.reverse_customer_payment(uuid,uuid,text,boolean) to authenticated;
