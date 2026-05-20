import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { serializeDates, camelCaseKeys, snakeCaseKeys } from "../utils/serialize";
import {
  GetDashboardStatsResponse,
  GetRevenueChartResponse,
  GetDashboardOrdersResponse,
  GetDashboardProductsResponse,
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  DeleteProductParams,
  GetCustomerAnalyticsResponse,
  GetTopProductsResponse,
  ListPromotionsResponse,
  CreatePromotionBody,
  GetDashboardOrdersQueryParams,
} from "#api-zod";

const DEMO_MERCHANT_ID = 1;

export async function stats(_req: Request, res: Response): Promise<void> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", DEMO_MERCHANT_ID);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const camelOrders = camelCaseKeys(orders ?? []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = camelOrders.filter(
    (o: { createdAt: string }) => new Date(o.createdAt) >= today,
  );
  const pendingOrders = camelOrders.filter(
    (o: { status: string }) =>
      o.status === "pending" ||
      o.status === "preparing" ||
      o.status === "confirmed",
  );
  const totalRevenue = camelOrders.reduce(
    (sum: number, o: { total?: number }) => sum + (o.total ?? 0),
    0,
  );
  const todayRevenue = todayOrders.reduce(
    (sum: number, o: { total?: number }) => sum + (o.total ?? 0),
    0,
  );
  const avgOrderValue =
    camelOrders.length > 0 ? totalRevenue / camelOrders.length : 0;

  const uniqueCustomers = new Set(
    camelOrders.map((o: { customerName?: string }) => o.customerName),
  ).size;

  res.json(
    GetDashboardStatsResponse.parse({
      totalRevenue,
      todayRevenue,
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      totalOrders: camelOrders.length,
      totalCustomers: uniqueCustomers,
      newCustomersThisWeek: Math.min(uniqueCustomers, 12),
      avgOrderValue,
      growthRate: 18.5,
    }),
  );
}

export async function revenueChart(
  _req: Request,
  res: Response,
): Promise<void> {
  const data: Array<{ date: string; revenue: number; orders: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().split("T")[0] as string,
      revenue: Math.floor(Math.random() * 800 + 200),
      orders: Math.floor(Math.random() * 30 + 5),
    });
  }
  res.json(GetRevenueChartResponse.parse(data));
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const query = GetDashboardOrdersQueryParams.safeParse(req.query);
  const status = query.success ? query.data.status : undefined;

  let queryBuilder = supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", DEMO_MERCHANT_ID)
    .order("created_at", { ascending: true });

  if (status) queryBuilder = queryBuilder.eq("status", status);

  const { data: orders, error } = await queryBuilder;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (orders ?? []).map((o: Record<string, unknown>) => {
    const camelOrder = camelCaseKeys(o);
    return { ...camelOrder, merchantName: "My Restaurant" };
  });

  res.json(GetDashboardOrdersResponse.parse(serializeDates(result)));
}

export async function listProducts(
  _req: Request,
  res: Response,
): Promise<void> {
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", DEMO_MERCHANT_ID);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (products ?? []).map((p: Record<string, unknown>) => {
    const camelProduct = camelCaseKeys(p);
    return { ...camelProduct, merchantName: "My Restaurant" };
  });

  res.json(GetDashboardProductsResponse.parse(serializeDates(result)));
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys({ ...parsed.data, merchantId: DEMO_MERCHANT_ID });
  const { data, error } = await supabase
    .from("products")
    .insert(dbData)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const product = camelCaseKeys(data?.[0]);
  res
    .status(201)
    .json(serializeDates({ ...product, merchantName: "My Restaurant" }));
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys(parsed.data);
  const { data, error } = await supabase
    .from("products")
    .update(dbData)
    .eq("id", params.data.id)
    .eq("merchant_id", DEMO_MERCHANT_ID)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const product = data?.[0];
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const camelProduct = camelCaseKeys(product);
  res.json(serializeDates({ ...camelProduct, merchantName: "My Restaurant" }));
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", params.data.id)
    .eq("merchant_id", DEMO_MERCHANT_ID);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.sendStatus(204);
}

export async function analytics(_req: Request, res: Response): Promise<void> {
  const topOrderTimes = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count:
      h >= 11 && h <= 14
        ? Math.floor(Math.random() * 30 + 20)
        : h >= 18 && h <= 21
          ? Math.floor(Math.random() * 40 + 25)
          : Math.floor(Math.random() * 10 + 2),
  }));

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const orderHeatmap = days.flatMap((day) =>
    Array.from({ length: 24 }, (_, h) => ({
      day,
      hour: h,
      count: Math.floor(Math.random() * 15),
    })),
  );

  res.json(
    GetCustomerAnalyticsResponse.parse({
      retentionRate: 68.4,
      repeatBuyerRate: 42.1,
      totalCustomers: 847,
      newCustomers: 124,
      topOrderTimes,
      orderHeatmap,
      demographics: [
        { label: "18-24", value: 28 },
        { label: "25-34", value: 38 },
        { label: "35-44", value: 20 },
        { label: "45+", value: 14 },
      ],
    }),
  );
}

export async function topProducts(_req: Request, res: Response): Promise<void> {
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", DEMO_MERCHANT_ID)
    .limit(5);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (products ?? []).map((p: Record<string, unknown>, i: number) => {
    const camelProduct = camelCaseKeys(p) as {
      id: number;
      name: string;
      image: string;
    };
    return {
      productId: camelProduct.id,
      name: camelProduct.name,
      image: camelProduct.image,
      totalSold: Math.floor(Math.random() * 200 + 50),
      revenue: Math.floor(Math.random() * 2000 + 500),
      rank: i + 1,
    };
  });

  res.json(GetTopProductsResponse.parse(result));
}

export async function listPromotions(
  _req: Request,
  res: Response,
): Promise<void> {
  const { data: promotions, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("merchant_id", DEMO_MERCHANT_ID);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = camelCaseKeys(promotions ?? []);
  res.json(ListPromotionsResponse.parse(serializeDates(result)));
}

export async function createPromotion(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys({
    ...parsed.data,
    merchantId: DEMO_MERCHANT_ID,
  });
  const { data, error } = await supabase
    .from("promotions")
    .insert(dbData)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const promotion = camelCaseKeys(data?.[0]);
  res.status(201).json(serializeDates(promotion));
}
