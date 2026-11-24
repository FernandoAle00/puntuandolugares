import { NextResponse } from "next/server";
import { deleteVisitEntry, upsertVisitEntry } from "@/db/places-repo";
import { upsertVisitEntrySchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string; visitId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
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

  const parsed = upsertVisitEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Puntaje inválido" },
      { status: 400 },
    );
  }

  const { id, visitId } = await context.params;
  const result = await upsertVisitEntry(id, visitId, session.user.id, parsed.data);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
  if (result.status === "forbidden") {
    return NextResponse.json({ error: "Sin acceso a este lugar" }, { status: 403 });
  }

  return NextResponse.json({ place: result.place });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id, visitId } = await context.params;
  const result = await deleteVisitEntry(id, visitId, session.user.id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
  if (result.status === "forbidden") {
    return NextResponse.json({ error: "Sin acceso a este lugar" }, { status: 403 });
  }

  return NextResponse.json({ place: result.place });
}
