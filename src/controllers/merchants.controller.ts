import type { Request, Response } from "express";
import { supabase } from '../lib/supabase.js';
import { serializeDates, camelCaseKeys } from "../utils/serialize.js";
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
  CreateMerchantBody,
} from '../api-zod/index.js';
import { getSessionId } from "./session.js";

export async function create(req: Request, res: Response): Promise<void> {
  const body = CreateMerchantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const slug = body.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const { data: merchants, error } = await supabase
    .from("merchants")
    .insert([
      {
        name: body.data.name,
        slug,
        bio: body.data.bio,
        cuisine_type: body.data.cuisineType,
        delivery_time: body.data.deliveryTime,
        delivery_fee: body.data.deliveryFee,
        address: body.data.address,
        country: body.data.country,
        is_open: body.data.isOpen ?? false,
        profile_image: body.data.profileImage ?? "https://picsum.photos/400/400",
        cover_image: body.data.coverImage ?? "https://picsum.photos/1200/400",
        tags: body.data.tags ?? [],
        rating: 0,
        followers_count: 0,
        owner_user_name: body.data.owner_user_name,
        latitude: (body.data as any).latitude ?? null,
        longitude: (body.data as any).longitude ?? null,
      },
    ])
    .select("*");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const merchant = merchants?.[0];
  if (!merchant) {
    res.status(500).json({ error: "Failed to create merchant" });
    return;
  }

  const camelMerchant = camelCaseKeys(merchant);
  res.status(201).json(
    GetMerchantResponse.parse(
      serializeDates({ ...camelMerchant, isFollowing: false }),
    ),
  );
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = ListMerchantsQueryParams.safeParse(req.query);
  const category = query.success ? query.data.category : undefined;
  const trending = query.success ? query.data.trending : undefined;
  const search = query.success ? query.data.search : undefined;
  const ownerUserName = query.success && "owner_user_name" in query.data ? query.data.owner_user_name : undefined;
  const limit =
    query.success && query.data.limit ? Number(query.data.limit) : 20;
  const offset =
    query.success && query.data.offset ? Number(query.data.offset) : 0;

  const lat = query.success ? query.data.lat : undefined;
  const lng = query.success ? query.data.lng : undefined;

  let queryBuilder;

  if (lat !== undefined && lng !== undefined) {
    queryBuilder = supabase.rpc('get_nearby_merchants', { user_lat: lat, user_lng: lng, radius_km: 50, limit_count: limit });
    if (category) queryBuilder = queryBuilder.eq("cuisine_type", category);
    if (trending) queryBuilder = queryBuilder.eq("is_trending", true);
    if (search) queryBuilder = queryBuilder.ilike("name", `%${search}%`);
    if (ownerUserName) queryBuilder = queryBuilder.eq("owner_user_name", ownerUserName);
  } else {
    queryBuilder = supabase.from("merchants").select("*");
    if (category) queryBuilder = queryBuilder.eq("cuisine_type", category);
    if (trending) queryBuilder = queryBuilder.eq("is_trending", true);
    if (search) queryBuilder = queryBuilder.ilike("name", `%${search}%`);
    if (ownerUserName) queryBuilder = queryBuilder.eq("owner_user_name", ownerUserName);
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);
  }

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

export async function trending(req: Request, res: Response): Promise<void> {
  const query = ListMerchantsQueryParams.safeParse(req.query);
  const lat = query.success ? query.data.lat : undefined;
  const lng = query.success ? query.data.lng : undefined;

  let merchantsQuery;

  if (lat !== undefined && lng !== undefined) {
    merchantsQuery = supabase
      .rpc('get_nearby_merchants', { user_lat: lat, user_lng: lng, radius_km: 50, limit_count: 10 });
  } else {
    merchantsQuery = supabase
      .from("merchants")
      .select("*")
      .order("followers_count", { ascending: false })
      .order("rating", { ascending: false })
      .limit(10);
  }

  const { data: merchants, error } = await merchantsQuery;
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

  res.json(GetTrendingMerchantsResponse.parse(serializeDates(result)));
}

export async function followed(req: Request, res: Response): Promise<void> {
  const sessionId = getSessionId(req);
  const { data: follows, error: followsError } = await supabase
    .from("merchant_follows")
    .select("merchant_id")
    .eq("session_id", sessionId);

  if (followsError) {
    res.status(500).json({ error: followsError.message });
    return;
  }

  const followedIds = (follows ?? []).map((f) => f.merchant_id);

  if (followedIds.length === 0) {
    res.json(ListMerchantsResponse.parse(serializeDates([])));
    return;
  }

  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("*")
    .in("id", followedIds);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (merchants ?? []).map((m: Record<string, unknown>) => {
    const camelMerchant = camelCaseKeys(m) as { id: number };
    return { ...camelMerchant, isFollowing: true };
  });

  res.json(ListMerchantsResponse.parse(serializeDates(result)));
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

export async function getBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  if (!slug) {
    res.status(400).json({ error: "Slug is required" });
    return;
  }

  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("slug", slug)
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
    const { error: delErr } = await supabase.from("merchant_follows").delete().eq("merchant_id", params.data.id).eq("session_id", sessionId);
    const newCount = Math.max(0, (merchant.followers_count ?? 0) - 1);
    await supabase
      .from("merchants")
      .update({ followers_count: newCount })
      .eq("id", params.data.id);
    isFollowing = false;
    followersCount = newCount;
  } else {
    const { error: insErr } = await supabase
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
    .select("name, slug")
    .eq("id", params.data.id)
    .limit(1);

  const merchantName = merchants?.[0]?.name ?? null;
  const merchantSlug = merchants?.[0]?.slug ?? null;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", params.data.id);

  const result = (products ?? []).map((p) => {
    const camelProduct = camelCaseKeys(p);
    return { ...camelProduct, merchantName, merchantSlug };
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
