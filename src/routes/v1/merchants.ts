import { Router, type IRouter } from "express";
import { eq, ilike, and, or } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";
import {
  db,
  merchantsTable,
  productsTable,
  reviewsTable,
  merchantFollowsTable,
} from "@workspace/db";
import {
  ListMerchantsResponse,
  GetMerchantResponse,
  FollowMerchantResponse,
  GetMerchantProductsResponse,
  GetMerchantReviewsResponse,
  GetTrendingMerchantsResponse,
  GetMerchantParams,
  FollowMerchantParams,
  GetMerchantProductsParams,
  GetMerchantReviewsParams,
  ListMerchantsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getSessionId(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers["x-session-id"] as string) || req.ip || "anonymous";
}

router.get("/merchants", async (req, res): Promise<void> => {
  const query = ListMerchantsQueryParams.safeParse(req.query);
  const category = query.success ? query.data.category : undefined;
  const trending = query.success ? query.data.trending : undefined;
  const search = query.success ? query.data.search : undefined;
  const limit = query.success && query.data.limit ? Number(query.data.limit) : 20;
  const offset = query.success && query.data.offset ? Number(query.data.offset) : 0;

  const conditions = [];
  if (category) conditions.push(eq(merchantsTable.cuisineType, category));
  if (trending) conditions.push(eq(merchantsTable.isTrending, true));
  if (search) conditions.push(ilike(merchantsTable.name, `%${search}%`));

  const merchants = await db
    .select()
    .from(merchantsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  const sessionId = getSessionId(req as any);
  const follows = await db.select().from(merchantFollowsTable).where(eq(merchantFollowsTable.sessionId, sessionId));
  const followedIds = new Set(follows.map((f) => f.merchantId));

  const result = merchants.map((m) => ({ ...m, isFollowing: followedIds.has(m.id) }));
  res.json(ListMerchantsResponse.parse(serializeDates(result)));
});

router.get("/merchants/trending", async (req, res): Promise<void> => {
  const merchants = await db.select().from(merchantsTable).where(eq(merchantsTable.isTrending, true)).limit(10);
  const sessionId = getSessionId(req as any);
  const follows = await db.select().from(merchantFollowsTable).where(eq(merchantFollowsTable.sessionId, sessionId));
  const followedIds = new Set(follows.map((f) => f.merchantId));
  const result = merchants.map((m) => ({ ...m, isFollowing: followedIds.has(m.id) }));
  res.json(GetTrendingMerchantsResponse.parse(serializeDates(result)));
});

router.get("/merchants/:id", async (req, res): Promise<void> => {
  const params = GetMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, params.data.id));
  if (!merchant) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }

  const sessionId = getSessionId(req as any);
  const [follow] = await db
    .select()
    .from(merchantFollowsTable)
    .where(and(eq(merchantFollowsTable.merchantId, merchant.id), eq(merchantFollowsTable.sessionId, sessionId)));

  res.json(GetMerchantResponse.parse(serializeDates({ ...merchant, isFollowing: !!follow })));
});

router.post("/merchants/:id/follow", async (req, res): Promise<void> => {
  const params = FollowMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, params.data.id));
  if (!merchant) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }

  const sessionId = getSessionId(req as any);
  const [existing] = await db
    .select()
    .from(merchantFollowsTable)
    .where(and(eq(merchantFollowsTable.merchantId, params.data.id), eq(merchantFollowsTable.sessionId, sessionId)));

  let isFollowing: boolean;
  let followersCount: number;

  if (existing) {
    await db.delete(merchantFollowsTable).where(eq(merchantFollowsTable.id, existing.id));
    const newCount = Math.max(0, merchant.followersCount - 1);
    await db.update(merchantsTable).set({ followersCount: newCount }).where(eq(merchantsTable.id, params.data.id));
    isFollowing = false;
    followersCount = newCount;
  } else {
    await db.insert(merchantFollowsTable).values({ merchantId: params.data.id, sessionId });
    const newCount = merchant.followersCount + 1;
    await db.update(merchantsTable).set({ followersCount: newCount }).where(eq(merchantsTable.id, params.data.id));
    isFollowing = true;
    followersCount = newCount;
  }

  res.json(FollowMerchantResponse.parse({ isFollowing, followersCount }));
});

router.get("/merchants/:id/products", async (req, res): Promise<void> => {
  const params = GetMerchantProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, params.data.id));

  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.merchantId, params.data.id));

  const result = products.map((p) => ({ ...p, merchantName: merchant?.name ?? null }));
  res.json(GetMerchantProductsResponse.parse(serializeDates(result)));
});

router.get("/merchants/:id/reviews", async (req, res): Promise<void> => {
  const params = GetMerchantReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.merchantId, params.data.id));
  res.json(GetMerchantReviewsResponse.parse(serializeDates(reviews)));
});

export default router;
