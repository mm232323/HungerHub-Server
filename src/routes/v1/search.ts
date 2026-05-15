import { Router, type IRouter } from "express";
import { ilike, or } from "drizzle-orm";
import { db, merchantsTable, productsTable } from "@workspace/db";
import { SearchResponse, SearchQueryParams } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const query = SearchQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const q = query.data.q;

  const [merchants, products] = await Promise.all([
    db.select().from(merchantsTable).where(
      or(ilike(merchantsTable.name, `%${q}%`), ilike(merchantsTable.cuisineType, `%${q}%`))
    ).limit(5),
    db.select().from(productsTable).where(
      or(ilike(productsTable.name, `%${q}%`), ilike(productsTable.description, `%${q}%`))
    ).limit(10),
  ]);

  const merchantsWithFollow = merchants.map((m) => ({ ...m, isFollowing: false }));
  const productsWithMerchant = products.map((p) => ({ ...p, merchantName: null }));

  res.json(SearchResponse.parse(serializeDates({ merchants: merchantsWithFollow, products: productsWithMerchant })));
});

export default router;
