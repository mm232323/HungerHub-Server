import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { ListCategoriesResponse } from "#api-zod";

export async function list(_req: Request, res: Response): Promise<void> {
  const { data: categories, error } = await supabase
    .from("categories")
    .select("*");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(ListCategoriesResponse.parse(categories));
}
