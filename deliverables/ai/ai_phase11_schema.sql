-- ---------------------------------------------------------------------------
-- My EXtreme Trainer — Phase 11 (Snap · Say · Type) database changes
--
-- WHY THIS FILE EXISTS. The two Phase 11 migrations are normally applied with
-- `php artisan migrate`. The test host is a cPanel account with NO SSH, so
-- artisan cannot be run there at all — and unlike the food data, these changes
-- are not optional: without them every AI request fails and the admin screens
-- have nothing to read. This is the same two migrations written as plain SQL,
-- to be imported through phpMyAdmin.
--
--   2026_10_30_000001_create_ai_usage_logs_table
--   2026_10_30_000002_add_ai_columns_to_users_table
--
-- IT IS SAFE TO RUN TWICE. Nothing here drops anything. The table is created
-- only if absent, each column is added only if absent, and the migration rows
-- are inserted only if absent. Running it on a database that is already up to
-- date changes nothing and reports success.
--
-- IT DESTROYS NOTHING. In particular it never drops `ai_usage_logs`: that table
-- is the spend ledger, and recreating it would wipe the record of what has
-- already been billed — which is also what the monthly cap is measured against.
--
-- ORDER: import this BEFORE usda_local_foods.sql.gz, or after. They touch
-- different tables and do not depend on each other.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;


-- ---------------------------------------------------------------------------
-- 0. The migrations table itself.
--
-- Every Laravel deployment already has this. It is created here anyway so that
-- importing into an empty database cannot fail on the very last statement,
-- AFTER everything else has been written — an error at that point looks like
-- the whole import failed when in fact only the bookkeeping did.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 1. ai_usage_logs — one row per AI call.
--
-- Numbers, statuses and model names only. No prompt text, no transcript, no
-- photo, no food names: this table answers "what did it cost and what failed",
-- and a usage log is the easiest place in a codebase for someone's dinner
-- photo to quietly accumulate for years.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `ai_usage_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  -- Nullable and nulled (not deleted) when a member goes: spend that happened
  -- still happened, and a deleted account must not rewrite last month's total
  -- and release headroom under the cap.
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `feature` varchar(64) NOT NULL,
  `model` varchar(64) NOT NULL,
  -- Null for duration-billed transcription, where there are no token counts.
  -- Null means "not applicable"; a zero would read as a free call.
  `input_tokens` int(10) unsigned DEFAULT NULL,
  `output_tokens` int(10) unsigned DEFAULT NULL,
  -- An estimate from config/ai.php, never a figure from OpenAI. Six decimal
  -- places because one analyse call costs a small fraction of a cent, and
  -- rounding to two would record almost every call as $0.00 — the cap would
  -- then never be reached however many calls were made.
  `estimated_cost_usd` decimal(12,6) NOT NULL DEFAULT 0.000000,
  `status` varchar(32) NOT NULL,
  `latency_ms` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  -- Month-to-date spend and the per-member daily count are read on every single
  -- AI request, so both have to be cheap.
  KEY `ai_usage_logs_created_at_status_index` (`created_at`,`status`),
  KEY `ai_usage_logs_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `ai_usage_logs_feature_created_at_index` (`feature`,`created_at`),
  CONSTRAINT `ai_usage_logs_user_id_foreign` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 2. Three columns on `users`.
--
-- `ADD COLUMN IF NOT EXISTS` is MariaDB-only — MySQL 8 rejects it — and a
-- plain ALTER fails with "Duplicate column name" on a second run, which on a
-- shared host means an operator staring at a red error with no way to tell
-- whether it mattered. Asking INFORMATION_SCHEMA first works on both and is
-- genuinely idempotent.
--
-- ai_features_enabled defaults to 0 ON PURPOSE. The client wants to try this on
-- his own account and watch the cost before anyone else can spend money on his
-- behalf, so "off" has to be the state the column is born in: a default of 1
-- would switch the feature on for the entire member base the moment this ran.
--
-- Consent is a timestamp plus the version of the notice that was shown, not a
-- boolean. A boolean cannot answer "did they agree to THIS wording", so
-- rewording the notice would leave us claiming agreement to text nobody read.
-- ---------------------------------------------------------------------------

SET @ddl = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'users'
       AND COLUMN_NAME  = 'ai_features_enabled') = 0,
  'ALTER TABLE `users` ADD COLUMN `ai_features_enabled` tinyint(1) NOT NULL DEFAULT 0',
  'DO 0'));
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'users'
       AND COLUMN_NAME  = 'ai_consent_at') = 0,
  'ALTER TABLE `users` ADD COLUMN `ai_consent_at` timestamp NULL DEFAULT NULL',
  'DO 0'));
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'users'
       AND COLUMN_NAME  = 'ai_consent_version') = 0,
  'ALTER TABLE `users` ADD COLUMN `ai_consent_version` varchar(16) DEFAULT NULL',
  'DO 0'));
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;


-- ---------------------------------------------------------------------------
-- 3. Record both migrations as run.
--
-- Without these rows a later `php artisan migrate` — run from a machine that
-- does have a shell, or after a move to a host that allows one — would try to
-- create the table and add the columns a second time and stop with an error.
-- ---------------------------------------------------------------------------

INSERT INTO `migrations` (`migration`, `batch`)
SELECT * FROM (
  SELECT '2026_10_30_000001_create_ai_usage_logs_table' AS m,
         (SELECT COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`) AS b
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_10_30_000001_create_ai_usage_logs_table'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT * FROM (
  SELECT '2026_10_30_000002_add_ai_columns_to_users_table' AS m,
         (SELECT COALESCE(MAX(`batch`), 0) FROM `migrations`) AS b
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_10_30_000002_add_ai_columns_to_users_table'
);


-- ---------------------------------------------------------------------------
-- Verify. Run these afterwards in phpMyAdmin's SQL tab; all four should be 1.
-- ---------------------------------------------------------------------------
--
--   SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_usage_logs';
--
--   SELECT COUNT(DISTINCT COLUMN_NAME) = 3 FROM INFORMATION_SCHEMA.COLUMNS
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
--       AND COLUMN_NAME IN ('ai_features_enabled','ai_consent_at','ai_consent_version');
--
--   SELECT COUNT(*) = 2 FROM `migrations`
--     WHERE `migration` LIKE '2026_10_30_%';
--
