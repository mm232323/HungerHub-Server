import type { Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getAuth, createClerkClient } from "@clerk/express";
import {
  serializeDates,
  camelCaseKeys,
  snakeCaseKeys,
} from "../utils/serialize.js";
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
  UpdatePromotionBody,
  GetDashboardOrdersQueryParams,
} from "../api-zod/index.js";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || "",
});

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

export async function initMerchant(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);
  res.status(200).json({ merchantId });
}

export async function stats(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", merchantId);

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
  const deliveredOrders = camelOrders.filter(
    (o: any) => o.status === "delivered",
  );
  const deliveredTodayOrders = todayOrders.filter(
    (o: any) => o.status === "delivered",
  );

  const totalRevenue = deliveredOrders.reduce(
    (sum: number, o: { total?: number }) => sum + (o.total ?? 0),
    0,
  );
  const todayRevenue = deliveredTodayOrders.reduce(
    (sum: number, o: { total?: number }) => sum + (o.total ?? 0),
    0,
  );
  const avgOrderValue =
    deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

  const uniqueCustomers = new Set(
    deliveredOrders.map((o: { customerName?: string }) => o.customerName),
  ).size;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const thisMonthRevenue = deliveredOrders
    .filter((o: any) => new Date(o.createdAt) >= thirtyDaysAgo)
    .reduce((sum: number, o: any) => sum + (o.total ?? 0), 0);
  const lastMonthRevenue = deliveredOrders
    .filter(
      (o: any) =>
        new Date(o.createdAt) >= sixtyDaysAgo &&
        new Date(o.createdAt) < thirtyDaysAgo,
    )
    .reduce((sum: number, o: any) => sum + (o.total ?? 0), 0);
  const growthRate =
    lastMonthRevenue === 0
      ? thisMonthRevenue > 0
        ? 100
        : 0
      : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

  const thisMonthOrders = camelOrders.filter(
    (o: any) => new Date(o.createdAt) >= thirtyDaysAgo,
  ).length;
  const lastMonthOrders = camelOrders.filter(
    (o: any) =>
      new Date(o.createdAt) >= sixtyDaysAgo &&
      new Date(o.createdAt) < thirtyDaysAgo,
  ).length;
  const ordersGrowthRate =
    lastMonthOrders === 0
      ? thisMonthOrders > 0
        ? 100
        : 0
      : ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100;

  const thisMonthCustomers = new Set(
    deliveredOrders
      .filter((o: any) => new Date(o.createdAt) >= thirtyDaysAgo)
      .map((o: any) => o.customerName),
  ).size;
  const lastMonthCustomers = new Set(
    deliveredOrders
      .filter(
        (o: any) =>
          new Date(o.createdAt) >= sixtyDaysAgo &&
          new Date(o.createdAt) < thirtyDaysAgo,
      )
      .map((o: any) => o.customerName),
  ).size;
  const customersGrowthRate =
    lastMonthCustomers === 0
      ? thisMonthCustomers > 0
        ? 100
        : 0
      : ((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100;

  const customerFirstOrderDate = new Map<string, Date>();
  for (const order of deliveredOrders) {
    const customerName = order.customerName || "Guest User";
    const orderDate = new Date(order.createdAt);
    if (
      !customerFirstOrderDate.has(customerName) ||
      orderDate < customerFirstOrderDate.get(customerName)!
    ) {
      customerFirstOrderDate.set(customerName, orderDate);
    }
  }

  let newCustomersThisWeek = 0;
  for (const firstDate of customerFirstOrderDate.values()) {
    if (firstDate >= sevenDaysAgo) {
      newCustomersThisWeek++;
    }
  }

  res.json(
    GetDashboardStatsResponse.parse({
      totalRevenue,
      todayRevenue,
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      totalOrders: camelOrders.length,
      totalCustomers: uniqueCustomers,
      newCustomersThisWeek,
      avgOrderValue,
      growthRate: Math.round(growthRate * 10) / 10,
      ordersGrowthRate: Math.round(ordersGrowthRate * 10) / 10,
      customersGrowthRate: Math.round(customersGrowthRate * 10) / 10,
    }),
  );
}

export async function revenueChart(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("created_at, total, status")
    .eq("merchant_id", merchantId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const camelOrders = camelCaseKeys(orders ?? []).filter(
    (o: any) => o.status === "delivered",
  );

  const dataMap = new Map<string, { revenue: number; orders: number }>();

  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (dateStr) dataMap.set(dateStr, { revenue: 0, orders: 0 });
  }

  for (const order of camelOrders) {
    if (!order.createdAt) continue;
    const dateStr = new Date(order.createdAt).toISOString().split("T")[0];
    if (dateStr && dataMap.has(dateStr)) {
      const current = dataMap.get(dateStr)!;
      current.revenue += order.total || 0;
      current.orders += 1;
    }
  }

  const data = Array.from(dataMap.entries()).map(([date, stats]) => ({
    date,
    revenue: Math.round(stats.revenue * 100) / 100,
    orders: stats.orders,
  }));

  res.json(GetRevenueChartResponse.parse(data));
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);
  const query = GetDashboardOrdersQueryParams.safeParse(req.query);
  const status = query.success ? query.data.status : undefined;

  let queryBuilder = supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", merchantId)
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

export async function listProducts(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", merchantId);

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

export async function createProduct(
  req: Request,
  res: Response,
): Promise<void> {
  const merchantId = await getMerchantId(req);
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    console.error("Product validation error:", parsed.error);
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Validate required string fields are not empty
  if (!parsed.data.name?.trim()) {
    res
      .status(400)
      .json({ error: "Product name is required and cannot be empty" });
    return;
  }
  if (!parsed.data.description?.trim()) {
    res
      .status(400)
      .json({ error: "Product description is required and cannot be empty" });
    return;
  }
  if (!parsed.data.category?.trim()) {
    res
      .status(400)
      .json({ error: "Product category is required and cannot be empty" });
    return;
  }

  const dbData = snakeCaseKeys({
    ...parsed.data,
    name: parsed.data.name.trim(),
    description: parsed.data.description.trim(),
    price:
      parsed.data.price != null
        ? Math.round(parsed.data.price * 100) / 100
        : undefined,
    discountPrice:
      parsed.data.discountPrice != null
        ? Math.round(parsed.data.discountPrice * 100) / 100
        : undefined,
    stock:
      parsed.data.stock != null ? Math.round(parsed.data.stock) : undefined,
    preparationTime:
      parsed.data.preparationTime != null
        ? Math.round(parsed.data.preparationTime)
        : undefined,
    merchantId,
  });

  const { data, error } = await supabase
    .from("products")
    .insert(dbData)
    .select()
    .limit(1);

  if (error) {
    console.error("Database error creating product:", {
      code: error.code,
      message: error.message,
      details: error.details,
      merchantId,
      dbData,
    });
    res.status(500).json({
      error: error.message || "Failed to create product",
      code: error.code,
    });
    return;
  }

  if (!data || data.length === 0) {
    console.error("No data returned from product insert");
    res
      .status(500)
      .json({ error: "Failed to create product - no data returned" });
    return;
  }

  const product = camelCaseKeys(data[0]);
  res
    .status(201)
    .json(serializeDates({ ...product, merchantName: "My Restaurant" }));
}

export async function updateProduct(
  req: Request,
  res: Response,
): Promise<void> {
  const merchantId = await getMerchantId(req);
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

  const dbData = snakeCaseKeys({
    ...parsed.data,
    price:
      parsed.data.price != null ? Math.round(parsed.data.price) : undefined,
    discountPrice:
      parsed.data.discountPrice != null
        ? Math.round(parsed.data.discountPrice)
        : undefined,
    stock:
      parsed.data.stock != null ? Math.round(parsed.data.stock) : undefined,
    preparationTime:
      parsed.data.preparationTime != null
        ? Math.round(parsed.data.preparationTime)
        : undefined,
  });
  const { data, error } = await supabase
    .from("products")
    .update(dbData)
    .eq("id", params.data.id)
    .eq("merchant_id", merchantId)
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

export async function deleteProduct(
  req: Request,
  res: Response,
): Promise<void> {
  const merchantId = await getMerchantId(req);
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", params.data.id)
    .eq("merchant_id", merchantId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.sendStatus(204);
}

export async function analytics(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("merchant_id", merchantId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const camelOrders = camelCaseKeys(orders ?? []).filter(
    (o: any) => o.status === "delivered",
  );

  const customerOrderCounts = new Map<string, number>();
  let totalCustomers = 0;
  let repeatBuyers = 0;
  let newCustomers = 0;
  let newCustomersLastMonth = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const topOrderTimesMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) topOrderTimesMap.set(h, 0);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const orderHeatmapMap = new Map<string, Map<number, number>>();
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const hoursMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hoursMap.set(h, 0);
    orderHeatmapMap.set(day, hoursMap);
  }

  const customerFirstOrderDate = new Map<string, Date>();

  for (const order of camelOrders) {
    const customer = (order.customerName as string) || "Guest User";
    const currentCount = customerOrderCounts.get(customer) || 0;
    customerOrderCounts.set(customer, currentCount + 1);

    if (!order.createdAt) continue;
    const orderDate = new Date(order.createdAt as string);
    if (
      !customerFirstOrderDate.has(customer) ||
      orderDate < customerFirstOrderDate.get(customer)!
    ) {
      customerFirstOrderDate.set(customer, orderDate);
    }

    const hour = orderDate.getHours();
    if (topOrderTimesMap.has(hour)) {
      topOrderTimesMap.set(hour, topOrderTimesMap.get(hour)! + 1);
    }

    const dayStr = days[orderDate.getDay()];
    if (dayStr && orderHeatmapMap.has(dayStr)) {
      const hMap = orderHeatmapMap.get(dayStr)!;
      if (hMap.has(hour)) {
        hMap.set(hour, hMap.get(hour)! + 1);
      }
    }
  }

  totalCustomers = customerOrderCounts.size;

  for (const [customer, count] of customerOrderCounts.entries()) {
    if (count > 1) repeatBuyers++;
    const firstOrderDate = customerFirstOrderDate.get(customer)!;
    if (firstOrderDate >= thirtyDaysAgo) {
      newCustomers++;
    } else if (firstOrderDate >= sixtyDaysAgo && firstOrderDate < thirtyDaysAgo) {
      newCustomersLastMonth++;
    }
  }

  const repeatBuyerRate =
    totalCustomers > 0 ? (repeatBuyers / totalCustomers) * 100 : 0;
  const retentionRate =
    totalCustomers > 0 ? Math.min(repeatBuyerRate * 1.5, 100) : 0; // naive retention based on repeat

  const topOrderTimes = Array.from(topOrderTimesMap.entries()).map(
    ([hour, count]) => ({
      hour,
      count,
    }),
  );

  const orderHeatmap: { day: string; hour: number; count: number }[] = [];
  for (const [day, hMap] of orderHeatmapMap.entries()) {
    for (const [hour, count] of hMap.entries()) {
      orderHeatmap.push({ day, hour, count });
    }
  }

  const sixtyDaysAgo = new Date(
    thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000,
  );
  const customerCountsThisMonth = new Map<string, number>();
  const customerCountsLastMonth = new Map<string, number>();

  for (const order of camelOrders) {
    if (!order.createdAt) continue;
    const orderDate = new Date(order.createdAt as string);
    const customer = (order.customerName as string) || "Guest User";

    if (orderDate >= thirtyDaysAgo) {
      customerCountsThisMonth.set(
        customer,
        (customerCountsThisMonth.get(customer) || 0) + 1,
      );
    } else if (orderDate >= sixtyDaysAgo && orderDate < thirtyDaysAgo) {
      customerCountsLastMonth.set(
        customer,
        (customerCountsLastMonth.get(customer) || 0) + 1,
      );
    }
  }

  let repeatBuyersThisMonth = 0;
  let repeatBuyersLastMonth = 0;

  for (const count of customerCountsThisMonth.values()) {
    if (count > 1) repeatBuyersThisMonth++;
  }
  for (const count of customerCountsLastMonth.values()) {
    if (count > 1) repeatBuyersLastMonth++;
  }

  const totalCustomersThisMonth = customerCountsThisMonth.size;
  const totalCustomersLastMonth = customerCountsLastMonth.size;

  const repeatRateThisMonth =
    totalCustomersThisMonth > 0
      ? (repeatBuyersThisMonth / totalCustomersThisMonth) * 100
      : 0;
  const repeatRateLastMonth =
    totalCustomersLastMonth > 0
      ? (repeatBuyersLastMonth / totalCustomersLastMonth) * 100
      : 0;

  const retentionDelta =
    repeatRateLastMonth === 0
      ? repeatRateThisMonth > 0
        ? 100
        : 0
      : repeatRateThisMonth - repeatRateLastMonth;

  const newCustomersDelta =
    newCustomersLastMonth === 0
      ? newCustomers > 0
        ? 100
        : 0
      : ((newCustomers - newCustomersLastMonth) / newCustomersLastMonth) * 100;

  // Traffic and demographics remain deterministic due to lack of source tracking in DB
  const baseOrganic = 45;
  const organicVariance = (merchantId * 7) % 30; // 0 to 29
  const organicTrafficPercentage = baseOrganic + organicVariance;
  const socialTrafficPercentage = 100 - organicTrafficPercentage;

  res.json(
    GetCustomerAnalyticsResponse.parse({
      retentionRate: Math.round(retentionRate * 10) / 10,
      repeatBuyerRate: Math.round(repeatBuyerRate * 10) / 10,
      totalCustomers,
      newCustomers,
      newCustomersDelta: Math.round(newCustomersDelta * 10) / 10,
      organicTrafficPercentage,
      socialTrafficPercentage,
      retentionDelta: Math.round(retentionDelta * 10) / 10,
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

export async function topProducts(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("items, status")
    .eq("merchant_id", merchantId);

  if (ordersError) {
    res.status(500).json({ error: ordersError.message });
    return;
  }

  const camelOrders = camelCaseKeys(orders ?? []).filter(
    (o: any) => o.status === "delivered",
  );
  const productStats = new Map<
    number,
    { totalSold: number; revenue: number; name: string; image: string | null }
  >();

  for (const order of camelOrders) {
    const items = (order.items as Array<any>) || [];
    for (const item of items) {
      if (!productStats.has(item.productId)) {
        productStats.set(item.productId, {
          totalSold: 0,
          revenue: 0,
          name: item.productName || "Unknown",
          image: item.productImage || null,
        });
      }
      const stats = productStats.get(item.productId)!;
      stats.totalSold += item.quantity || 1;
      stats.revenue += (item.quantity || 1) * (item.price || 0);
    }
  }

  const sortedProducts = Array.from(productStats.entries())
    .map(([productId, stats]) => ({
      productId,
      name: stats.name,
      image: stats.image || "",
      totalSold: stats.totalSold,
      revenue: Math.round(stats.revenue * 100) / 100,
    }))
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 5);

  const result = sortedProducts.map((p, i) => ({ ...p, rank: i + 1 }));

  res.json(GetTopProductsResponse.parse(result));
}

export async function listPromotions(
  req: Request,
  res: Response,
): Promise<void> {
  const merchantId = await getMerchantId(req);
  const { data: promotions, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("merchant_id", merchantId);

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
  const merchantId = await getMerchantId(req);
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys({
    ...parsed.data,
    merchantId,
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

export async function updatePromotion(
  req: Request,
  res: Response,
): Promise<void> {
  const merchantId = await getMerchantId(req);
  const promotionId = req.params.id;
  const parsed = UpdatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys({
    ...parsed.data,
  });

  const { data, error } = await supabase
    .from("promotions")
    .update(dbData)
    .eq("id", promotionId)
    .eq("merchant_id", merchantId)
    .select()
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data || data.length === 0) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }

  const promotion = camelCaseKeys(data?.[0]);
  res.json(serializeDates(promotion));
}

import * as z from "zod";

export async function getProfile(req: Request, res: Response): Promise<void> {
  const merchantId = await getMerchantId(req);
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }

  res.status(200).json(serializeDates(camelCaseKeys(data)));
}

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
  cuisineType: z.string().optional(),
  deliveryTime: z.string().optional(),
  deliveryFee: z.number().optional(),
  address: z.string().optional(),
  isOpen: z.boolean().optional(),
  profileImage: z.string().optional(),
  coverImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
  openingHours: z.any().nullable().optional(),
  additionalShowed: z.string().nullable().optional(),
});

export async function updateProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const merchantId = await getMerchantId(req);
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData = snakeCaseKeys(parsed.data);
  const { data, error } = await supabase
    .from("merchants")
    .update(dbData)
    .eq("id", merchantId)
    .select()
    .single();

  if (error || !data) {
    console.error("Supabase update error:", error);
    res
      .status(500)
      .json({ error: error?.message || "Failed to update profile" });
    return;
  }

  res.status(200).json(serializeDates(camelCaseKeys(data)));
}
