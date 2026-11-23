import crypto from "node:crypto";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const GET = handler.GET;

export async function POST(request: Request) {
  const expectedInvite = process.env.INVITE_CODE?.trim();
  const pathname = new URL(request.url).pathname;

  if (expectedInvite && pathname.endsWith("/sign-up/email")) {
    const providedInvite = request.headers.get("x-invite-code")?.trim() ?? "";
    if (!providedInvite || !timingSafeEquals(providedInvite, expectedInvite)) {
      return NextResponse.json(
        { message: "Código de invitación inválido" },
        { status: 403 },
      );
    }
  }

  return handler.POST(request);
}
