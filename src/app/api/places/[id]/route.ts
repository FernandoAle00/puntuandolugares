import { NextResponse } from "next/server";
import { deletePlaceRecord, updatePlaceRecord } from "@/db/places-repo";
import { updatePlaceSchema } from "@/lib/domain";
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

  const parsed = updatePlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await updatePlaceRecord(id, session.user.id, parsed.data);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
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

  const { id } = await context.params;
  const result = await deletePlaceRecord(id, session.user.id);
  if (result === "not_found") {
    return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
  }
  if (result === "forbidden") {
    return NextResponse.json({ error: "Sin acceso a este lugar" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
