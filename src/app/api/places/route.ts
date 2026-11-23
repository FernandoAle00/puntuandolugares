import { NextResponse } from "next/server";
import { createPlaceRecord, listPlacesForUser } from "@/db/places-repo";
import { createPlaceSchema } from "@/lib/domain";
import { requireSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const groupId = new URL(request.url).searchParams.get("groupId") || undefined;
  const places = await listPlacesForUser(session.user.id, groupId);
  return NextResponse.json({ places });
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

  const parsed = createPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const result = await createPlaceRecord(parsed.data, session.user.id);
  if (result.status === "forbidden") {
    return NextResponse.json({ error: "No pertenecés a este grupo" }, { status: 403 });
  }

  return NextResponse.json({ place: result.place }, { status: 201 });
}
