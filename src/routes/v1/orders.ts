import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";
import { db, ordersTable, productsTable, merchantsTable } from "@workspace/db";
import {
  ListOrdersResponse,
  GetOrderResponse,
  UpdateOrderStatusResponse,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  ListOrdersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/orders", async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  const status = query.success ? query.data.status : undefined;
  const merchantId = query.success && query.data.merchantId ? Number(query.data.merchantId) : undefined;

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (merchantId) conditions.push(eq(ordersTable.merchantId, merchantId));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(ordersTable.createdAt);

  const merchants = await db.select().from(merchantsTable);
  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
  const result = orders.map((o) => ({ ...o, merchantName: merchantMap.get(o.merchantId) ?? null }));
  res.json(ListOrdersResponse.parse(serializeDates(result)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { merchantId, items, address, paymentMethod, promoCode, notes } = parsed.data;

  const productIds = items.map((i) => i.productId);
  const products = await db.select().from(productsTable).where(eq(productsTable.merchantId, merchantId));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    return {
      productId: item.productId,
      productName: product?.name ?? "Unknown",
      productImage: product?.image ?? null,
      quantity: item.quantity,
      price: product?.discountPrice ?? product?.price ?? 0,
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = 2.99;
  const discount = promoCode ? subtotal * 0.1 : 0;
  const total = subtotal + deliveryFee - discount;

  const now = new Date();
  const eta = new Date(now.getTime() + 35 * 60 * 1000);
  const estimatedDelivery = eta.toISOString();

  const [order] = await db.insert(ordersTable).values({
    merchantId,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    status: "pending",
    address,
    paymentMethod,
    promoCode: promoCode ?? null,
    discount: discount > 0 ? discount : null,
    estimatedDelivery,
    trackingStage: 0,
    driverName: null,
    driverPhone: null,
    notes: notes ?? null,
    customerName: "Guest User",
    customerPhone: null,
    customerId: null,
  }).returning();

  res.status(201).json(GetOrderResponse.parse(serializeDates({ ...order, merchantName: null })));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, order.merchantId));
  res.json(GetOrderResponse.parse(serializeDates({ ...order, merchantName: merchant?.name ?? null })));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const statusToStage: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    preparing: 2,
    ready: 3,
    delivering: 4,
    delivered: 5,
    cancelled: -1,
  };

  const [order] = await db
    .update(ordersTable)
    .set({ status: body.data.status, trackingStage: statusToStage[body.data.status] ?? 0 })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, order.merchantId));
  res.json(UpdateOrderStatusResponse.parse(serializeDates({ ...order, merchantName: merchant?.name ?? null })));
});

export default router;
