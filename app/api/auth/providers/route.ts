import { NextResponse } from "next/server";
import { googleConfig } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

/** Which social sign-ins are switched on, so the pages only show working buttons. */
export async function GET() {
  return NextResponse.json({ google: !!googleConfig() }, { headers: { "Cache-Control": "no-store" } });
}
