// Google sign-in (OAuth 2.0 authorisation code + PKCE). Server only.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import { appPublicUrl, appCookieRef } from "@/lib/env";
import type { NextRequest, NextResponse } from "next/server";
import type { SessionTokens } from "@/lib/db/auth";

export const GOOGLE_STATE_COOKIE = "g_oauth";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The public site address. Behind the proxy the request host is internal. */
export function siteOrigin(req: NextRequest): string {
  const host = req.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1") return req.nextUrl.origin;
  return appPublicUrl() || req.nextUrl.origin;
}

export function callbackUrl(req: NextRequest): string {
  return `${siteOrigin(req)}/api/auth/google/callback`;
}

/** Only same-site paths, so the login can't bounce people to another site. */
export function safeRedirect(raw: string | null | undefined): string {
  const r = String(raw || "");
  return r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/\\") ? r : "/account";
}

export function newPkce() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string) {
  const cfg = googleConfig();
  if (!cfg) throw new Error("Google sign-in is not set up");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !json.id_token) throw new Error(`Google token exchange failed: ${json.error || res.status}`);

  const { payload } = await jwtVerify(json.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: cfg.clientId,
  });
  return {
    sub: String(payload.sub || ""),
    email: String(payload.email || ""),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : undefined,
    givenName: typeof payload.given_name === "string" ? payload.given_name : undefined,
    familyName: typeof payload.family_name === "string" ? payload.family_name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/** Same cookies the browser client writes after a password login. */
export function setSessionCookies(res: NextResponse, session: SessionTokens, secure: boolean) {
  const opts = { path: "/", maxAge: session.expires_in, sameSite: "lax" as const, secure, httpOnly: false };
  res.cookies.set(
    `sb-${appCookieRef()}-auth-token`,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }),
    opts
  );
  res.cookies.set("sb-access-token", session.access_token, opts);
  res.cookies.set("app-access-token", session.access_token, opts);
}
