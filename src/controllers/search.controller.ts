import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { SearchResponse, SearchQueryParams } from "#api-zod";
import { serializeDates, camelCaseKeys } from "../utils/serialize.js";

export async function search(req: Request, res: Response): Promise<void> {
  const query = SearchQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const q = query.data.q;

  const [merchantsResult, productsResult] = await Promise.all([
    supabase
      .from("merchants")
      .select("*")
      .or(`name.ilike.%${q}%,cuisine_type.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("products")
      .select("*")
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(10),
  ]);

  if (merchantsResult.error || productsResult.error) {
    res.status(500).json({
      error:
        merchantsResult.error?.message || productsResult.error?.message,
    });
    return;
  }

  const merchants = camelCaseKeys(merchantsResult.data ?? []);
  const products = camelCaseKeys(productsResult.data ?? []);

  const merchantsWithFollow = merchants.map((m: Record<string, unknown>) => ({
    ...m,
    isFollowing: false,
  }));
  const productsWithMerchant = products.map((p: Record<string, unknown>) => ({
    ...p,
    merchantName: null,
  }));

  res.json(
    SearchResponse.parse(
      serializeDates({
        merchants: merchantsWithFollow,
        products: productsWithMerchant,
      }),
    ),
  );
}
