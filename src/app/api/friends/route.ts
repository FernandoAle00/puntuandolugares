import { NextResponse } from "next/server";
import { getSocialSnapshot, sendFriendRequestByEmail } from "@/db/social-repo";
import { friendRequestSchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const social = await getSocialSnapshot(session.user.id);
  return NextResponse.json({ social });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = friendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Email inválido" },
      { status: 400 },
    );
  }

  const result = await sendFriendRequestByEmail(session.user.id, parsed.data.email);
  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: result.httpStatus });
  }

  const social = await getSocialSnapshot(session.user.id);
  return NextResponse.json(
    { status: result.status, social },
    { status: result.status === "sent" ? 201 : 200 },
  );
}
