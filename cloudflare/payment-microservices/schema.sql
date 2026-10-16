CREATE TABLE IF NOT EXISTS api_usage (tenant TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant,day));

CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY, tenant TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 request_hash TEXT NOT NULL, uetr TEXT NOT NULL, state TEXT NOT NULL,
 message_type TEXT NOT NULL, reference TEXT NOT NULL, receiver_bic TEXT NOT NULL,
 network_ack TEXT, bank_status TEXT, error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(tenant,idempotency_key), UNIQUE(tenant,uetr)
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_created ON payments(tenant,created_at);
CREATE TABLE IF NOT EXISTS payment_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL REFERENCES payments(id),
 event_type TEXT NOT NULL, detail TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_payment ON payment_events(payment_id,id);
