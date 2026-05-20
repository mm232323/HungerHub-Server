import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { CreateReviewBody } from "#api-zod";
import { serializeDates, camelCaseKeys, snakeCaseKeys } from "../utils/serialize";

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
  res.status(201).json(serializeDates(review));
}
