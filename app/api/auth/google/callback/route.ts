import { NextRequest, NextResponse } from "next/server";
import { signInWithGoogle } from "@/lib/db/auth";
import { sendWelcomeMessage } from "@/lib/notifications";
import {
  callbackUrl,
  exchangeCode,
  safeRedirect,
  setSessionCookies,
  siteOrigin,
  GOOGLE_STATE_COOKIE,
} from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Google sends the customer back here after they pick an account. */
export async function GET(req: NextRequest) {
  const origin = siteOrigin(req);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/auth/login?error=${code}`);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("google_cancelled");

  let saved: { state?: string; verifier?: string; redirect?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value || "{}");
  } catch {
    saved = {};
  }
  const code = params.get("code");
  if (!code || !saved.state || !saved.verifier || params.get("state") !== saved.state) {
    return fail("google_expired");
  }

  try {
    const profile = await exchangeCode(code, saved.verifier, callbackUrl(req));
    const { session, isNew, error } = await signInWithGoogle(profile);
    if (!session || error) {
      console.error("[google-auth] sign-in refused:", error);
      return fail("google_unverified");
    }
    if (isNew) {
      sendWelcomeMessage({ email: session.user.email, firstName: profile.givenName || "" }).catch(() => {});
    }
    const res = NextResponse.redirect(`${origin}${safeRedirect(saved.redirect)}`);
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    setSessionCookies(res, session, origin.startsWith("https://"));
    return res;
  } catch (err) {
    console.error("[google-auth] callback failed:", err instanceof Error ? err.message : err);
    return fail("google_failed");
  }
}
