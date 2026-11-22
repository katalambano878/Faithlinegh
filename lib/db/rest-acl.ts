// Application-level access rules for /rest/v1 — replaces Supabase row level
// security for the in-app REST layer. Mirrors the Faithline policies as they
// stood on 2026-11-22, with the public read holes on chats and support
// tickets closed. Staff/admin tokens and the server's own client bypass these.

import type { RestActor } from "./rest-auth";

export type RestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type AclDecision =
  | {
      allow: true;
      /** Filters added to the query (col = value) */
      forceEq?: Record<string, string>;
      /** Values written onto inserted/updated rows */
      forceSet?: Record<string, unknown>;
      /** Columns removed from the request body before writing */
      stripColumns?: string[];
    }
  | { allow: false; status: number; message: string };

/** Anyone may read; the value is the filter that limits which rows. */
const PUBLIC_READ: Record<string, Record<string, string> | null> = {
  products: { status: "active" },
  categories: null,
  product_images: null,
  product_variants: null,
  banners: { is_active: "true" },
  cms_content: { is_active: "true" },
  blog_posts: { status: "published" },
  delivery_zones: { is_active: "true" },
  navigation_items: { is_active: "true" },
  navigation_menus: null,
  pages: null,
  review_images: null,
  reviews: { status: "approved" },
  roles: null,
  site_settings: null,
  store_modules: null,
  store_settings: null,
  support_knowledge_base: { is_published: "true" },
};

/** Signed-in shoppers read only their own rows: table → owner column. */
const OWN_ROWS: Record<string, string> = {
  profiles: "id",
  orders: "user_id",
  addresses: "user_id",
  wishlist_items: "user_id",
  cart_items: "user_id",
  notifications: "user_id",
  return_requests: "user_id",
};

/** RPCs anyone may call (the function itself checks the email). */
const PUBLIC_RPC = new Set(["get_order_for_tracking"]);

function deny(message: string, status = 403): AclDecision {
  return { allow: false, status, message };
}

export function authorizeRestTable(actor: RestActor, table: string, method: RestMethod): AclDecision {
  const t = table.toLowerCase();
  if (actor.isServiceRole || actor.isStaff) return { allow: true };
  const uid = actor.userId;

  if (method === "GET") {
    if (t in PUBLIC_READ) {
      const f = PUBLIC_READ[t];
      return f ? { allow: true, forceEq: f } : { allow: true };
    }
    if (OWN_ROWS[t]) {
      if (!uid) return deny("Please sign in", 401);
      return { allow: true, forceEq: { [OWN_ROWS[t]]: uid } };
    }
    return deny(`Access to '${t}' is restricted`);
  }

  if (method === "POST") {
    if (t === "contact_submissions") return { allow: true };
    if (t === "reviews" || t === "review_images") {
      if (!uid) return deny("Please sign in to leave a review", 401);
      return t === "reviews"
        ? { allow: true, forceSet: { user_id: uid, status: "pending" } }
        : { allow: true };
    }
    if (uid && (t === "addresses" || t === "wishlist_items" || t === "cart_items" || t === "return_requests")) {
      return { allow: true, forceSet: { user_id: uid } };
    }
    if (uid && t === "profiles") return { allow: true, forceSet: { id: uid, role: "customer" } };
    return deny(`Adding to '${t}' is not allowed`);
  }

  if (method === "PATCH" || method === "PUT") {
    if (!uid) return deny("Please sign in", 401);
    if (t === "profiles") return { allow: true, forceEq: { id: uid }, stripColumns: ["id", "role", "permissions", "email"] };
    if (t === "addresses" || t === "cart_items" || t === "notifications") {
      return { allow: true, forceEq: { user_id: uid }, stripColumns: ["user_id"] };
    }
    if (t === "reviews") return { allow: true, forceEq: { user_id: uid }, stripColumns: ["user_id", "status"] };
    return deny(`Changing '${t}' is not allowed`);
  }

  if (method === "DELETE") {
    if (!uid) return deny("Please sign in", 401);
    if (t === "addresses" || t === "wishlist_items" || t === "cart_items") {
      return { allow: true, forceEq: { user_id: uid } };
    }
    return deny(`Deleting from '${t}' is not allowed`);
  }

  return deny("Method not allowed", 405);
}

export function authorizeRpc(actor: RestActor, fn: string): AclDecision {
  const name = fn.toLowerCase();
  if (actor.isServiceRole || actor.isStaff) return { allow: true };
  if (PUBLIC_RPC.has(name)) return { allow: true };
  return deny(`'${name}' is not available`);
}

export function authorizeStorageWrite(actor: RestActor): AclDecision {
  if (actor.isServiceRole || actor.isStaff) return { allow: true };
  return deny("Uploading files needs an admin account");
}
