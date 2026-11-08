\set ON_ERROR_STOP on
insert into public.businesses(id,name) values
('123e4567-e89b-42d3-a456-426614174100','Shop One'),
('123e4567-e89b-42d3-a456-426614174200','Shop Two');
insert into public.business_memberships(business_id,user_id,role) values
('123e4567-e89b-42d3-a456-426614174100','123e4567-e89b-42d3-a456-426614174001','owner'),
('123e4567-e89b-42d3-a456-426614174200','123e4567-e89b-42d3-a456-426614174002','owner');
insert into public.customers(id,business_id,display_name) values
('123e4567-e89b-42d3-a456-426614174101','123e4567-e89b-42d3-a456-426614174100','Customer One'),
('123e4567-e89b-42d3-a456-426614174201','123e4567-e89b-42d3-a456-426614174200','Customer Two');
insert into public.products(id,business_id,name,unit_price_paise,stock_on_hand) values
('123e4567-e89b-42d3-a456-426614174102','123e4567-e89b-42d3-a456-426614174100','Sugar',15000,5),
('123e4567-e89b-42d3-a456-426614174202','123e4567-e89b-42d3-a456-426614174200','Rice',20000,5);

set role authenticated;
select set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174001',false);
do $$
begin
  if (select count(*) from public.businesses) <> 1 then raise exception 'tenant isolation failed for businesses'; end if;
  if (select count(*) from public.customers) <> 1 then raise exception 'tenant isolation failed for customers'; end if;
  if exists (select 1 from public.customers where id='123e4567-e89b-42d3-a456-426614174201') then raise exception 'cross-tenant customer leak'; end if;
end $$;

select public.record_credit_sale(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  30000,'INR','ci-credit-sale-key-0001',
  '[{"product_id":"123e4567-e89b-42d3-a456-426614174102","quantity":2,"unit_price_paise":15000}]'::jsonb,
  true
)->>'transaction_id' as sale_id \gset sale_

select public.record_credit_sale(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  30000,'INR','ci-credit-sale-key-0001',
  '[{"product_id":"123e4567-e89b-42d3-a456-426614174102","quantity":2,"unit_price_paise":15000}]'::jsonb,
  true
)->>'transaction_id' as transaction_id \gset replay_

select set_config('test.sale_id', :'sale_sale_id', false);
select (:'sale_sale_id' = :'replay_transaction_id') as idempotency_replayed \gset
\if :idempotency_replayed
\echo 'PASS idempotency replay'
\else
\echo 'FAIL idempotency replay'
\quit 1
\endif

do $$
begin
  if (select stock_on_hand from public.products where id='123e4567-e89b-42d3-a456-426614174102') <> 3 then raise exception 'stock decrement failed'; end if;
  if (select amount_paise from public.ledger_entries where transaction_id=current_setting('test.sale_id')::uuid) <> 30000 then raise exception 'ledger amount failed'; end if;
end $$;

-- An overdrawn sale must fail and roll back its idempotency claim and all writes.
do $$
begin
  begin
    perform public.record_credit_sale(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      1500000,'INR','ci-credit-sale-overdraw-0001',
      '[{"product_id":"123e4567-e89b-42d3-a456-426614174102","quantity":100,"unit_price_paise":15000}]'::jsonb,
      true
    );
    raise exception 'expected insufficient-stock rejection';
  exception when others then
    if sqlerrm = 'expected insufficient-stock rejection' then raise; end if;
  end;
end $$;

-- Only the authenticated tenant owner can reverse; reversal appends a negative ledger entry and restores stock.
select public.reverse_credit_sale(
  '123e4567-e89b-42d3-a456-426614174100',
  :'sale_sale_id'::uuid,
  'ci-credit-sale-reversal-0001',
  true
)->>'transaction_id' as reversal_id \gset reversal_

do $$
begin
  if (select stock_on_hand from public.products where id='123e4567-e89b-42d3-a456-426614174102') <> 5 then raise exception 'reversal stock restoration failed'; end if;
  if (select sum(amount_paise) from public.ledger_entries where customer_id='123e4567-e89b-42d3-a456-426614174101') <> 0 then raise exception 'reversal ledger balance failed'; end if;
  if (select count(*) from public.business_transactions where reversal_of=current_setting('test.sale_id')::uuid) <> 1 then raise exception 'reversal record missing'; end if;
end $$;

-- Ledger rows cannot be mutated even by an authenticated member.
do $$
begin
  begin
    update public.ledger_entries set amount_paise=1 where transaction_id=current_setting('test.sale_id')::uuid;
    raise exception 'expected append-only rejection';
  exception when others then
    if sqlerrm = 'expected append-only rejection' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174002',false);
do $$
begin
  if (select count(*) from public.businesses) <> 1 then raise exception 'second tenant visibility failed'; end if;
  if exists (select 1 from public.customers where id='123e4567-e89b-42d3-a456-426614174101') then raise exception 'cross-tenant access granted'; end if;
end $$;
reset role;
\echo 'PASS tenant isolation, atomic stock/ledger, idempotency, reversals and append-only ledger'
