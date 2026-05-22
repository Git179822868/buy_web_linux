import { NextResponse } from "next/server";

import { createCaptchaChallenge } from "@/lib/captcha";

export function GET() {
  return NextResponse.json(createCaptchaChallenge(), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
