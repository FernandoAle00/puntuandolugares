import { NextResponse } from "next/server";
import { addPlacePhotoRecord, isUserInGroup } from "@/db/places-repo";
import { db } from "@/db";
import { place } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  detectImageFormat,
  MAX_PHOTO_BYTES,
  removePhotoFile,
  savePhotoBuffer,
} from "@/lib/photos";
import { requireSession } from "@/lib/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: placeId } = await context.params;
  const [targetPlace] = await db
    .select({ id: place.id, groupId: place.groupId })
    .from(place)
    .where(eq(place.id, placeId))
    .limit(1);

  if (!targetPlace) {
    return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
  }

  const allowed = await isUserInGroup(session.user.id, targetPlace.groupId);
  if (!allowed) {
    return NextResponse.json({ error: "Sin acceso a este lugar" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  const caption = String(formData.get("caption") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Seleccioná una imagen" }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "La foto debe pesar menos de 5 MB" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectImageFormat(buf);
  if (!detected) {
    return NextResponse.json(
      { error: "Formato no soportado. Usá JPG, PNG, WebP o AVIF." },
      { status: 400 },
    );
  }

  const filename = await savePhotoBuffer(buf, detected.ext);
  const result = await addPlacePhotoRecord({
    placeId,
    userId: session.user.id,
    filename,
    mimeType: detected.mimeType,
    caption,
  });

  if (result.status !== "ok") {
    await removePhotoFile(filename);
    return NextResponse.json(
      { error: "No se pudo guardar la foto" },
      { status: result.status === "forbidden" ? 403 : 404 },
    );
  }

  return NextResponse.json({ place: result.place }, { status: 201 });
}
