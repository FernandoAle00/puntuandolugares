import { NextResponse } from "next/server";
import { deleteUserRating, upsertUserRating } from "@/db/places-repo";
import { upsertRatingSchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
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

  const parsed = upsertRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Puntaje inválido" },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await upsertUserRating(id, session.user.id, parsed.data);
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
  const result = await deleteUserRating(id, session.user.id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
  }
  if (result.status === "forbidden") {
    return NextResponse.json({ error: "Sin acceso a este lugar" }, { status: 403 });
  }

  return NextResponse.json({ place: result.place });
}
