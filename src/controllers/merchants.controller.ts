import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { serializeDates, camelCaseKeys } from "../utils/serialize";
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
} from "#api-zod";
import { getSessionId } from "./session";

export async function list(req: Request, res: Response): Promise<void> {
  const query = ListMerchantsQueryParams.safeParse(req.query);
  const category = query.success ? query.data.category : undefined;
  const trending = query.success ? query.data.trending : undefined;
  const search = query.success ? query.data.search : undefined;
  const limit =
    query.success && query.data.limit ? Number(query.data.limit) : 20;
  const offset =
    query.success && query.data.offset ? Number(query.data.offset) : 0;

  let queryBuilder = supabase.from("merchants").select("*");

  if (category) queryBuilder = queryBuilder.eq("cuisine_type", category);
  if (trending) queryBuilder = queryBuilder.eq("is_trending", true);
  if (search) queryBuilder = queryBuilder.ilike("name", `%${search}%`);

  queryBuilder = queryBuilder.range(offset, offset + limit - 1);

  const { data: merchants, error } = await queryBuilder;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const sessionId = getSessionId(req);
  const { data: follows } = await supabase
    .from("merchant_follows")
    .select("*")
    .eq("session_id", sessionId);

  const followedIds = new Set(
    (follows ?? []).map((f: { merchant_id: number }) => f.merchant_id),
  );

  const result = (merchants ?? []).map((m: Record<string, unknown>) => {
    const camelMerchant = camelCaseKeys(m) as { id: number };
    return { ...camelMerchant, isFollowing: followedIds.has(camelMerchant.id) };
  });

  res.json(ListMerchantsResponse.parse(serializeDates(result)));
}

export async function trending(_req: Request, res: Response): Promise<void> {
  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("is_featured", true)
    .limit(10);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const sessionId = getSessionId(_req);
  const { data: follows } = await supabase
    .from("merchant_follows")
    .select("*")
    .eq("session_id", sessionId);

  const followedIds = new Set(
    (follows ?? []).map((f: { merchant_id: number }) => f.merchant_id),
  );

  const result = (merchants ?? []).map((m: Record<string, unknown>) => {
    const camelMerchant = camelCaseKeys(m) as { id: number };
    return { ...camelMerchant, isFollowing: followedIds.has(camelMerchant.id) };
  });

  res.json(GetTrendingMerchantsResponse.parse(serializeDates(result)));
}

export async function getById(req: Request, res: Response): Promise<void> {
  const params = GetMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", params.data.id)
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const merchant = merchants?.[0];
  if (!merchant) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }

  const sessionId = getSessionId(req);
  const { data: follows } = await supabase
    .from("merchant_follows")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("session_id", sessionId)
    .limit(1);

  const isFollowing = (follows ?? []).length > 0;
  const camelMerchant = camelCaseKeys(merchant);

  res.json(
    GetMerchantResponse.parse(
      serializeDates({ ...camelMerchant, isFollowing }),
    ),
  );
}

export async function follow(req: Request, res: Response): Promise<void> {
  const params = FollowMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: merchants } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", params.data.id)
    .limit(1);

  const merchant = merchants?.[0];
  if (!merchant) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }

  const sessionId = getSessionId(req);
  const { data: existingFollows } = await supabase
    .from("merchant_follows")
    .select("*")
    .eq("merchant_id", params.data.id)
    .eq("session_id", sessionId)
    .limit(1);

  const existing = existingFollows?.[0];

  let isFollowing: boolean;
  let followersCount: number;

  if (existing) {
    await supabase.from("merchant_follows").delete().eq("id", existing.id);
    const newCount = Math.max(0, (merchant.followers_count ?? 0) - 1);
    await supabase
      .from("merchants")
      .update({ followers_count: newCount })
      .eq("id", params.data.id);
    isFollowing = false;
    followersCount = newCount;
  } else {
    await supabase
      .from("merchant_follows")
      .insert({ merchant_id: params.data.id, session_id: sessionId });
    const newCount = (merchant.followers_count ?? 0) + 1;
    await supabase
      .from("merchants")
      .update({ followers_count: newCount })
      .eq("id", params.data.id);
    isFollowing = true;
    followersCount = newCount;
  }

  res.json(FollowMerchantResponse.parse({ isFollowing, followersCount }));
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const params = GetMerchantProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: merchants } = await supabase
    .from("merchants")
    .select("name")
    .eq("id", params.data.id)
    .limit(1);

  const merchantName = merchants?.[0]?.name ?? null;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", params.data.id);

  const result = (products ?? []).map((p) => {
    const camelProduct = camelCaseKeys(p);
    return { ...camelProduct, merchantName };
  });

  res.json(GetMerchantProductsResponse.parse(serializeDates(result)));
}

export async function listReviews(req: Request, res: Response): Promise<void> {
  const params = GetMerchantReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("merchant_id", params.data.id);

  const result = camelCaseKeys(reviews ?? []);
  res.json(GetMerchantReviewsResponse.parse(serializeDates(result)));
}
