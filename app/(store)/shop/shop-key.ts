/** Cache key for the shop's first page. Must match the cacheKey built in
 *  ShopClient's fetchProducts (default price range 0-5000, rating 0, page 1). */
export function shopCacheKey(category: string, search: string, sort: string) {
  return `shop:${category}:${search}:0-5000:0:${sort}:1`;
}

export type ShopInitial = {
  categories: any[] | null;
  /** First page as the browser would have fetched it, under its cache key */
  products: { key: string; data: any[]; count: number } | null;
};
