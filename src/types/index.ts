export type {
  Category,
  Merchant,
  Product,
  FeedPost,
  Order,
  OrderItem,
  Review,
  Promotion,
} from '../api-zod/index.js';

// Pagination Generic Types
export interface PaginatedPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

