-- ════════════════════════════════════════════════════════════════
-- 021_admin_roles.sql
-- Add a DB-managed `role` column to the users table so admin/owner
-- status can be stored and updated without requiring a redeploy.
-- ════════════════════════════════════════════════════════════════

-- Add role column (idempotent — safe to run multiple times).
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Index for fast lookups by role (e.g. listing all admins).
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- ── Initial seed (run ONCE by a DBA / owner after deploying this migration) ──
-- Replace <OWNER_EMAIL> with the actual owner email address.
-- This promotes the owner account before the env-var fallback is removed.
--
--   UPDATE users SET role = 'owner' WHERE email = '<OWNER_EMAIL>';
--   UPDATE users SET role = 'admin' WHERE email = '<ADMIN_EMAIL>';
--
-- After running the seed, verify with:
--   SELECT email, role FROM users WHERE role IN ('owner', 'admin', 'superadmin');
