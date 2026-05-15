import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";
import {
  db,
  productsTable,
  ordersTable,
  promotionsTable,
  merchantsTable,
} from "@workspace/db";
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
} from "@workspace/api-zod";

const DEMO_MERCHANT_ID = 1;
const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.merchantId, DEMO_MERCHANT_ID));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter((o) => new Date(o.createdAt) >= today);
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "confirmed");
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const uniqueCustomers = new Set(orders.map((o) => o.customerName)).size;

  res.json(
    GetDashboardStatsResponse.parse({
      totalRevenue,
      todayRevenue,
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      totalOrders: orders.length,
      totalCustomers: uniqueCustomers,
      newCustomersThisWeek: Math.min(uniqueCustomers, 12),
      avgOrderValue,
      growthRate: 18.5,
    })
  );
});

router.get("/dashboard/revenue-chart", async (_req, res): Promise<void> => {
  const data: Array<{ date: string; revenue: number; orders: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().split("T")[0],
      revenue: Math.floor(Math.random() * 800 + 200),
      orders: Math.floor(Math.random() * 30 + 5),
    });
  }
  res.json(GetRevenueChartResponse.parse(data));
});

router.get("/dashboard/orders", async (req, res): Promise<void> => {
  const query = GetDashboardOrdersQueryParams.safeParse(req.query);
  const status = query.success ? query.data.status : undefined;

  const conditions = [eq(ordersTable.merchantId, DEMO_MERCHANT_ID)];
  if (status) conditions.push(eq(ordersTable.status, status));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions))
    .orderBy(ordersTable.createdAt);

  const result = orders.map((o) => ({ ...o, merchantName: "My Restaurant" }));
  res.json(GetDashboardOrdersResponse.parse(serializeDates(result)));
});

router.get("/dashboard/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.merchantId, DEMO_MERCHANT_ID));
  const result = products.map((p) => ({ ...p, merchantName: "My Restaurant" }));
  res.json(GetDashboardProductsResponse.parse(serializeDates(result)));
});

router.post("/dashboard/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({ ...parsed.data, merchantId: DEMO_MERCHANT_ID })
    .returning();

  res.status(201).json(serializeDates({ ...product, merchantName: "My Restaurant" }));
});

router.patch("/dashboard/products/:id", async (req, res): Promise<void> => {
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

  const [product] = await db
    .update(productsTable)
    .set(parsed.data)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.merchantId, DEMO_MERCHANT_ID)))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(serializeDates({ ...product, merchantName: "My Restaurant" }));
});

router.delete("/dashboard/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.merchantId, DEMO_MERCHANT_ID)));

  res.sendStatus(204);
});

router.get("/dashboard/analytics", async (_req, res): Promise<void> => {
  const topOrderTimes = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: h >= 11 && h <= 14 ? Math.floor(Math.random() * 30 + 20) : h >= 18 && h <= 21 ? Math.floor(Math.random() * 40 + 25) : Math.floor(Math.random() * 10 + 2),
  }));

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const orderHeatmap = days.flatMap((day) =>
    Array.from({ length: 24 }, (_, h) => ({
      day,
      hour: h,
      count: Math.floor(Math.random() * 15),
    }))
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
    })
  );
});

router.get("/dashboard/top-products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.merchantId, DEMO_MERCHANT_ID)).limit(5);
  const result = products.map((p, i) => ({
    productId: p.id,
    name: p.name,
    image: p.image,
    totalSold: Math.floor(Math.random() * 200 + 50),
    revenue: Math.floor(Math.random() * 2000 + 500),
    rank: i + 1,
  }));
  res.json(GetTopProductsResponse.parse(result));
});

router.get("/dashboard/promotions", async (_req, res): Promise<void> => {
  const promotions = await db.select().from(promotionsTable).where(eq(promotionsTable.merchantId, DEMO_MERCHANT_ID));
  res.json(ListPromotionsResponse.parse(serializeDates(promotions)));
});

router.post("/dashboard/promotions", async (req, res): Promise<void> => {
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [promotion] = await db
    .insert(promotionsTable)
    .values({ ...parsed.data, merchantId: DEMO_MERCHANT_ID })
    .returning();

  res.status(201).json(serializeDates(promotion));
});

export default router;
