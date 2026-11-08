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

select public.create_customer(
  '123e4567-e89b-42d3-a456-426614174100','New Customer','+919876543210','ci-customer-create-0001'
)->>'customer_id' as customer_id \gset new_customer_
select public.create_product(
  '123e4567-e89b-42d3-a456-426614174100','Tea','kg',12000,4,'ci-product-create-0001'
)->>'product_id' as product_id \gset new_product_
select public.create_customer(
  '123e4567-e89b-42d3-a456-426614174100','New Customer','+919876543210','ci-customer-create-0001'
)->>'customer_id' as customer_id \gset new_customer_replay_
select (:'new_customer_customer_id' = :'new_customer_replay_customer_id') as customer_replayed \gset
\if :customer_replayed
\echo 'PASS customer creation idempotency replay'
\else
\echo 'FAIL customer creation idempotency replay'
\quit 1
\endif
select public.create_product(
  '123e4567-e89b-42d3-a456-426614174100','Tea','kg',12000,4,'ci-product-create-0001'
)->>'product_id' as product_id \gset new_product_replay_
select (:'new_product_product_id' = :'new_product_replay_product_id') as product_replayed \gset
\if :product_replayed
\echo 'PASS product creation idempotency replay'
\else
\echo 'FAIL product creation idempotency replay'
\quit 1
\endif
select set_config('test.created_product', :'new_product_product_id', false);

do $master_data_key_mismatch$
begin
  begin
    perform public.create_product(
      '123e4567-e89b-42d3-a456-426614174100','Tea','kg',12000,5,'ci-product-create-0001'
    );
    raise exception 'expected product idempotency mismatch rejection';
  exception when unique_violation then null;
  end;
end $master_data_key_mismatch$;

do $master_data_test$
begin
  if not exists (select 1 from public.customers where display_name='New Customer' and phone_e164='+919876543210') then raise exception 'customer creation failed'; end if;
  if (select stock_on_hand from public.products where id=current_setting('test.created_product')::uuid) <> 4 then raise exception 'opening stock not created'; end if;
  if (select count(*) from public.inventory_movements where product_id=current_setting('test.created_product')::uuid and reason='opening_balance') <> 1 then raise exception 'opening stock audit movement duplicated or missing'; end if;
  if not exists (select 1 from public.inventory_movements where product_id=current_setting('test.created_product')::uuid and reason='opening_balance' and quantity_delta=4 and actor_id='123e4567-e89b-42d3-a456-426614174001') then raise exception 'opening stock audit movement missing'; end if;
end $master_data_test$;

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

-- Reusing an idempotency key with a different payload must be rejected.
do $idem_test$
begin
  begin
    perform public.record_credit_sale(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      45000,'INR','ci-credit-sale-key-0001',
      '[{"product_id":"123e4567-e89b-42d3-a456-426614174102","quantity":3,"unit_price_paise":15000}]'::jsonb,
      true
    );
    raise exception 'expected idempotency fingerprint rejection';
  exception when unique_violation then null;
  end;
end $idem_test$;

-- A stale or client-tampered catalogue price cannot be used for a sale.
do $stale_price_test$
begin
  begin
    perform public.record_credit_sale(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      29998,'INR','ci-stale-price-sale-0001',
      '[{"product_id":"123e4567-e89b-42d3-a456-426614174102","quantity":2,"unit_price_paise":14999}]'::jsonb,
      true
    );
    raise exception 'expected stale-price rejection';
  exception when sqlstate '22023' then null;
  end;
end $stale_price_test$;

-- Authenticated clients cannot write ledger rows directly around the atomic RPC.
do $direct_write_test$
begin
  begin
    insert into public.ledger_entries(business_id,customer_id,transaction_id,entry_type,amount_paise,currency)
    values ('123e4567-e89b-42d3-a456-426614174100','123e4567-e89b-42d3-a456-426614174101',current_setting('test.sale_id')::uuid,'credit_sale',1,'INR');
    raise exception 'expected direct-write privilege rejection';
  exception when insufficient_privilege then null;
  end;
end $direct_write_test$;

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

-- Payments reduce the khata balance; retries, overpayments and payment reversals are safe.
select public.record_credit_sale(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  15000,'INR','ci-credit-sale-second-0001',
  '[{"product_id":"123e4567-e89b-42d3-a456-426614174102","quantity":1,"unit_price_paise":15000}]'::jsonb,
  true
)->>'transaction_id' as transaction_id \gset second_sale_
select set_config('test.second_sale_id', :'second_sale_transaction_id', false);

select public.record_customer_payment(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  5000,'INR','ci-customer-payment-0001','cash',true
)->>'transaction_id' as transaction_id \gset payment_
select set_config('test.payment_id', :'payment_transaction_id', false);

select public.record_customer_payment(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  5000,'INR','ci-customer-payment-0001','cash',true
)->>'transaction_id' as transaction_id \gset payment_replay_
select (:'payment_transaction_id' = :'payment_replay_transaction_id') as payment_replayed \gset
\if :payment_replayed
\echo 'PASS payment idempotency replay'
\else
\echo 'FAIL payment idempotency replay'
\quit 1
\endif

do $payment_balance_test$
begin
  if (select sum(amount_paise) from public.ledger_entries where customer_id='123e4567-e89b-42d3-a456-426614174101') <> 10000 then
    raise exception 'payment did not reduce khata balance correctly';
  end if;
end $payment_balance_test$;

do $payment_key_mismatch_test$
begin
  begin
    perform public.record_customer_payment(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      4000,'INR','ci-customer-payment-0001','cash',true
    );
    raise exception 'expected payment idempotency mismatch rejection';
  exception when unique_violation then null;
  end;
end $payment_key_mismatch_test$;

do $settled_sale_reversal_test$
begin
  begin
    perform public.reverse_credit_sale(
      '123e4567-e89b-42d3-a456-426614174100',
      current_setting('test.second_sale_id')::uuid,
      'ci-premature-sale-reversal-0001',
      true
    );
    raise exception 'expected settled sale reversal rejection';
  exception when sqlstate '22023' then null;
  end;
end $settled_sale_reversal_test$;

do $payment_overpay_test$
begin
  begin
    perform public.record_customer_payment(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      20000,'INR','ci-payment-overpay-0001','upi',true
    );
    raise exception 'expected overpayment rejection';
  exception when sqlstate '22023' then null;
  end;
end $payment_overpay_test$;

select public.reverse_customer_payment(
  '123e4567-e89b-42d3-a456-426614174100',
  :'payment_transaction_id'::uuid,
  'ci-payment-reversal-0001',
  true
)->>'transaction_id' as transaction_id \gset payment_reversal_
select set_config('test.payment_reversal_id', :'payment_reversal_transaction_id', false);

select public.reverse_credit_sale(
  '123e4567-e89b-42d3-a456-426614174100',
  :'second_sale_transaction_id'::uuid,
  'ci-second-sale-reversal-0001',
  true
)->>'transaction_id' as transaction_id \gset second_reversal_

do $payment_reversal_test$
begin
  if (select sum(amount_paise) from public.ledger_entries where customer_id='123e4567-e89b-42d3-a456-426614174101') <> 0 then
    raise exception 'payment/sale reversals did not restore khata balance';
  end if;
  if (select stock_on_hand from public.products where id='123e4567-e89b-42d3-a456-426614174102') <> 5 then
    raise exception 'second sale reversal did not restore stock';
  end if;
  if not exists (select 1 from public.ledger_entries where transaction_id=current_setting('test.payment_reversal_id')::uuid and entry_type='payment_reversal' and amount_paise=5000) then
    raise exception 'payment reversal entry missing';
  end if;
end $payment_reversal_test$;

select set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174002',false);
do $$
begin
  if (select count(*) from public.businesses) <> 1 then raise exception 'second tenant visibility failed'; end if;
  if exists (select 1 from public.customers where id='123e4567-e89b-42d3-a456-426614174101') then raise exception 'cross-tenant access granted'; end if;
end $$;

select set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174001',false);
-- Delivery creation, assignment and event transitions are idempotent and tenant-scoped.
select public.create_delivery_job(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  'DLV-CI-001','Customer One',null,'12 Test Market, Kolkata',
  100,1000,'ci-delivery-create-key-0001',true
)->>'delivery_job_id' as delivery_job_id \gset delivery_
select public.create_delivery_job(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  'DLV-CI-001','Customer One',null,'12 Test Market, Kolkata',
  100,1000,'ci-delivery-create-key-0001',true
)->>'delivery_job_id' as delivery_job_id \gset delivery_replay_
select (:'delivery_delivery_job_id' = :'delivery_replay_delivery_job_id') as delivery_replayed \gset
\if :delivery_replayed
\echo 'PASS delivery creation idempotency replay'
\else
\echo 'FAIL delivery creation idempotency replay'
\quit 1
\endif
select set_config('test.delivery_job_id', :'delivery_delivery_job_id', false);
select public.assign_delivery_job(
  '123e4567-e89b-42d3-a456-426614174100',
  :'delivery_delivery_job_id'::uuid,
  '123e4567-e89b-42d3-a456-426614174001',
  true
);
select public.record_delivery_event('123e4567-e89b-42d3-a456-426614174100', :'delivery_delivery_job_id'::uuid, 'picked_up', null, null, true);
select public.record_delivery_event('123e4567-e89b-42d3-a456-426614174100', :'delivery_delivery_job_id'::uuid, 'in_transit', null, null, true);
select public.record_delivery_event('123e4567-e89b-42d3-a456-426614174100', :'delivery_delivery_job_id'::uuid, 'cash_collected', 'Part payment', 500, true);
select public.record_delivery_event('123e4567-e89b-42d3-a456-426614174100', :'delivery_delivery_job_id'::uuid, 'cash_collected', 'Balance collected', 500, true);
select public.record_delivery_event('123e4567-e89b-42d3-a456-426614174100', :'delivery_delivery_job_id'::uuid, 'delivered', null, null, true);
do $delivery_state_test$
begin
  if (select status from public.delivery_jobs where id=current_setting('test.delivery_job_id')::uuid) <> 'delivered' then
    raise exception 'delivery status transition failed';
  end if;
  if (select sum(cash_collected_paise) from public.delivery_events where delivery_job_id=current_setting('test.delivery_job_id')::uuid) <> 1000 then
    raise exception 'delivery cash collection total failed';
  end if;
  begin
    perform public.record_delivery_event(
      '123e4567-e89b-42d3-a456-426614174100',
      current_setting('test.delivery_job_id')::uuid,'failed',null,null,true
    );
    raise exception 'expected terminal delivery state rejection';
  exception when sqlstate '22023' then null;
  end;
end $delivery_state_test$;

-- Communication outbox rejects unknown/opted-out consent and protects retries.
select public.set_customer_communication_preference(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  'whatsapp','opted_in','in_person_recorded',true
);
select public.queue_customer_notification(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  'whatsapp','delivery_update','delivery-status-v1',
  '{"message":"Your delivery is on the way"}'::jsonb,
  'ci-notification-key-0001',true
)->>'notification_job_id' as notification_job_id \gset notification_
select public.queue_customer_notification(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  'whatsapp','delivery_update','delivery-status-v1',
  '{"message":"Your delivery is on the way"}'::jsonb,
  'ci-notification-key-0001',true
)->>'notification_job_id' as notification_job_id \gset notification_replay_
select (:'notification_notification_job_id' = :'notification_replay_notification_job_id') as notification_replayed \gset
\if :notification_replayed
\echo 'PASS notification idempotency replay'
\else
\echo 'FAIL notification idempotency replay'
\quit 1
\endif
do $notification_safety_test$
begin
  begin
    perform public.queue_customer_notification(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      'whatsapp','delivery_update','delivery-status-v1',
      '{"message":"Different payload"}'::jsonb,
      'ci-notification-key-0001',true
    );
    raise exception 'expected notification idempotency mismatch rejection';
  exception when unique_violation then null;
  end;
end $notification_safety_test$;
select public.set_customer_communication_preference(
  '123e4567-e89b-42d3-a456-426614174100',
  '123e4567-e89b-42d3-a456-426614174101',
  'whatsapp','opted_out','customer_requested',true
);
do $notification_optout_test$
begin
  begin
    perform public.queue_customer_notification(
      '123e4567-e89b-42d3-a456-426614174100',
      '123e4567-e89b-42d3-a456-426614174101',
      'whatsapp','payment_reminder','payment-reminder-v1',
      '{"message":"Reminder"}'::jsonb,
      'ci-notification-optout-0001',true
    );
    raise exception 'expected opt-out suppression';
  exception when insufficient_privilege then null;
  end;
end $notification_optout_test$;


-- Voice proposals are stored for review, not committed as transactions.
select public.create_voice_proposal(
  '123e4567-e89b-42d3-a456-426614174100',
  'hi-IN','text','Ramesh 150 rupees udhar, 2 kg sugar',
  'credit_sale',
  '{"customer_name":"Ramesh","amount_paise":15000,"currency":"INR","items":[{"name":"sugar","quantity":"2","unit":"kg"}]}'::jsonb,
  null,'{}'::text[],'ci-voice-proposal-0001',true
)->>'proposal_id' as proposal_id \gset voice_
select public.create_voice_proposal(
  '123e4567-e89b-42d3-a456-426614174100',
  'hi-IN','text','Ramesh 150 rupees udhar, 2 kg sugar',
  'credit_sale',
  '{"customer_name":"Ramesh","amount_paise":15000,"currency":"INR","items":[{"name":"sugar","quantity":"2","unit":"kg"}]}'::jsonb,
  null,'{}'::text[],'ci-voice-proposal-0001',true
)->>'proposal_id' as proposal_id \gset voice_replay_
select (:'voice_proposal_id' = :'voice_replay_proposal_id') as voice_replayed \gset
\if :voice_replayed
\echo 'PASS voice proposal idempotency replay'
\else
\echo 'FAIL voice proposal idempotency replay'
\quit 1
\endif
select set_config('test.voice_proposal_id', :'voice_proposal_id', false);
do $voice_proposal_safety_test$
begin
  if not exists (
    select 1 from public.voice_intent_proposals p
    join public.voice_sessions s on s.id=p.session_id and s.business_id=p.business_id
    where p.id=current_setting('test.voice_proposal_id')::uuid
      and p.status='confirmed' and s.status='reviewed'
      and p.committed_transaction_id is null
  ) then raise exception 'voice proposal must remain reviewed and uncommitted'; end if;
  begin
    perform public.create_voice_proposal(
      '123e4567-e89b-42d3-a456-426614174100',
      'hi-IN','text','Different transcript',
      'credit_sale',
      '{"customer_name":"Ramesh","amount_paise":16000,"currency":"INR","items":[]}'::jsonb,
      null,'{}'::text[],'ci-voice-proposal-0001',true
    );
    raise exception 'expected voice proposal idempotency mismatch rejection';
  exception when unique_violation then null;
  end;
end $voice_proposal_safety_test$;


-- Stock adjustments are owner/admin-only, confirmed, idempotent and append-only.
select public.adjust_stock(
  '123e4567-e89b-42d3-a456-426614174100',
  current_setting('test.created_product')::uuid,
  2.5,'Supplier count correction','ci-stock-adjustment-0001',true
)->>'stock_on_hand' as stock_after \gset stock_adjust_
select public.adjust_stock(
  '123e4567-e89b-42d3-a456-426614174100',
  current_setting('test.created_product')::uuid,
  2.5,'Supplier count correction','ci-stock-adjustment-0001',true
)->>'stock_on_hand' as stock_after \gset stock_adjust_replay_
select (:'stock_adjust_stock_after' = :'stock_adjust_replay_stock_after') as stock_adjustment_replayed \gset
\if :stock_adjustment_replayed
\echo 'PASS stock adjustment idempotency replay'
\else
\echo 'FAIL stock adjustment idempotency replay'
\quit 1
\endif
do $stock_adjustment_safety_test$
begin
  if (select stock_on_hand from public.products where id=current_setting('test.created_product')::uuid) <> 6.5 then
    raise exception 'stock adjustment quantity was not applied';
  end if;
  if (select count(*) from public.inventory_movements
      where product_id=current_setting('test.created_product')::uuid
        and reason='stock_adjustment' and quantity_delta=2.5) <> 1 then
    raise exception 'stock adjustment movement duplicated or missing';
  end if;
  begin
    perform public.adjust_stock(
      '123e4567-e89b-42d3-a456-426614174100',
      current_setting('test.created_product')::uuid,
      3,'Different adjustment','ci-stock-adjustment-0001',true
    );
    raise exception 'expected stock adjustment idempotency mismatch';
  exception when unique_violation then null;
  end;
  begin
    perform public.adjust_stock(
      '123e4567-e89b-42d3-a456-426614174100',
      current_setting('test.created_product')::uuid,
      -100,'Reject negative stock','ci-stock-adjustment-underflow-0001',true
    );
    raise exception 'expected negative stock rejection';
  exception when sqlstate '22023' then null;
  end;
  if (select stock_on_hand from public.products where id=current_setting('test.created_product')::uuid) <> 6.5 then
    raise exception 'failed stock adjustment changed inventory';
  end if;
end $stock_adjustment_safety_test$;

do $reporting_test$
begin
  if not exists (
    select 1 from public.business_daily_summary
    where business_id='123e4567-e89b-42d3-a456-426614174100'
      and credit_sales_count >= 1 and credit_sales_paise >= 15000
  ) then raise exception 'India-time daily business summary missing expected sales'; end if;
end $reporting_test$;


reset role;
\echo 'PASS tenant isolation, atomic stock/ledger, idempotency, reversals and append-only ledger'

-- A new account can create its first business and becomes its owner atomically.
reset role;
select set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174003',false);
set role authenticated;
select public.create_business('Newly Onboarded Shop','ci-business-onboarding-0001')->>'business_id' as business_id \gset onboarded_
select set_config('test.onboarded_business', :'onboarded_business_id', false);
select public.create_business('Newly Onboarded Shop','ci-business-onboarding-0001')->>'business_id' as business_id \gset onboarded_replay_
select (:'onboarded_business_id' = :'onboarded_replay_business_id') as onboarding_replayed \gset
\if :onboarding_replayed
\echo 'PASS business onboarding idempotency replay'
\else
\echo 'FAIL business onboarding idempotency replay'
\quit 1
\endif
do $$
begin
  if not exists (
    select 1 from public.businesses b join public.business_memberships m on m.business_id=b.id
    where b.id=current_setting('test.onboarded_business')::uuid
      and m.user_id='123e4567-e89b-42d3-a456-426614174003' and m.role='owner' and m.status='active'
  ) then raise exception 'business onboarding did not create owner membership'; end if;
end $$;
do $business_onboarding_key_mismatch$
begin
  begin
    perform public.create_business('Different Shop','ci-business-onboarding-0001');
    raise exception 'expected onboarding idempotency mismatch rejection';
  exception when unique_violation then null;
  end;
end $business_onboarding_key_mismatch$;
reset role;
