/**
 * purge-raw-import-text.ts
 *
 * Alignment Item 3 — Raw import retention enforcement.
 *
 * NULLs the `rawImportText` column on external_workouts rows where the workout
 * is older than RETENTION_DAYS (default 30). All other columns (movements,
 * label, confidence, etc.) are left intact.
 *
 * Run manually:
 *   pnpm --filter @workspace/scripts run purge-raw-import-text
 *
 * Or with a custom retention window (env override):
 *   RETENTION_DAYS=7 pnpm --filter @workspace/scripts run purge-raw-import-text
 *
 * See docs/RETENTION_RUNBOOK.md for full operational guidance.
 */

import { db, externalWorkoutsTable } from "@workspace/db";
import { lt, isNotNull, and, sql } from "drizzle-orm";

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS ?? "30", 10);

async function purgeRawImportText(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  console.log(`[retention] Purging rawImportText older than ${RETENTION_DAYS} days (before ${cutoff.toISOString()})`);

  const result = await db
    .update(externalWorkoutsTable)
    .set({ rawImportText: null })
    .where(
      and(
        lt(externalWorkoutsTable.createdAt, cutoff),
        isNotNull(externalWorkoutsTable.rawImportText)
      )
    )
    .returning({ id: externalWorkoutsTable.id });

  console.log(`[retention] Purged rawImportText from ${result.length} workout row(s).`);
}

purgeRawImportText()
  .then(() => {
    console.log("[retention] Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[retention] Fatal error:", err);
    process.exit(1);
  });
