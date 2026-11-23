import { NextResponse } from "next/server";
import { createGroupForUser, listGroupsForUser } from "@/db/social-repo";
import { createGroupSchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const groups = await listGroupsForUser(session.user.id);
  return NextResponse.json({ groups });
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

  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const result = await createGroupForUser(session.user.id, parsed.data);
  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 403 });
  }

  return NextResponse.json({ group: result.group }, { status: 201 });
}
