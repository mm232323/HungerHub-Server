import { Router, type IRouter } from "express";
import { supabase } from "#supabase";
import { ListCategoriesResponse } from "#api-zod";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const { data: categories, error } = await supabase.from("categories").select("*");
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(ListCategoriesResponse.parse(categories));
});

export default router;
