import type { Request, Response } from "express";
import { supabase } from '../lib/supabase.js';
import { CreateReviewBody } from '../api-zod/index.js';
import { serializeDates, camelCaseKeys, snakeCaseKeys } from "../utils/serialize.js";

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys(parsed.data);
  const { data, error } = await supabase
    .from("reviews")
    .insert(dbData)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const review = camelCaseKeys(data?.[0]);

  // Update product rating if this is a product review
  if (parsed.data.productId) {
    const { data: productReviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("product_id", parsed.data.productId);

    if (productReviews && productReviews.length > 0) {
      const total = productReviews.reduce((sum, r) => sum + r.rating, 0);
      const count = productReviews.length;
      const newRating = total / count;

      await supabase
        .from("products")
        .update({ rating: newRating, review_count: count })
        .eq("id", parsed.data.productId);
    }
  }

  res.status(201).json(serializeDates(review));
}
