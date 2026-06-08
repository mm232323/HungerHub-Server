import type { Request, Response } from "express";
import { supabase } from '../lib/supabase.js';
import {
  ListProductsResponse,
  GetProductResponse,
  GetTrendingProductsResponse,
  GetProductParams,
  ListProductsQueryParams,
} from '../api-zod/index.js';
import { serializeDates, camelCaseKeys } from "../utils/serialize.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = ListProductsQueryParams.safeParse(req.query);
  const category = query.success ? query.data.category : undefined;
  const search = query.success ? query.data.search : undefined;
  const merchantId =
    query.success && query.data.merchantId
      ? Number(query.data.merchantId)
      : undefined;
  const limit =
    query.success && query.data.limit ? Number(query.data.limit) : 20;
  const offset =
    query.success && query.data.offset ? Number(query.data.offset) : 0;

  let queryBuilder = supabase.from("products").select(`
      *,
      merchants (
        name,
        slug
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

  const result = (products ?? []).map((p: Record<string, unknown>) => {
    const camelProduct = camelCaseKeys(p) as {
      merchants?: { name?: string; slug?: string };
    };
    const merchantName = camelProduct.merchants?.name ?? null;
    const merchantSlug = camelProduct.merchants?.slug ?? null;
    const { merchants: _m, ...rest } = camelProduct;
    return { ...rest, merchantName, merchantSlug };
  });

  res.json(ListProductsResponse.parse(serializeDates(result)));
}

export async function trending(_req: Request, res: Response): Promise<void> {
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      *,
      merchants (
        name,
        slug
      )
    `)
    .eq("is_trending", true)
    .limit(10);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (products ?? []).map((p: Record<string, unknown>) => {
    const camelProduct = camelCaseKeys(p) as {
      merchants?: { name?: string; slug?: string };
    };
    const merchantName = camelProduct.merchants?.name ?? null;
    const merchantSlug = camelProduct.merchants?.slug ?? null;
    const { merchants: _m, ...rest } = camelProduct;
    return { ...rest, merchantName, merchantSlug };
  });

  res.json(GetTrendingProductsResponse.parse(serializeDates(result)));
}

export async function getById(req: Request, res: Response): Promise<void> {
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
        name,
        slug
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

  const camelProduct = camelCaseKeys(product) as {
    merchants?: { name?: string; slug?: string };
  };
  const merchantName = camelProduct.merchants?.name ?? null;
  const merchantSlug = camelProduct.merchants?.slug ?? null;
  const { merchants: _m, ...rest } = camelProduct;

  res.json(
    GetProductResponse.parse(serializeDates({ ...rest, merchantName, merchantSlug })),
  );
}

export async function getReviews(req: Request, res: Response): Promise<void> {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", params.data.id)
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(serializeDates((reviews ?? []).map((r) => camelCaseKeys(r))));
}
