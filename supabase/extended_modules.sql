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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references public.customers(business_id, id) on delete restrict,
  unique (business_id, reference_code),
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

commit;
