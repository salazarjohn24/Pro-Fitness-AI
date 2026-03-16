import { Router, type IRouter, type Request, type Response } from "express";
import { db, gymEnvironmentsTable, userProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function parseIdParam(param: string | string[] | undefined): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

router.get("/environments", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const environments = await db
    .select()
    .from(gymEnvironmentsTable)
    .where(eq(gymEnvironmentsTable.userId, req.user.id));

  res.json(environments);
});

router.post("/environments", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, type, equipment, isActive } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: "Name and type are required" });
    return;
  }

  if (isActive) {
    await db
      .update(gymEnvironmentsTable)
      .set({ isActive: false })
      .where(eq(gymEnvironmentsTable.userId, req.user.id));
  }

  const [env] = await db
    .insert(gymEnvironmentsTable)
    .values({
      userId: req.user.id,
      name,
      type,
      equipment: equipment ?? {},
      isActive: isActive ?? false,
    })
    .returning();

  if (isActive && env) {
    await db
      .update(userProfilesTable)
      .set({ activeEnvironmentId: env.id })
      .where(eq(userProfilesTable.userId, req.user.id));
  }

  res.json(env);
});

router.put("/environments/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const envId = parseIdParam(req.params.id);
  if (envId === null) {
    res.status(400).json({ error: "Invalid environment ID" });
    return;
  }

  const { name, type, equipment } = req.body;

  const [updated] = await db
    .update(gymEnvironmentsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(equipment !== undefined && { equipment }),
    })
    .where(
      and(
        eq(gymEnvironmentsTable.id, envId),
        eq(gymEnvironmentsTable.userId, req.user.id)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Environment not found" });
    return;
  }

  res.json(updated);
});

router.delete("/environments/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const envId = parseIdParam(req.params.id);
  if (envId === null) {
    res.status(400).json({ error: "Invalid environment ID" });
    return;
  }

  const [deleted] = await db
    .delete(gymEnvironmentsTable)
    .where(
      and(
        eq(gymEnvironmentsTable.id, envId),
        eq(gymEnvironmentsTable.userId, req.user.id)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Environment not found" });
    return;
  }

  if (deleted.isActive) {
    await db
      .update(userProfilesTable)
      .set({ activeEnvironmentId: null })
      .where(eq(userProfilesTable.userId, req.user.id));
  }

  res.json({ success: true });
});

router.patch("/environments/:id/activate", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const envId = parseIdParam(req.params.id);
  if (envId === null) {
    res.status(400).json({ error: "Invalid environment ID" });
    return;
  }

  const [target] = await db
    .select()
    .from(gymEnvironmentsTable)
    .where(
      and(
        eq(gymEnvironmentsTable.id, envId),
        eq(gymEnvironmentsTable.userId, req.user.id)
      )
    );

  if (!target) {
    res.status(404).json({ error: "Environment not found" });
    return;
  }

  await db
    .update(gymEnvironmentsTable)
    .set({ isActive: false })
    .where(eq(gymEnvironmentsTable.userId, req.user.id));

  const [activated] = await db
    .update(gymEnvironmentsTable)
    .set({ isActive: true })
    .where(eq(gymEnvironmentsTable.id, envId))
    .returning();

  await db
    .update(userProfilesTable)
    .set({ activeEnvironmentId: envId })
    .where(eq(userProfilesTable.userId, req.user.id));

  res.json(activated);
});

export default router;
