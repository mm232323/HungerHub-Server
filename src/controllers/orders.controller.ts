import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { serializeDates, camelCaseKeys } from "../utils/serialize";
import {
  ListOrdersResponse,
  GetOrderResponse,
  UpdateOrderStatusResponse,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  ListOrdersQueryParams,
} from "#api-zod";

export async function list(req: Request, res: Response): Promise<void> {
  const query = ListOrdersQueryParams.safeParse(req.query);
  const status = query.success ? query.data.status : undefined;
  const merchantId =
    query.success && query.data.merchantId
      ? Number(query.data.merchantId)
      : undefined;

  let queryBuilder = supabase
    .from("orders")
    .select(`
      *,
      merchants (
        name
      )
    `)
    .order("created_at", { ascending: true });

  if (status) queryBuilder = queryBuilder.eq("status", status);
  if (merchantId) queryBuilder = queryBuilder.eq("merchant_id", merchantId);

  const { data: orders, error } = await queryBuilder;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (orders ?? []).map((o: Record<string, unknown>) => {
    const camelOrder = camelCaseKeys(o) as { merchants?: { name?: string } };
    const merchantName = camelOrder.merchants?.name ?? null;
    const { merchants: _m, ...rest } = camelOrder;
    return { ...rest, merchantName };
  });

  res.json(ListOrdersResponse.parse(serializeDates(result)));
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { merchantId, items, address, paymentMethod, promoCode, notes } =
    parsed.data;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", merchantId);

  const productMap = new Map(
    (products ?? []).map((p: { id: number }) => [p.id, p]),
  );

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId) as
      | {
          name?: string;
          image?: string | null;
          discount_price?: number | null;
          price?: number | null;
        }
      | undefined;
    return {
      productId: item.productId,
      productName: product?.name ?? "Unknown",
      productImage: product?.image ?? null,
      quantity: item.quantity,
      price: product?.discount_price ?? product?.price ?? 0,
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = 2.99;
  const discount = promoCode ? subtotal * 0.1 : 0;
  const total = subtotal + deliveryFee - discount;

  const now = new Date();
  const eta = new Date(now.getTime() + 35 * 60 * 1000);
  const estimatedDelivery = eta.toISOString();

  const dbData = {
    merchant_id: merchantId,
    items: orderItems,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    status: "pending",
    address,
    payment_method: paymentMethod,
    promo_code: promoCode ?? null,
    discount: discount > 0 ? discount : null,
    estimated_delivery: estimatedDelivery,
    tracking_stage: 0,
    driver_name: null,
    driver_phone: null,
    notes: notes ?? null,
    customer_name: "Guest User",
    customer_phone: null,
    customer_id: null,
  };

  const { data: newOrders, error: insertError } = await supabase
    .from("orders")
    .insert(dbData)
    .select()
    .limit(1);

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  const order = camelCaseKeys(newOrders?.[0]);
  res
    .status(201)
    .json(
      GetOrderResponse.parse(
        serializeDates({ ...order, merchantName: null }),
      ),
    );
}

export async function getById(req: Request, res: Response): Promise<void> {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      *,
      merchants (
        name
      )
    `)
    .eq("id", params.data.id)
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const order = orders?.[0];
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const camelOrder = camelCaseKeys(order) as { merchants?: { name?: string } };
  const merchantName = camelOrder.merchants?.name ?? null;
  const { merchants: _m, ...rest } = camelOrder;

  res.json(GetOrderResponse.parse(serializeDates({ ...rest, merchantName })));
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
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

  const { data: updatedOrders, error: updateError } = await supabase
    .from("orders")
    .update({
      status: body.data.status,
      tracking_stage: statusToStage[body.data.status] ?? 0,
    })
    .eq("id", params.data.id)
    .select()
    .limit(1);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  const order = updatedOrders?.[0];
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const { data: merchants } = await supabase
    .from("merchants")
    .select("name")
    .eq("id", order.merchant_id)
    .limit(1);

  const merchantName = merchants?.[0]?.name ?? null;
  const camelOrder = camelCaseKeys(order);

  res.json(
    UpdateOrderStatusResponse.parse(
      serializeDates({ ...camelOrder, merchantName }),
    ),
  );
}
