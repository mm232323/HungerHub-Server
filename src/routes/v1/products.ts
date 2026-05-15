import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";
import { db, productsTable, merchantsTable } from "@workspace/db";
import {
  ListProductsResponse,
  GetProductResponse,
  GetTrendingProductsResponse,
  GetProductParams,
  ListProductsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  const category = query.success ? query.data.category : undefined;
  const search = query.success ? query.data.search : undefined;
  const merchantId = query.success && query.data.merchantId ? Number(query.data.merchantId) : undefined;
  const limit = query.success && query.data.limit ? Number(query.data.limit) : 20;
  const offset = query.success && query.data.offset ? Number(query.data.offset) : 0;

  const conditions = [];
  if (category) conditions.push(eq(productsTable.category, category));
  if (merchantId) conditions.push(eq(productsTable.merchantId, merchantId));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const products = await db
    .select()
    .from(productsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  const merchants = await db.select().from(merchantsTable);
  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

  const result = products.map((p) => ({ ...p, merchantName: merchantMap.get(p.merchantId) ?? null }));
  res.json(ListProductsResponse.parse(serializeDates(result)));
});

router.get("/products/trending", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.isTrending, true)).limit(10);
  const merchants = await db.select().from(merchantsTable);
  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
  const result = products.map((p) => ({ ...p, merchantName: merchantMap.get(p.merchantId) ?? null }));
  res.json(GetTrendingProductsResponse.parse(serializeDates(result)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, product.merchantId));
  res.json(GetProductResponse.parse(serializeDates({ ...product, merchantName: merchant?.name ?? null })));
});

export default router;
