import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { assertSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  const originResponse = await assertSameOrigin(request);

  if (originResponse) {
    return originResponse;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
