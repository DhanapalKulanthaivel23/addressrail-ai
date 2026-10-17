-- AddressRail SaaS STAGING: run ONLY as a DB administrator, never from app credentials.
-- Ensure the running app uses a separate LOGIN role without SUPERUSER/BYPASSRLS
-- or ownership of any table. No real customer/payment data supported.
CREATE TABLE IF NOT EXISTS public.saas_cases(
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  payment_ref text NOT NULL CHECK (payment_ref ~ '^PAY-[A-Za-z0-9_-]{5,72}$'),
  simulated_status text NOT NULL CHECK(simulated_status IN ('RJCT','PENDING','UNKNOWN')),
  creator text NOT NULL CHECK(length(creator) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,payment_ref),
  UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.saas_reports(
  tenant_id uuid NOT NULL,
  case_id uuid NOT NULL,
  payload jsonb NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,case_id),
  FOREIGN KEY(tenant_id,case_id) REFERENCES public.saas_cases(tenant_id,id),
  CHECK(jsonb_typeof(payload)='object' AND
        payload->>'synthetic'='true' AND
        payload->>'requires_human_review'='true' AND
        payload->>'settlement_attested'='false' AND
        payload->>'safe_to_retry'='false')
);
CREATE TABLE IF NOT EXISTS public.saas_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor text NOT NULL,
  action text NOT NULL CHECK(action IN ('CASE_CREATED','REPORT_ATTACHED')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,case_id) REFERENCES public.saas_cases(tenant_id,id)
);
ALTER TABLE public.saas_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.saas_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.saas_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saas_isolation ON public.saas_cases;
CREATE POLICY saas_isolation ON public.saas_cases
  USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
  WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);
DROP POLICY IF EXISTS saas_reports_isolation ON public.saas_reports;
CREATE POLICY saas_reports_isolation ON public.saas_reports
  USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
  WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);
DROP POLICY IF EXISTS saas_audit_isolation ON public.saas_audit;
CREATE POLICY saas_audit_isolation ON public.saas_audit
  USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
  WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);

-- In staging CI the bootstrap script creates a non-owner addressrail_api role.
-- The APP role cannot delete or update reports or audit events.
GRANT USAGE ON SCHEMA public TO addressrail_api;
GRANT SELECT,INSERT ON public.saas_cases TO addressrail_api;
GRANT SELECT,INSERT ON public.saas_reports TO addressrail_api;
GRANT SELECT,INSERT ON public.saas_audit TO addressrail_api;
GRANT USAGE,SELECT ON SEQUENCE public.saas_audit_id_seq TO addressrail_api;

-- Tenant-scoped synthetic processing jobs. A separate publisher/outbox integration
-- is required before these may be emitted to Kafka. Job state is immutable here.
CREATE TABLE IF NOT EXISTS public.saas_jobs(
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  case_id uuid NOT NULL,
  creator text NOT NULL CHECK(length(creator) BETWEEN 1 AND 128),
  state text NOT NULL DEFAULT 'PENDING_DISPATCH' CHECK(state='PENDING_DISPATCH'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,case_id),
  FOREIGN KEY(tenant_id,case_id) REFERENCES public.saas_cases(tenant_id,id)
);
ALTER TABLE public.saas_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saas_jobs_isolation ON public.saas_jobs;
CREATE POLICY saas_jobs_isolation ON public.saas_jobs
  USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
  WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);
GRANT SELECT,INSERT ON public.saas_jobs TO addressrail_api;

-- Write-once per-tenant outbox envelope recorded atomically with saas_jobs.
-- This table is NOT a Kafka publisher. Only a separately reviewed privileged
-- dispatcher should ever be allowed to claim/ack rows; API login has INSERT/SELECT.
CREATE TABLE IF NOT EXISTS public.saas_outbox(
  event_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  event_type text NOT NULL CHECK(event_type='SYNTHETIC_JOB_PENDING'),
  envelope_version integer NOT NULL DEFAULT 1 CHECK(envelope_version=1),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,job_id,event_type),
  FOREIGN KEY(tenant_id,job_id) REFERENCES public.saas_jobs(tenant_id,id),
  CHECK(jsonb_typeof(payload)='object'
        AND payload->>'synthetic'='true'
        AND payload->>'settlement_attested'='false'
        AND payload->>'safe_to_retry'='false'
        AND payload->>'event_type'='SYNTHETIC_JOB_PENDING'
        AND payload->>'tenant_id'=tenant_id::text
        AND payload->>'job_id'=job_id::text)
);
ALTER TABLE public.saas_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_outbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saas_outbox_isolation ON public.saas_outbox;
CREATE POLICY saas_outbox_isolation ON public.saas_outbox
  USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
  WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);
GRANT SELECT,INSERT ON public.saas_outbox TO addressrail_api;

-- Prototype dispatcher access: provision a separate non-owner LOGIN credential
-- into this NOLOGIN group using an administrator. Never use addressrail_api.
ALTER TABLE public.saas_outbox
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='addressrail_dispatcher') THEN
    CREATE ROLE addressrail_dispatcher NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO addressrail_dispatcher;
GRANT SELECT ON public.saas_outbox TO addressrail_dispatcher;
GRANT UPDATE(dispatched_at) ON public.saas_outbox TO addressrail_dispatcher;
-- FORCE RLS still applies. A per-tenant dispatcher credential and mandatory
-- tenant binding by provisioning are required before any external exposure.

-- Durable inbox for synthetic tenant events. A separate authenticated consumer
-- must verify signatures and tenant identity before recording event IDs.
CREATE TABLE IF NOT EXISTS public.saas_inbox(
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  job_id uuid NOT NULL,
  consumer_name text NOT NULL CHECK(consumer_name ~ '^[a-z0-9_-]{3,48}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,event_id,consumer_name),
  FOREIGN KEY(tenant_id,job_id) REFERENCES public.saas_jobs(tenant_id,id)
);
ALTER TABLE public.saas_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_inbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saas_inbox_isolation ON public.saas_inbox;
CREATE POLICY saas_inbox_isolation ON public.saas_inbox
  USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
  WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='addressrail_consumer') THEN
    CREATE ROLE addressrail_consumer NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO addressrail_consumer;
GRANT SELECT,INSERT ON public.saas_inbox TO addressrail_consumer;
GRANT SELECT ON public.saas_jobs TO addressrail_consumer;

-- Quarantine records contain safe metadata only; never raw invalid payloads.
-- The consumer records a rejected event under its independently provisioned
-- tenant identity. No automatic replay or offset acknowledgement is implied.
CREATE TABLE IF NOT EXISTS public.saas_quarantine(
  tenant_id uuid NOT NULL,
  event_fingerprint text NOT NULL CHECK(event_fingerprint ~ '^[0-9a-f]{64}$'),
  consumer_name text NOT NULL CHECK(consumer_name ~ '^[a-z0-9_-]{3,48}$'),
  reason text NOT NULL CHECK(reason IN ('INVALID_ENVELOPE','INVALID_SIGNATURE','TENANT_MISMATCH','UNAUTHORIZED_JOB','UNEXPECTED_EVENT')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences bigint NOT NULL DEFAULT 1 CHECK(occurrences>=1),
  PRIMARY KEY(tenant_id,event_fingerprint,consumer_name)
);
ALTER TABLE public.saas_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_quarantine FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saas_quarantine_isolation ON public.saas_quarantine;
CREATE POLICY saas_quarantine_isolation ON public.saas_quarantine
 USING(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid)
 WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id', true),'')::uuid);
GRANT SELECT,INSERT ON public.saas_quarantine TO addressrail_consumer;


-- PRIVATE synthetic network staging mapping. Store per-tenant references so
-- clients cannot query another tenant's upstream network message ID.
-- This does not constitute authorisation for real bank/payment operations.
CREATE TABLE IF NOT EXISTS public.saas_network_simulations(
  tenant_id uuid NOT NULL,
  client_reference text NOT NULL CHECK(client_reference ~ '^[A-Za-z0-9_-]{4,60}$'),
  scenario text NOT NULL CHECK(scenario IN ('ACCEPT','REJECT','PENDING')),
  network_reference text NOT NULL CHECK(network_reference ~ '^(SIMOK_|SIMRJCT_|SIMWAIT_)[A-F0-9]{28}$'),
  remote_message_id uuid,
  bridge_state text NOT NULL DEFAULT 'SUBMITTING'
    CHECK(bridge_state IN ('SUBMITTING','ACKNOWLEDGED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,client_reference),
  UNIQUE(tenant_id,network_reference)
);
ALTER TABLE public.saas_network_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_network_simulations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saas_network_isolation ON public.saas_network_simulations;
CREATE POLICY saas_network_isolation ON public.saas_network_simulations
  USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON public.saas_network_simulations TO addressrail_api;
GRANT UPDATE(remote_message_id,bridge_state) ON public.saas_network_simulations TO addressrail_api;


-- Narrow fictional ISO pacs.008 base-XSD staging submissions.
-- Only tenant-scoped fictional test metadata is retained, never payment XML.
CREATE TABLE IF NOT EXISTS public.saas_iso_simulations(
  tenant_id uuid NOT NULL,
  client_reference text NOT NULL CHECK(client_reference ~ '^[A-Za-z0-9_-]{4,60}$'),
  scenario text NOT NULL CHECK(scenario IN ('ACCEPT','REJECT','PENDING')),
  iso_version text NOT NULL CHECK(iso_version IN ('13','14')),
  amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000),
  network_reference text NOT NULL CHECK(
    network_reference ~ '^(SIMOK_|SIMRJCT_|SIMWAIT_)[A-F0-9]{26}$'),
  remote_message_id uuid,
  validation_sha256 text CHECK(validation_sha256 ~ '^[0-9a-f]{64}$'),
  bridge_state text NOT NULL DEFAULT 'SUBMITTING'
    CHECK(bridge_state IN ('SUBMITTING','ACKNOWLEDGED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,client_reference),
  UNIQUE(tenant_id,network_reference),
  CHECK ((bridge_state='SUBMITTING' AND remote_message_id IS NULL AND validation_sha256 IS NULL)
      OR (bridge_state='ACKNOWLEDGED' AND remote_message_id IS NOT NULL AND validation_sha256 IS NOT NULL))
);
ALTER TABLE public.saas_iso_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_iso_simulations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saas_iso_isolation ON public.saas_iso_simulations;
CREATE POLICY saas_iso_isolation ON public.saas_iso_simulations
  USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON public.saas_iso_simulations TO addressrail_api;
GRANT UPDATE(remote_message_id,validation_sha256,bridge_state) ON
  public.saas_iso_simulations TO addressrail_api;
