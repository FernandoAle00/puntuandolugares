import { NextResponse } from "next/server";
import { deleteAuthorizedPhoto, getAuthorizedPhoto } from "@/db/places-repo";
import { readPhotoBuffer } from "@/lib/photos";
import { requireSession } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const found = await getAuthorizedPhoto(id, session.user.id);
  if (found.status === "not_found") {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  if (found.status === "forbidden") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const buffer = await readPhotoBuffer(found.filename);
  if (!buffer) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": found.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await deleteAuthorizedPhoto(id, session.user.id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  if (result.status === "forbidden") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  return NextResponse.json({ place: result.place });
}
