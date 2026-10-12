-- Aggregate-only visitor statistics, no IP addresses, raw referrers or identifiers stored.
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,
  source TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source)
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
