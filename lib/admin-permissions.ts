/** Shared admin feature-permission definitions (used by Roles + Staff pages). */

export interface PermissionMeta {
  label: string;
  icon: string;
  description: string;
}

export const PERMISSION_LABELS: Record<string, PermissionMeta> = {
  dashboard: { label: 'Dashboard', icon: 'ri-dashboard-line', description: 'View the admin dashboard and KPIs' },
  orders: { label: 'Orders', icon: 'ri-shopping-bag-line', description: 'View and manage customer orders' },
  pos: { label: 'POS System', icon: 'ri-store-3-line', description: 'Access the point of sale system' },
  products: { label: 'Products', icon: 'ri-box-3-line', description: 'Manage products, pricing, and images' },
  categories: { label: 'Categories', icon: 'ri-folder-line', description: 'Manage product categories' },
  customers: { label: 'Customers', icon: 'ri-group-line', description: 'View and manage customers' },
  reviews: { label: 'Reviews', icon: 'ri-chat-smile-2-line', description: 'Moderate product reviews' },
  inventory: { label: 'Inventory', icon: 'ri-stack-line', description: 'Track and manage stock levels' },
  analytics: { label: 'Analytics', icon: 'ri-bar-chart-line', description: 'View sales and performance analytics' },
  coupons: { label: 'Coupons', icon: 'ri-coupon-2-line', description: 'Create and manage discount coupons' },
  support: { label: 'Support Hub', icon: 'ri-customer-service-2-line', description: 'Manage support tickets' },
  customer_insights: { label: 'Customer Insights', icon: 'ri-user-search-line', description: 'View customer analytics and segments' },
  notifications: { label: 'Notifications', icon: 'ri-notification-3-line', description: 'Manage marketing notifications' },
  sms_debugger: { label: 'SMS Debugger', icon: 'ri-message-2-line', description: 'Test and debug SMS messages' },
  blog: { label: 'Blog', icon: 'ri-article-line', description: 'Manage blog posts and content' },
  modules: { label: 'Modules', icon: 'ri-puzzle-line', description: 'Enable or disable store modules' },
  staff: { label: 'Staff Management', icon: 'ri-team-line', description: 'Add and manage staff members' },
  delivery: { label: 'Delivery Hub', icon: 'ri-truck-line', description: 'Access delivery logistics dashboard' },
  roles: { label: 'Roles & Permissions', icon: 'ri-shield-user-line', description: 'Manage user roles and permissions' },
};

export const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

/** Sanitize a permissions object to only known keys with boolean values. */
export function sanitizePermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    if (key in (raw as Record<string, unknown>)) {
      out[key] = (raw as Record<string, unknown>)[key] === true;
    }
  }
  return out;
}

/** Default permissions for new staff (mirrors the seeded staff role). */
export const DEFAULT_STAFF_PERMISSIONS: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  products: true,
  categories: true,
  customers: true,
  reviews: true,
  inventory: true,
  pos: true,
};
