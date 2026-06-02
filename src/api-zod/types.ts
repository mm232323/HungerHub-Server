export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  image?: string | null;
  productCount?: number;
}

export type CustomerAnalyticsDemographicsItem = {
  label: string;
  value: number;
};

export type CustomerAnalyticsOrderHeatmapItem = {
  day: string;
  hour: number;
  count: number;
};

export type CustomerAnalyticsTopOrderTimesItem = {
  hour: number;
  count: number;
};

export interface CustomerAnalytics {
  retentionRate: number;
  repeatBuyerRate: number;
  totalCustomers: number;
  newCustomers: number;
  topOrderTimes: CustomerAnalyticsTopOrderTimesItem[];
  orderHeatmap: CustomerAnalyticsOrderHeatmapItem[];
  demographics?: CustomerAnalyticsDemographicsItem[];
}

export interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  totalOrders: number;
  totalCustomers: number;
  newCustomersThisWeek: number;
  avgOrderValue: number;
  growthRate: number;
}

export interface Merchant {
  id: number;
  name: string;
  slug: string;
  coverImage: string;
  profileImage: string;
  bio: string;
  rating: number;
  reviewCount?: number;
  deliveryTime: string;
  deliveryFee: number;
  isOpen: boolean;
  cuisineType: string;
  address?: string | null;
  followersCount: number;
  isFollowing: boolean;
  isTrending?: boolean;
  tags?: string[];
  ownerUserName?: string;
}

export interface CreateMerchantInput {
  name: string;
  bio: string;
  cuisineType: string;
  deliveryTime: string;
  deliveryFee: number;
  address: string;
  isOpen?: boolean;
  profileImage?: string;
  coverImage?: string;
  tags?: string[];
  ownerUserName?: string;
}


export type FeedPostProduct = { [key: string]: unknown } | null;

export interface FeedPost {
  id: number;
  merchantId: number;
  merchant: Merchant;
  productId?: number | null;
  product?: FeedPostProduct;
  image: string;
  video?: string | null;
  caption: string;
  likes: number;
  comments?: number;
  shares?: number;
  isTrending: boolean;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
}

export interface FollowStatus {
  isFollowing: boolean;
  followersCount: number;
}

export type GetDashboardOrdersParams = {
  status?: string;
};

export type GetFeedParams = {
  limit?: number;
  offset?: number;
};

export interface HealthStatus {
  status: string;
}

export interface LikeStatus {
  isLiked: boolean;
  likes: number;
}

export type ListMerchantsParams = {
  category?: string;
  trending?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

export type ListOrdersParams = {
  status?: string;
  merchantId?: number;
};

export type ListProductsParams = {
  category?: string;
  search?: string;
  merchantId?: number;
  limit?: number;
  offset?: number;
};

export interface MerchantStory {
  id: number;
  merchantId: number;
  merchant: Merchant;
  image: string;
  hasUnviewed: boolean;
}

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderStatus = {
  pending: "pending",
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "ready",
  delivering: "delivering",
  delivered: "delivered",
  cancelled: "cancelled",
} as const;

export interface OrderItem {
  productId: number;
  productName: string;
  productImage?: string | null;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  merchantId: number;
  merchantName?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  items: OrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  status: OrderStatus;
  address: string;
  paymentMethod: string;
  promoCode?: string | null;
  discount?: number | null;
  estimatedDelivery?: string | null;
  trackingStage?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  notes?: string | null;
  createdAt: string;
}

export type OrderInputItemsItem = {
  productId: number;
  quantity: number;
};

export interface OrderInput {
  merchantId: number;
  items: OrderInputItemsItem[];
  address: string;
  paymentMethod: string;
  promoCode?: string | null;
  notes?: string | null;
}

export type OrderStatusUpdateStatus =
  (typeof OrderStatusUpdateStatus)[keyof typeof OrderStatusUpdateStatus];

export const OrderStatusUpdateStatus = {
  pending: "pending",
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "ready",
  delivering: "delivering",
  delivered: "delivered",
  cancelled: "cancelled",
} as const;

export interface OrderStatusUpdate {
  status: OrderStatusUpdateStatus;
}

export interface Product {
  id: number;
  merchantId: number;
  merchantName?: string | null;
  name: string;
  description: string;
  price: number;
  discountPrice?: number | null;
  image: string;
  category: string;
  isAvailable: boolean;
  stock?: number | null;
  ingredients?: string[];
  nutritionalInfo?: string | null;
  isTrending?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  discountPrice?: number | null;
  image: string;
  category: string;
  isAvailable?: boolean;
  stock?: number | null;
  ingredients?: string[];
  nutritionalInfo?: string | null;
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  price?: number;
  discountPrice?: number | null;
  image?: string;
  category?: string;
  isAvailable?: boolean;
  stock?: number | null;
  ingredients?: string[];
  nutritionalInfo?: string | null;
}

export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const PromotionType = {
  percentage: "percentage",
  fixed: "fixed",
  free_delivery: "free_delivery",
  bogo: "bogo",
} as const;

export interface Promotion {
  id: number;
  title: string;
  type: PromotionType;
  discount: number;
  code?: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageCount?: number;
  impressions?: number | null;
}

export type PromotionInputType =
  (typeof PromotionInputType)[keyof typeof PromotionInputType];

export const PromotionInputType = {
  percentage: "percentage",
  fixed: "fixed",
  free_delivery: "free_delivery",
  bogo: "bogo",
} as const;

export interface PromotionInput {
  title: string;
  type: PromotionInputType;
  discount: number;
  code?: string | null;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface Review {
  id: number;
  merchantId: number;
  productId?: number | null;
  orderId?: number | null;
  reviewerName: string;
  reviewerAvatar?: string | null;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewInput {
  merchantId: number;
  productId?: number | null;
  orderId?: number | null;
  reviewerName: string;
  rating: number;
  comment: string;
}

export interface SaveStatus {
  isSaved: boolean;
}

export type SearchParams = {
  q: string;
};

export interface SearchResults {
  merchants: Merchant[];
  products: Product[];
}

export interface TopProduct {
  productId: number;
  name: string;
  image: string;
  totalSold: number;
  revenue: number;
  rank: number;
}
