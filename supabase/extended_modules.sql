-- Boli-Khata additive business modules.
-- Apply after supabase/schema.sql to a dedicated project. This migration adds
-- voice review records, delivery operations, customer consent, messaging outbox,
-- audit history and reporting views. It does not change authentication or expose
-- anonymous database access. All writes remain server-mediated.
begin;

create unique index if not exists business_transactions_business_id_id_uidx
  on public.business_transactions(business_id, id);

create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  language_tag text,
  input_mode text not null check (input_mode in ('speech','text')),
  status text not null default 'captured' check (status in ('captured','transcribed','reviewed','committed','discarded','expired')),
  transcript_text text check (transcript_text is null or length(transcript_text) <= 8000),
  transcript_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create table if not exists public.voice_intent_proposals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  session_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  schema_version integer not null default 1 check (schema_version > 0),
  intent text not null check (intent in ('credit_sale','payment','stock_adjustment','delivery_create','unknown')),
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  confidence numeric(4,3) check (confidence between 0 and 1),
  ambiguity_flags text[] not null default '{}',
  status text not null default 'needs_review' check (status in ('needs_review','confirmed','rejected','committed','expired')),
  committed_transaction_id uuid,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (business_id, session_id) references public.voice_sessions(business_id, id) on delete restrict,
  foreign key (business_id, committed_transaction_id) references public.business_transactions(business_id, id) on delete restrict,
  unique (business_id, actor_id, idempotency_key)
);

create table if not exists public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid,
  reference_code text not null check (length(trim(reference_code)) between 1 and 64),
  recipient_name text not null check (length(trim(recipient_name)) between 1 and 120),
  recipient_phone text,
  pickup_note text,
  delivery_address text not null check (length(trim(delivery_address)) between 1 and 500),
  delivery_fee_paise bigint not null default 0 check (delivery_fee_paise >= 0),
  cash_to_collect_paise bigint not null default 0 check (cash_to_collect_paise >= 0),
  status text not null default 'queued' check (status in ('queued','assigned','picked_up','in_transit','delivered','failed','cancelled','returned')),
  scheduled_at timestamptz,
  delivered_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  request_fingerprint text not null check (length(request_fingerprint) between 2 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete restrict,
  unique (business_id, reference_code),
  unique (business_id, created_by, idempotency_key),
  unique (business_id, id)
);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  delivery_job_id uuid not null,
  assigned_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  foreign key (business_id, delivery_job_id) references public.delivery_jobs(business_id, id) on delete restrict,
  check (unassigned_at is null or unassigned_at >= assigned_at)
);

create unique index if not exists delivery_one_active_assignment_idx
  on public.delivery_assignments(business_id, delivery_job_id)
  where unassigned_at is null;

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  delivery_job_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('created','assigned','picked_up','in_transit','delivered','failed','cancelled','returned','cash_collected','note_added')),
  note text check (note is null or length(note) <= 1000),
  cash_collected_paise bigint check (cash_collected_paise is null or cash_collected_paise >= 0),
  proof_object_key text,
  occurred_at timestamptz not null default now(),
  foreign key (business_id, delivery_job_id) references public.delivery_jobs(business_id, id) on delete restrict,
  check (proof_object_key is null or (length(proof_object_key) between 1 and 500 and proof_object_key !~ '^https?://'))
);

create table if not exists public.customer_communication_preferences (
  business_id uuid not null,
  customer_id uuid not null,
  channel text not null check (channel in ('whatsapp','sms','email')),
  consent_status text not null check (consent_status in ('unknown','opted_in','opted_out')),
  consent_source text,
  consent_recorded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (business_id, customer_id, channel),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete restrict,
  check ((consent_status = 'unknown' and consent_recorded_at is null) or (consent_status <> 'unknown' and consent_recorded_at is not null))
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid,
  channel text not null check (channel in ('whatsapp','sms','email')),
  purpose text not null check (purpose in ('receipt','payment_reminder','delivery_update','general')),
  template_key text not null check (length(template_key) between 1 and 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  request_fingerprint text not null check (length(request_fingerprint) between 2 and 12000),
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled','suppressed')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete restrict,
  unique (business_id, id),
  unique (business_id, idempotency_key)
);

create table if not exists public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  notification_job_id uuid not null,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('accepted','sent','delivered','failed','undeliverable')),
  error_code text,
  attempted_at timestamptz not null default now(),
  foreign key (business_id, notification_job_id) references public.notification_jobs(business_id, id) on delete restrict
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null check (length(action) between 1 and 100),
  entity_type text not null check (length(entity_type) between 1 and 80),
  entity_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index if not exists voice_sessions_business_created_idx on public.voice_sessions(business_id, created_at desc);
create index if not exists voice_proposals_business_status_idx on public.voice_intent_proposals(business_id, status, created_at desc);
create index if not exists delivery_jobs_business_status_idx on public.delivery_jobs(business_id, status, scheduled_at);
create index if not exists delivery_events_job_time_idx on public.delivery_events(business_id, delivery_job_id, occurred_at desc);
create index if not exists notification_jobs_queue_idx on public.notification_jobs(status, scheduled_at) where status in ('queued','failed');
create index if not exists audit_events_business_time_idx on public.audit_events(business_id, occurred_at desc);

alter table public.voice_sessions enable row level security;
alter table public.voice_intent_proposals enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_events enable row level security;
alter table public.customer_communication_preferences enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_attempts enable row level security;
alter table public.audit_events enable row level security;

create policy "members read voice sessions" on public.voice_sessions for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = voice_sessions.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read voice proposals" on public.voice_intent_proposals for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = voice_intent_proposals.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read delivery jobs" on public.delivery_jobs for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = delivery_jobs.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read delivery assignments" on public.delivery_assignments for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = delivery_assignments.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read delivery events" on public.delivery_events for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = delivery_events.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read communication preferences" on public.customer_communication_preferences for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = customer_communication_preferences.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read notification jobs" on public.notification_jobs for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = notification_jobs.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read notification attempts" on public.notification_attempts for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = notification_attempts.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members read audit events" on public.audit_events for select to authenticated
using (exists (select 1 from public.business_memberships m where m.business_id = audit_events.business_id and m.user_id = (select auth.uid()) and m.status = 'active'));

grant select on public.voice_sessions, public.voice_intent_proposals, public.delivery_jobs,
  public.delivery_assignments, public.delivery_events, public.customer_communication_preferences,
  public.notification_jobs, public.notification_attempts, public.audit_events to authenticated;

create trigger delivery_events_append_only before update or delete on public.delivery_events
for each row execute function private.prevent_immutable_row_change();
create trigger notification_attempts_append_only before update or delete on public.notification_attempts
for each row execute function private.prevent_immutable_row_change();
create trigger audit_events_append_only before update or delete on public.audit_events
for each row execute function private.prevent_immutable_row_change();

create or replace view public.business_daily_summary
with (security_invoker = true)
as
select
  t.business_id,
  (t.created_at at time zone 'Asia/Kolkata')::date as business_date,
  count(*) filter (where t.transaction_type = 'credit_sale') as credit_sales_count,
  coalesce(sum(t.amount_paise) filter (where t.transaction_type = 'credit_sale'), 0)::bigint as credit_sales_paise,
  count(*) filter (where t.transaction_type = 'payment') as payments_count,
  coalesce(sum(t.amount_paise) filter (where t.transaction_type = 'payment'), 0)::bigint as payments_received_paise
from public.business_transactions t
group by t.business_id, (t.created_at at time zone 'Asia/Kolkata')::date;

grant select on public.business_daily_summary to authenticated;


-- Idempotent delivery creation. The server derives the actor from the JWT and
-- verifies membership; clients cannot supply an actor identity.
create or replace function private.create_delivery_job(
  p_business_id uuid,
  p_customer_id uuid,
  p_reference_code text,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_address text,
  p_delivery_fee_paise bigint,
  p_cash_to_collect_paise bigint,
  p_idempotency_key text,
  p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_job_id uuid;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_claimed integer;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin','cashier')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  if p_reference_code is null or length(trim(p_reference_code)) not between 1 and 64
    or p_recipient_name is null or length(trim(p_recipient_name)) not between 1 and 120
    or p_delivery_address is null or length(trim(p_delivery_address)) not between 1 and 500
    or coalesce(p_delivery_fee_paise, -1) < 0
    or coalesce(p_cash_to_collect_paise, -1) < 0
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128} then
    raise exception 'invalid delivery details' using errcode = '22023';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.business_id = p_business_id
  ) then raise exception 'customer not found in this business' using errcode = '22023'; end if;

  v_fingerprint := jsonb_build_object(
    'customer_id',p_customer_id,'reference_code',trim(p_reference_code),
    'recipient_name',trim(p_recipient_name),'recipient_phone',p_recipient_phone,
    'delivery_address',trim(p_delivery_address),'delivery_fee_paise',p_delivery_fee_paise,
    'cash_to_collect_paise',p_cash_to_collect_paise
  )::text;

  insert into public.delivery_jobs(
    business_id, customer_id, reference_code, recipient_name, recipient_phone,
    delivery_address, delivery_fee_paise, cash_to_collect_paise, created_by,
    idempotency_key, request_fingerprint
  ) values (
    p_business_id, p_customer_id, trim(p_reference_code), trim(p_recipient_name), p_recipient_phone,
    trim(p_delivery_address), p_delivery_fee_paise, p_cash_to_collect_paise, v_actor,
    p_idempotency_key, v_fingerprint
  )
  on conflict (business_id, created_by, idempotency_key) do nothing
  returning id into v_job_id;

  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    select d.id, d.request_fingerprint into v_job_id, v_existing_fingerprint
    from public.delivery_jobs d
    where d.business_id = p_business_id and d.created_by = v_actor and d.idempotency_key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency key reused with different delivery details' using errcode = '23505';
    end if;
    return jsonb_build_object('delivery_job_id',v_job_id,'replayed',true);
  end if;

  insert into public.delivery_events(business_id, delivery_job_id, actor_id, event_type, note)
  values (p_business_id, v_job_id, v_actor, 'created', 'Delivery job created');
  insert into public.audit_events(business_id, actor_id, action, entity_type, entity_id)
  values (p_business_id, v_actor, 'delivery.created', 'delivery_job', v_job_id);
  return jsonb_build_object('delivery_job_id',v_job_id,'replayed',false);
end;
$;

create or replace function public.create_delivery_job(
  p_business_id uuid,
  p_customer_id uuid,
  p_reference_code text,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_address text,
  p_delivery_fee_paise bigint,
  p_cash_to_collect_paise bigint,
  p_idempotency_key text,
  p_confirmed boolean
) returns jsonb
language sql
security invoker
set search_path = ''
as $
  select private.create_delivery_job($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
$;

create or replace function private.assign_delivery_job(
  p_business_id uuid,
  p_delivery_job_id uuid,
  p_assigned_user_id uuid,
  p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_status text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin')
  ) then raise exception 'assignment permission denied' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = p_assigned_user_id and m.status = 'active'
  ) then raise exception 'assignee is not an active business member' using errcode = '22023'; end if;

  select d.status into v_status from public.delivery_jobs d
  where d.id = p_delivery_job_id and d.business_id = p_business_id for update;
  if not found or v_status not in ('queued','assigned') then
    raise exception 'delivery job is unavailable for assignment' using errcode = '22023';
  end if;

  update public.delivery_assignments
  set unassigned_at = now()
  where business_id = p_business_id and delivery_job_id = p_delivery_job_id and unassigned_at is null;
  insert into public.delivery_assignments(business_id, delivery_job_id, assigned_user_id, assigned_by)
  values (p_business_id, p_delivery_job_id, p_assigned_user_id, v_actor);
  update public.delivery_jobs set status = 'assigned', updated_at = now()
  where id = p_delivery_job_id and business_id = p_business_id;
  insert into public.delivery_events(business_id, delivery_job_id, actor_id, event_type, note)
  values (p_business_id, p_delivery_job_id, v_actor, 'assigned', 'Delivery assigned');
  insert into public.audit_events(business_id, actor_id, action, entity_type, entity_id)
  values (p_business_id, v_actor, 'delivery.assigned', 'delivery_job', p_delivery_job_id);
  return jsonb_build_object('delivery_job_id',p_delivery_job_id,'assigned_user_id',p_assigned_user_id);
end;
$;

create or replace function public.assign_delivery_job(
  p_business_id uuid,
  p_delivery_job_id uuid,
  p_assigned_user_id uuid,
  p_confirmed boolean
) returns jsonb
language sql
security invoker
set search_path = ''
as $
  select private.assign_delivery_job($1,$2,$3,$4);
$;

create or replace function private.record_delivery_event(
  p_business_id uuid,
  p_delivery_job_id uuid,
  p_event_type text,
  p_note text,
  p_cash_collected_paise bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_job public.delivery_jobs%rowtype;
  v_next_status text;
  v_assigned boolean;
  v_collected bigint;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_event_type not in ('picked_up','in_transit','delivered','failed','cancelled','returned','cash_collected','note_added') then
    raise exception 'unsupported delivery event' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 1000 then raise exception 'delivery note is too long' using errcode = '22023'; end if;
  if p_event_type = 'cash_collected' and (p_cash_collected_paise is null or p_cash_collected_paise <= 0) then
    raise exception 'cash collection must be positive paise' using errcode = '22023';
  end if;
  if p_event_type <> 'cash_collected' and p_cash_collected_paise is not null then
    raise exception 'cash amount is only valid for cash collection events' using errcode = '22023';
  end if;

  select d.* into v_job from public.delivery_jobs d
  where d.id = p_delivery_job_id and d.business_id = p_business_id for update;
  if not found then raise exception 'delivery job not found' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor and m.status = 'active'
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  select exists (
    select 1 from public.delivery_assignments a
    where a.business_id = p_business_id and a.delivery_job_id = p_delivery_job_id
      and a.assigned_user_id = v_actor and a.unassigned_at is null
  ) into v_assigned;
  if not v_assigned and not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin')
  ) then raise exception 'delivery assignment required' using errcode = '42501'; end if;

  v_next_status := v_job.status;
  if p_event_type = 'picked_up' and v_job.status = 'assigned' then v_next_status := 'picked_up';
  elsif p_event_type = 'in_transit' and v_job.status = 'picked_up' then v_next_status := 'in_transit';
  elsif p_event_type = 'delivered' and v_job.status = 'in_transit' then v_next_status := 'delivered';
  elsif p_event_type = 'failed' and v_job.status in ('assigned','picked_up','in_transit') then v_next_status := 'failed';
  elsif p_event_type = 'cancelled' and v_job.status in ('queued','assigned') then v_next_status := 'cancelled';
  elsif p_event_type = 'returned' and v_job.status in ('picked_up','in_transit','failed') then v_next_status := 'returned';
  elsif p_event_type not in ('cash_collected','note_added') then
    raise exception 'invalid delivery state transition' using errcode = '22023';
  end if;

  if p_event_type = 'cash_collected' then
    select coalesce(sum(e.cash_collected_paise),0) into v_collected
    from public.delivery_events e
    where e.business_id = p_business_id and e.delivery_job_id = p_delivery_job_id;
    if v_collected + p_cash_collected_paise > v_job.cash_to_collect_paise then
      raise exception 'cash collection exceeds amount due' using errcode = '22023';
    end if;
  end if;

  insert into public.delivery_events(business_id, delivery_job_id, actor_id, event_type, note, cash_collected_paise)
  values (p_business_id, p_delivery_job_id, v_actor, p_event_type, p_note, p_cash_collected_paise);
  if v_next_status <> v_job.status then
    update public.delivery_jobs set status = v_next_status,
      delivered_at = case when v_next_status = 'delivered' then now() else delivered_at end,
      updated_at = now()
    where id = p_delivery_job_id and business_id = p_business_id;
  end if;
  insert into public.audit_events(business_id, actor_id, action, entity_type, entity_id)
  values (p_business_id, v_actor, 'delivery.' || p_event_type, 'delivery_job', p_delivery_job_id);
  return jsonb_build_object('delivery_job_id',p_delivery_job_id,'status',v_next_status);
end;
$;

create or replace function public.record_delivery_event(
  p_business_id uuid,
  p_delivery_job_id uuid,
  p_event_type text,
  p_note text default null,
  p_cash_collected_paise bigint default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $
  select private.record_delivery_event($1,$2,$3,$4,$5);
$;

revoke all on function private.create_delivery_job(uuid,uuid,text,text,text,text,bigint,bigint,text,boolean) from public, anon;
revoke all on function private.assign_delivery_job(uuid,uuid,uuid,boolean) from public, anon;
revoke all on function private.record_delivery_event(uuid,uuid,text,text,bigint) from public, anon;
grant execute on function private.create_delivery_job(uuid,uuid,text,text,text,text,bigint,bigint,text,boolean) to authenticated;
grant execute on function private.assign_delivery_job(uuid,uuid,uuid,boolean) to authenticated;
grant execute on function private.record_delivery_event(uuid,uuid,text,text,bigint) to authenticated;
revoke all on function public.create_delivery_job(uuid,uuid,text,text,text,text,bigint,bigint,text,boolean) from public, anon;
revoke all on function public.assign_delivery_job(uuid,uuid,uuid,boolean) from public, anon;
revoke all on function public.record_delivery_event(uuid,uuid,text,text,bigint) from public, anon;
grant execute on function public.create_delivery_job(uuid,uuid,text,text,text,text,bigint,bigint,text,boolean) to authenticated;
grant execute on function public.assign_delivery_job(uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.record_delivery_event(uuid,uuid,text,text,bigint) to authenticated;


-- Consent is recorded explicitly per customer and channel. Unknown consent is
-- never treated as permission to send.
create or replace function private.set_customer_communication_preference(
  p_business_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_consent_status text,
  p_consent_source text,
  p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if p_channel not in ('whatsapp','sms','email')
    or p_consent_status not in ('opted_in','opted_out')
    or p_consent_source is null or length(trim(p_consent_source)) not between 1 and 80 then
    raise exception 'invalid communication preference' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin','cashier')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.business_id = p_business_id
  ) then raise exception 'customer not found in this business' using errcode = '22023'; end if;

  insert into public.customer_communication_preferences(
    business_id, customer_id, channel, consent_status, consent_source, consent_recorded_at, updated_at
  ) values (
    p_business_id, p_customer_id, p_channel, p_consent_status, trim(p_consent_source), now(), now()
  )
  on conflict (business_id, customer_id, channel) do update set
    consent_status = excluded.consent_status,
    consent_source = excluded.consent_source,
    consent_recorded_at = excluded.consent_recorded_at,
    updated_at = now();

  insert into public.audit_events(business_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_business_id, v_actor, 'customer.communication_consent.' || p_consent_status,
    'customer', p_customer_id, jsonb_build_object('channel',p_channel,'source',trim(p_consent_source)));
  return jsonb_build_object('customer_id',p_customer_id,'channel',p_channel,'consent_status',p_consent_status);
end;
$;

create or replace function public.set_customer_communication_preference(
  p_business_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_consent_status text,
  p_consent_source text,
  p_confirmed boolean
) returns jsonb
language sql
security invoker
set search_path = ''
as $
  select private.set_customer_communication_preference($1,$2,$3,$4,$5,$6);
$;

create or replace function private.queue_customer_notification(
  p_business_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_purpose text,
  p_template_key text,
  p_payload jsonb,
  p_idempotency_key text,
  p_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_actor uuid := auth.uid();
  v_job_id uuid;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_claimed integer;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_confirmed is distinct from true then raise exception 'explicit confirmation required' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.business_memberships m
    where m.business_id = p_business_id and m.user_id = v_actor
      and m.status = 'active' and m.role in ('owner','admin','cashier')
  ) then raise exception 'business access denied' using errcode = '42501'; end if;
  if p_channel not in ('whatsapp','sms','email')
    or p_purpose not in ('receipt','payment_reminder','delivery_update','general')
    or p_template_key is null or length(p_template_key) not between 1 and 80
    or jsonb_typeof(p_payload) is distinct from 'object'
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,128} then
    raise exception 'invalid notification request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.customer_communication_preferences cp
    where cp.business_id = p_business_id and cp.customer_id = p_customer_id
      and cp.channel = p_channel and cp.consent_status = 'opted_in'
  ) then raise exception 'customer has not opted in to this channel' using errcode = '42501'; end if;

  v_fingerprint := jsonb_build_object(
    'customer_id',p_customer_id,'channel',p_channel,'purpose',p_purpose,
    'template_key',p_template_key,'payload',p_payload
  )::text;
  insert into public.notification_jobs(
    business_id, customer_id, channel, purpose, template_key, payload,
    request_fingerprint, idempotency_key
  ) values (
    p_business_id, p_customer_id, p_channel, p_purpose, p_template_key,
    p_payload, v_fingerprint, p_idempotency_key
  )
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_job_id;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    select n.id, n.request_fingerprint into v_job_id, v_existing_fingerprint
    from public.notification_jobs n
    where n.business_id = p_business_id and n.idempotency_key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency key reused with different notification payload' using errcode = '23505';
    end if;
    return jsonb_build_object('notification_job_id',v_job_id,'replayed',true);
  end if;

  insert into public.audit_events(business_id, actor_id, action, entity_type, entity_id)
  values (p_business_id, v_actor, 'notification.queued', 'notification_job', v_job_id);
  return jsonb_build_object('notification_job_id',v_job_id,'replayed',false);
end;
$;

create or replace function public.queue_customer_notification(
  p_business_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_purpose text,
  p_template_key text,
  p_payload jsonb,
  p_idempotency_key text,
  p_confirmed boolean
) returns jsonb
language sql
security invoker
set search_path = ''
as $
  select private.queue_customer_notification($1,$2,$3,$4,$5,$6,$7,$8);
$;

revoke all on function private.set_customer_communication_preference(uuid,uuid,text,text,text,boolean) from public, anon;
revoke all on function private.queue_customer_notification(uuid,uuid,text,text,text,jsonb,text,boolean) from public, anon;
grant execute on function private.set_customer_communication_preference(uuid,uuid,text,text,text,boolean) to authenticated;
grant execute on function private.queue_customer_notification(uuid,uuid,text,text,text,jsonb,text,boolean) to authenticated;
revoke all on function public.set_customer_communication_preference(uuid,uuid,text,text,text,boolean) from public, anon;
revoke all on function public.queue_customer_notification(uuid,uuid,text,text,text,jsonb,text,boolean) from public, anon;
grant execute on function public.set_customer_communication_preference(uuid,uuid,text,text,text,boolean) to authenticated;
grant execute on function public.queue_customer_notification(uuid,uuid,text,text,text,jsonb,text,boolean) to authenticated;

commit;
