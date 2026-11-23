import { NextResponse } from "next/server";
import { addFriendToGroup } from "@/db/social-repo";
import { addGroupMemberSchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

  const parsed = addGroupMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await addFriendToGroup(id, session.user.id, parsed.data.userId);
  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: result.httpStatus });
  }

  return NextResponse.json({ group: result.group });
}
