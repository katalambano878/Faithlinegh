import { NextRequest, NextResponse } from "next/server";
import { googleConfig, callbackUrl, newPkce, safeRedirect, siteOrigin, GOOGLE_STATE_COOKIE } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Start Google sign-in: send the customer to Google's account picker. */
export async function GET(req: NextRequest) {
  const cfg = googleConfig();
  const origin = siteOrigin(req);
  if (!cfg) return NextResponse.redirect(`${origin}/auth/login?error=google_unavailable`);

  const { state, verifier, challenge } = newPkce();
  const redirect = safeRedirect(req.nextUrl.searchParams.get("redirect"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, verifier, redirect }), {
    path: "/api/auth/google",
    maxAge: 600,
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
  });
  return res;
}
