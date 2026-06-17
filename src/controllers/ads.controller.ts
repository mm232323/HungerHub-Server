import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import {
  serializeDates,
  camelCaseKeys,
  snakeCaseKeys,
} from "../utils/serialize.js";
import { CreateAdBody, AdResponse, UpdateAdBody } from "../api-zod/index.js";

async function getMerchantId(req: Request): Promise<number> {
  const username = req.headers["x-owner-user-name"] as string;
  if (!username) {
    throw new Error("Unauthorized: missing owner username");
  }

  try {
    const { data: merchants, error } = await supabase
      .from("merchants")
      .select("id")
      .eq("owner_user_name", username)
      .limit(1);

    const merchant = merchants?.[0];

    if (error || !merchant) {
      throw new Error("Not a merchant");
    }

    return merchant.id;
  } catch (e: any) {
    if (
      e.message === "Not a merchant" ||
      e.message.startsWith("Unauthorized")
    ) {
      throw e;
    }
    throw new Error("Not a merchant");
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  let merchantId: number;
  try {
    merchantId = await getMerchantId(req);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
    return;
  }

  const parsed = CreateAdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Rate Limiting: Max 3 ads per week for this merchant
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: recentAds, error: recentAdsError } = await supabase
    .from("ads")
    .select("id")
    .eq("merchant_id", merchantId)
    .gte("created_at", oneWeekAgo.toISOString());

  if (recentAdsError) {
    res.status(500).json({ error: recentAdsError.message });
    return;
  }

  if (recentAds && recentAds.length >= 3) {
    res
      .status(429)
      .json({
        error:
          "Maximum weekly budget of 3 ads reached. Please try again next week.",
      });
    return;
  }

  const dbData = snakeCaseKeys({
    ...parsed.data,
    merchantId,
  });

  const { data, error } = await supabase
    .from("ads")
    .insert(dbData)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const ad = camelCaseKeys(data?.[0]);
  res.status(201).json(AdResponse.parse(serializeDates(ad)));
}

export async function list(req: Request, res: Response): Promise<void> {
  let merchantId: number;
  try {
    merchantId = await getMerchantId(req);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
    return;
  }

  const { data: ads, error } = await supabase
    .from("ads")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = camelCaseKeys(ads ?? []);
  res.json(serializeDates(result));
}

export async function update(req: Request, res: Response): Promise<void> {
  let merchantId: number;
  try {
    merchantId = await getMerchantId(req);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
    return;
  }

  const parsed = UpdateAdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id } = req.params;
  const dbData = snakeCaseKeys(parsed.data);

  const { data, error } = await supabase
    .from("ads")
    .update(dbData)
    .eq("id", id)
    .eq("merchant_id", merchantId)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const ad = camelCaseKeys(data?.[0]);
  res.json(AdResponse.parse(serializeDates(ad)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  let merchantId: number;
  try {
    merchantId = await getMerchantId(req);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
    return;
  }

  const { id } = req.params;
  const { error } = await supabase
    .from("ads")
    .delete()
    .eq("id", id)
    .eq("merchant_id", merchantId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(204).send();
}
