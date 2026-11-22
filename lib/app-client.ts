/**
 * First-party browser client replacing @supabase/ssr.
 * Talks to app-owned /rest/v1, /auth/v1, /storage/v1 shims with cookie sessions.
 */

import { appAnonKey, appCookieRef, appPublicUrl } from "./env";

type Dict = Record<string, unknown>;

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: Dict | null;
}

type AuthListener = (event: string, session: Session | null) => void;

function baseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return appPublicUrl() || "http://localhost:3000";
}

function anonKey(): string {
  return appAnonKey() || "anon";
}

function cookieName(): string {
  return `sb-${appCookieRef()}-auth-token`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    if (decodeURIComponent(p.slice(0, i)) === name) {
      return decodeURIComponent(p.slice(i + 1));
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function loadSession(): Session | null {
  const raw =
    readCookie(cookieName()) ||
    readCookie("sb-access-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed[0]) {
      return {
        access_token: parsed[0],
        refresh_token: parsed[1] || "",
        user: null,
      };
    }
    if (parsed && typeof parsed === "object" && parsed.access_token) {
      return parsed as Session;
    }
  } catch {
    // bare token
    if (raw.length > 20) {
      return { access_token: raw, refresh_token: "", user: null };
    }
  }
  return null;
}

function saveSession(session: Session | null) {
  const name = cookieName();
  if (!session?.access_token) {
    clearCookie(name);
    clearCookie("sb-access-token");
    clearCookie("app-access-token");
    return;
  }
  const maxAge = session.expires_in || 60 * 60 * 24 * 7;
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type || "bearer",
    user: session.user,
  });
  writeCookie(name, payload, maxAge);
  writeCookie("sb-access-token", session.access_token, maxAge);
  writeCookie("app-access-token", session.access_token, maxAge);
}

const authListeners = new Set<AuthListener>();

function emitAuth(event: string, session: Session | null) {
  for (const fn of authListeners) {
    try {
      fn(event, session);
    } catch {
      /* ignore */
    }
  }
}

function encodeFilterValue(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return encodeURIComponent(String(v));
}

class QueryBuilder {
  private table: string;
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private body: unknown = null;
  private params = new URLSearchParams();
  private prefer: string[] = [];
  private wantSingle = false;
  private headersExtra: Dict = {};

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.method === "GET") this.method = "GET";
    this.params.set("select", columns);
    if (opts?.count === "exact") this.prefer.push("count=exact");
    if (opts?.head) this.prefer.push("head=true");
    return this;
  }

  insert(row: unknown) {
    this.method = "POST";
    this.body = row;
    this.prefer.push("return=representation");
    return this;
  }

  update(patch: unknown) {
    this.method = "PATCH";
    this.body = patch;
    this.prefer.push("return=representation");
    return this;
  }

  upsert(row: unknown, opts?: { onConflict?: string }) {
    this.method = "POST";
    this.body = row;
    this.prefer.push("resolution=merge-duplicates");
    this.prefer.push("return=representation");
    if (opts?.onConflict) {
      this.headersExtra.Prefer = `resolution=merge-duplicates,return=representation`;
      this.params.set("on_conflict", opts.onConflict);
    }
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  eq(col: string, val: unknown) {
    this.params.append(col, `eq.${encodeFilterValue(val)}`);
    return this;
  }
  neq(col: string, val: unknown) {
    this.params.append(col, `neq.${encodeFilterValue(val)}`);
    return this;
  }
  gt(col: string, val: unknown) {
    this.params.append(col, `gt.${encodeFilterValue(val)}`);
    return this;
  }
  gte(col: string, val: unknown) {
    this.params.append(col, `gte.${encodeFilterValue(val)}`);
    return this;
  }
  lt(col: string, val: unknown) {
    this.params.append(col, `lt.${encodeFilterValue(val)}`);
    return this;
  }
  lte(col: string, val: unknown) {
    this.params.append(col, `lte.${encodeFilterValue(val)}`);
    return this;
  }
  ilike(col: string, val: unknown) {
    this.params.append(col, `ilike.${encodeFilterValue(val)}`);
    return this;
  }
  like(col: string, val: unknown) {
    this.params.append(col, `like.${encodeFilterValue(val)}`);
    return this;
  }
  is(col: string, val: unknown) {
    this.params.append(col, `is.${val === null ? "null" : encodeFilterValue(val)}`);
    return this;
  }
  in(col: string, vals: unknown[]) {
    const inner = vals.map((v) => encodeFilterValue(v)).join(",");
    this.params.append(col, `in.(${inner})`);
    return this;
  }
  or(filter: string) {
    this.params.set("or", `(${filter})`);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; foreignTable?: string; nullsFirst?: boolean }) {
    const dir = opts?.ascending === false ? "desc" : "asc";
    const key = opts?.foreignTable ? `${opts.foreignTable}.order` : "order";
    const existing = this.params.get(key);
    const part = `${col}.${dir}${opts?.nullsFirst ? ".nullsfirst" : ""}`;
    this.params.set(key, existing ? `${existing},${part}` : part);
    return this;
  }
  limit(n: number) {
    this.params.set("limit", String(n));
    return this;
  }
  range(from: number, to: number) {
    this.params.set("offset", String(from));
    this.params.set("limit", String(to - from + 1));
    this.headersExtra["Range"] = `${from}-${to}`;
    return this;
  }
  single() {
    this.wantSingle = true;
    this.prefer.push("return=representation");
    return this;
  }
  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  then<TResult1 = { data: any; error: any; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async execute(): Promise<{ data: any; error: any; count: number | null }> {
    const session = loadSession();
    const url = `${baseUrl()}/rest/v1/${encodeURIComponent(this.table)}?${this.params.toString()}`;
    const headers: Record<string, string> = {
      apikey: anonKey(),
      "Content-Type": "application/json",
      Accept: this.wantSingle
        ? "application/vnd.pgrst.object+json"
        : "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (this.prefer.length) {
      headers.Prefer = this.prefer.join(",");
    }
    for (const [k, v] of Object.entries(this.headersExtra)) {
      if (typeof v === "string") headers[k] = v;
    }

    try {
      const res = await fetch(url, {
        method: this.method,
        headers,
        body: this.body != null ? JSON.stringify(this.body) : undefined,
        credentials: "same-origin",
      });
      const countHeader = res.headers.get("content-range");
      let count: number | null = null;
      if (countHeader && countHeader.includes("/")) {
        const total = countHeader.split("/")[1];
        count = total === "*" ? null : Number(total);
      }

      if (headers.Prefer?.includes("head=true")) {
        return { data: null, error: res.ok ? null : { message: res.statusText }, count };
      }

      const text = await res.text();
      let json: any = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      if (!res.ok) {
        return {
          data: null,
          error: {
            message: json?.message || json?.error_description || res.statusText || "Request failed",
            code: json?.code || String(res.status),
          },
          count,
        };
      }

      if (this.wantSingle) {
        if (Array.isArray(json)) {
          if (json.length === 0) {
            return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count };
          }
          return { data: json[0], error: null, count };
        }
        return { data: json, error: null, count };
      }

      return { data: json, error: null, count };
    } catch (e: unknown) {
      return {
        data: null,
        error: { message: e instanceof Error ? e.message : "Network error" },
        count: null,
      };
    }
  }
}

class StorageBucket {
  constructor(private bucket: string) {}

  getPublicUrl(objectPath: string) {
    const publicUrl = `${baseUrl()}/storage/v1/object/public/${this.bucket}/${objectPath.replace(/^\/+/, "")}`;
    return { data: { publicUrl } };
  }

  async upload(
    objectPath: string,
    file: Blob | File | ArrayBuffer | Uint8Array,
    opts?: { cacheControl?: string; upsert?: boolean; contentType?: string }
  ) {
    const session = loadSession();
    const path = objectPath.replace(/^\/+/, "");
    const url = `${baseUrl()}/storage/v1/object/${this.bucket}/${path}`;
    const headers: Record<string, string> = {
      apikey: anonKey(),
    };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    if (opts?.upsert) headers["x-upsert"] = "true";
    if (opts?.contentType) headers["Content-Type"] = opts.contentType;
    else if (typeof File !== "undefined" && file instanceof File && file.type) {
      headers["Content-Type"] = file.type;
    } else {
      headers["Content-Type"] = "application/octet-stream";
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: file as BodyInit,
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: null, error: { message: json.error || json.message || res.statusText } };
      }
      return { data: json, error: null };
    } catch (e: unknown) {
      return {
        data: null,
        error: { message: e instanceof Error ? e.message : "Upload failed" },
      };
    }
  }
}

async function authFetch(path: string, init: RequestInit = {}) {
  const session = loadSession();
  const headers: Record<string, string> = {
    apikey: anonKey(),
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (session?.access_token && !headers.Authorization) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${baseUrl()}/auth/v1/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function createAuth() {
  return {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const { res, json } = await authFetch("token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok || !json.access_token) {
        return {
          data: { user: null, session: null },
          error: { message: json.msg || json.message || json.error_description || "Login failed" },
        };
      }
      const session: Session = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_in: json.expires_in,
        expires_at: json.expires_at,
        token_type: json.token_type,
        user: json.user,
      };
      saveSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { user: json.user, session }, error: null };
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Dict; emailRedirectTo?: string };
    }) {
      const { res, json } = await authFetch("signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          data: options?.data || {},
        }),
      });
      if (!res.ok || !json.access_token) {
        return {
          data: { user: null, session: null },
          error: { message: json.msg || json.message || "Signup failed" },
        };
      }
      const session: Session = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_in: json.expires_in,
        expires_at: json.expires_at,
        token_type: json.token_type,
        user: json.user,
      };
      saveSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { user: json.user, session }, error: null };
    },

    async signOut() {
      const session = loadSession();
      if (session?.access_token) {
        await authFetch("logout", { method: "POST" }).catch(() => null);
      }
      saveSession(null);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },

    async getSession() {
      const session = loadSession();
      if (!session?.access_token) {
        return { data: { session: null }, error: null };
      }
      if (!session.user) {
        const userRes = await this.getUser();
        if (userRes.data.user) {
          session.user = userRes.data.user;
          saveSession(session);
        }
      }
      return { data: { session }, error: null };
    },

    async getUser() {
      const session = loadSession();
      if (!session?.access_token) {
        return { data: { user: null }, error: null };
      }
      const { res, json } = await authFetch("user", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        return { data: { user: null }, error: { message: json.msg || "Invalid session" } };
      }
      return { data: { user: json }, error: null };
    },

    async updateUser(payload: { password?: string; data?: Dict }) {
      const session = loadSession();
      if (!session?.access_token) {
        return { data: { user: null }, error: { message: "Not authenticated" } };
      }
      const body: Dict = {};
      if (payload.password) body.password = payload.password;
      if (payload.data) body.data = payload.data;
      const { res, json } = await authFetch("user", {
        method: "PUT",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return { data: { user: null }, error: { message: json.msg || json.message || "Update failed" } };
      }
      session.user = json;
      saveSession(session);
      emitAuth("USER_UPDATED", session);
      return { data: { user: json }, error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      // Fire current session asynchronously (supabase-js behavior)
      queueMicrotask(() => {
        const session = loadSession();
        callback("INITIAL_SESSION", session);
      });
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  };
}

export function createAppClient() {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
    auth: createAuth(),
    storage: {
      from(bucket: string) {
        return new StorageBucket(bucket);
      },
    },
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      const session = loadSession();
      const headers: Record<string, string> = { apikey: anonKey(), "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      try {
        const res = await fetch(`${baseUrl()}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
          method: "POST",
          headers,
          body: JSON.stringify(args),
          credentials: "same-origin",
        });
        const text = await res.text();
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        if (!res.ok) return { data: null, error: { message: json?.message || res.statusText, code: String(res.status) } };
        return { data: json, error: null };
      } catch (e: unknown) {
        return { data: null, error: { message: e instanceof Error ? e.message : "Network error" } };
      }
    },
  };
}

/** Browser/shared data client (replaces @/lib/supabase). */
export const db = createAppClient();

/** @deprecated Use `db` — kept briefly for mechanical rewrites */
export const supabase = db;
export const appClient = db;
