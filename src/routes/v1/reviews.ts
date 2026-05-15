import { Router, type IRouter } from "express";
import { db, reviewsTable } from "@workspace/db";
import { CreateReviewBody } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.post("/reviews", async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [review] = await db.insert(reviewsTable).values(parsed.data).returning();
  res.status(201).json(serializeDates(review));
});

export default router;
