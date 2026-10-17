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
