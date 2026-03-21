# Raw Import Text — Retention Runbook

## Overview

`rawImportText` stores the original text/screenshot import string on each
`external_workouts` row for debugging and re-parsing. This data is purged after
**30 days** to limit storage growth and reduce PII surface area.

All other workout columns (movements, label, confidence scores, etc.) are
**never** purged by this job.

---

## Running the Purge

### One-time manual sweep

```bash
pnpm --filter @workspace/scripts run purge-raw-import-text
```

### Custom retention window (e.g. 7-day sweep)

```bash
RETENTION_DAYS=7 pnpm --filter @workspace/scripts run purge-raw-import-text
```

### Dry-run (count rows that would be purged, no write)

```sql
SELECT COUNT(*)
FROM external_workouts
WHERE created_at < NOW() - INTERVAL '30 days'
  AND raw_import_text IS NOT NULL;
```

---

## Scheduling (Recommended)

Run the purge nightly via a cron job or your platform's scheduled task:

```
0 3 * * * cd /path/to/workspace && pnpm --filter @workspace/scripts run purge-raw-import-text >> /var/log/retention.log 2>&1
```

---

## Verifying a Sweep

After running, verify rows were cleared:

```sql
-- Should return 0 rows older than 30 days with rawImportText set
SELECT id, created_at, raw_import_text
FROM external_workouts
WHERE created_at < NOW() - INTERVAL '30 days'
  AND raw_import_text IS NOT NULL
LIMIT 10;
```

---

## Safety Guarantees

- Only `raw_import_text` is set to NULL — all other columns are unchanged.
- The UPDATE is idempotent: running it multiple times produces the same result.
- No rows are deleted. Workout history is never modified.

---

## Environment Variables

| Variable         | Default | Description                         |
|------------------|---------|-------------------------------------|
| `RETENTION_DAYS` | `30`    | Purge rawImportText older than N days |
| `DATABASE_URL`   | —       | Standard Postgres connection string  |
