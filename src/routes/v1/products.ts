import { Router, type IRouter } from "express";
import { supabase } from "#supabase";
import {
  ListProductsResponse,
  GetProductResponse,
  GetTrendingProductsResponse,
  GetProductParams,
  ListProductsQueryParams,
} from "#api-zod";
import { serializeDates, camelCaseKeys } from "../../utils/serialize";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  const category = query.success ? query.data.category : undefined;
  const search = query.success ? query.data.search : undefined;
  const merchantId = query.success && query.data.merchantId ? Number(query.data.merchantId) : undefined;
  const limit = query.success && query.data.limit ? Number(query.data.limit) : 20;
  const offset = query.success && query.data.offset ? Number(query.data.offset) : 0;

  let queryBuilder = supabase
    .from("products")
    .select(`
      *,
      merchants (
        name
      )
    `);

  if (category) queryBuilder = queryBuilder.eq("category", category);
  if (merchantId) queryBuilder = queryBuilder.eq("merchant_id", merchantId);
  if (search) queryBuilder = queryBuilder.ilike("name", `%${search}%`);

  queryBuilder = queryBuilder.range(offset, offset + limit - 1);

  const { data: products, error } = await queryBuilder;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (products || []).map((p: any) => {
    const camelProduct = camelCaseKeys(p);
    const merchantName = camelProduct.merchants?.name || null;
    delete camelProduct.merchants;
    return { ...camelProduct, merchantName };
  });

  res.json(ListProductsResponse.parse(serializeDates(result)));
});

router.get("/products/trending", async (_req, res): Promise<void> => {
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      *,
      merchants (
        name
      )
    `)
    .eq("is_trending", true)
    .limit(10);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (products || []).map((p: any) => {
    const camelProduct = camelCaseKeys(p);
    const merchantName = camelProduct.merchants?.name || null;
    delete camelProduct.merchants;
    return { ...camelProduct, merchantName };
  });

  res.json(GetTrendingProductsResponse.parse(serializeDates(result)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      *,
      merchants (
        name
      )
    `)
    .eq("id", params.data.id)
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const product = products?.[0];
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const camelProduct = camelCaseKeys(product);
  const merchantName = camelProduct.merchants?.name || null;
  delete camelProduct.merchants;

  res.json(GetProductResponse.parse(serializeDates({ ...camelProduct, merchantName })));
});

export default router;
