import { Router } from "express";
import { db } from "@workspace/db";
import { userFeedbackTable } from "@workspace/db/schema";

const router = Router();

router.post("/api/feedback", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { message } = req.body ?? {};
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (message.length > 5000) {
    res.status(400).json({ error: "message too long (max 5000 chars)" });
    return;
  }

  try {
    await db.insert(userFeedbackTable).values({
      userId: user.id,
      message: message.trim(),
    });

    const targetEmail = process.env.FEEDBACK_EMAIL;
    if (targetEmail) {
      console.log(`[feedback] New feedback from user ${user.id} — recipient: ${targetEmail}`);
    } else {
      console.log(`[feedback] New feedback from user ${user.id} (FEEDBACK_EMAIL env var not set)`);
    }
    console.log(`[feedback] Message (${message.length} chars): ${message.slice(0, 100)}${message.length > 100 ? "..." : ""}`);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[feedback] DB insert failed:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

export default router;
