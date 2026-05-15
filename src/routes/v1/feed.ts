import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, feedPostsTable, merchantsTable, feedLikesTable, feedSavesTable } from "@workspace/db";
import {
  GetFeedResponse,
  LikeFeedPostResponse,
  SaveFeedPostResponse,
  GetFeedStoriesResponse,
  LikeFeedPostParams,
  SaveFeedPostParams,
  GetFeedQueryParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

function getSessionId(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers["x-session-id"] as string) || req.ip || "anonymous";
}

router.get("/feed", async (req, res): Promise<void> => {
  const query = GetFeedQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? Number(query.data.limit) : 10;
  const offset = query.success && query.data.offset ? Number(query.data.offset) : 0;

  const posts = await db.select().from(feedPostsTable).limit(limit).offset(offset).orderBy(feedPostsTable.createdAt);
  const merchants = await db.select().from(merchantsTable);
  const merchantMap = new Map(merchants.map((m) => [m.id, m]));

  const sessionId = getSessionId(req as any);
  const likes = await db.select().from(feedLikesTable).where(eq(feedLikesTable.sessionId, sessionId));
  const saves = await db.select().from(feedSavesTable).where(eq(feedSavesTable.sessionId, sessionId));
  const likedIds = new Set(likes.map((l) => l.feedPostId));
  const savedIds = new Set(saves.map((s) => s.feedPostId));

  const result = posts.map((p) => {
    const merchant = merchantMap.get(p.merchantId);
    return {
      ...p,
      merchant: merchant ? { ...merchant, isFollowing: false } : null,
      product: null,
      isLiked: likedIds.has(p.id),
      isSaved: savedIds.has(p.id),
    };
  });

  res.json(GetFeedResponse.parse(serializeDates(result)));
});

router.post("/feed/:id/like", async (req, res): Promise<void> => {
  const params = LikeFeedPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db.select().from(feedPostsTable).where(eq(feedPostsTable.id, params.data.id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const sessionId = getSessionId(req as any);
  const [existing] = await db
    .select()
    .from(feedLikesTable)
    .where(and(eq(feedLikesTable.feedPostId, params.data.id), eq(feedLikesTable.sessionId, sessionId)));

  let isLiked: boolean;
  let likes: number;

  if (existing) {
    await db.delete(feedLikesTable).where(eq(feedLikesTable.id, existing.id));
    const newLikes = Math.max(0, post.likes - 1);
    await db.update(feedPostsTable).set({ likes: newLikes }).where(eq(feedPostsTable.id, params.data.id));
    isLiked = false;
    likes = newLikes;
  } else {
    await db.insert(feedLikesTable).values({ feedPostId: params.data.id, sessionId });
    const newLikes = post.likes + 1;
    await db.update(feedPostsTable).set({ likes: newLikes }).where(eq(feedPostsTable.id, params.data.id));
    isLiked = true;
    likes = newLikes;
  }

  res.json(LikeFeedPostResponse.parse({ isLiked, likes }));
});

router.post("/feed/:id/save", async (req, res): Promise<void> => {
  const params = SaveFeedPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db.select().from(feedPostsTable).where(eq(feedPostsTable.id, params.data.id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const sessionId = getSessionId(req as any);
  const [existing] = await db
    .select()
    .from(feedSavesTable)
    .where(and(eq(feedSavesTable.feedPostId, params.data.id), eq(feedSavesTable.sessionId, sessionId)));

  let isSaved: boolean;
  if (existing) {
    await db.delete(feedSavesTable).where(eq(feedSavesTable.id, existing.id));
    isSaved = false;
  } else {
    await db.insert(feedSavesTable).values({ feedPostId: params.data.id, sessionId });
    isSaved = true;
  }

  res.json(SaveFeedPostResponse.parse({ isSaved }));
});

router.get("/feed/stories", async (req, res): Promise<void> => {
  const merchants = await db.select().from(merchantsTable).limit(8);
  const result = merchants.map((m, i) => ({
    id: i + 1,
    merchantId: m.id,
    merchant: { ...m, isFollowing: false },
    image: m.coverImage,
    hasUnviewed: Math.random() > 0.3,
  }));
  res.json(GetFeedStoriesResponse.parse(serializeDates(result)));
});

export default router;
