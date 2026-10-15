-- Aggregate-only visitor statistics, no IP addresses, raw referrers or identifiers stored.
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,
  source TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source)
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);

-- Community comments. User-supplied text is never displayed before approval.
-- Moderators should delete rejected/old comments per privacy policy.
CREATE TABLE IF NOT EXISTS community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_comments_page_public
  ON community_comments(page,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_pending
  ON community_comments(status,created_at);
