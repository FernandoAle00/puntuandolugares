import { NextResponse } from "next/server";
import {
  getSocialSnapshot,
  removeFriendship,
  respondToFriendRequest,
} from "@/db/social-repo";
import { friendRespondSchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = friendRespondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await respondToFriendRequest(id, session.user.id, parsed.data.action);
  if (result === "not_found") {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (result === "forbidden") {
    return NextResponse.json({ error: "No podés responder esta solicitud" }, { status: 403 });
  }

  const social = await getSocialSnapshot(session.user.id);
  return NextResponse.json({ social });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await removeFriendship(id, session.user.id);
  if (result === "not_found") {
    return NextResponse.json({ error: "Relación no encontrada" }, { status: 404 });
  }
  if (result === "forbidden") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const social = await getSocialSnapshot(session.user.id);
  return NextResponse.json({ social });
}
