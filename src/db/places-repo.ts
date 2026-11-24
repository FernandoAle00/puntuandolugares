import crypto from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groupMember, place, placePhoto, rating, user } from "@/db/schema";
import type {
  CreatePlaceInput,
  PlacePhotoEntry,
  PlaceWithRatings,
  RatingEntry,
  UpdatePlaceInput,
  UpsertRatingInput,
} from "@/lib/domain";
import { removePhotoFile } from "@/lib/photos";

export async function isUserInGroup(userId: string, groupId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: groupMember.id })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Fetches all places belonging to groups the authenticated user is a member of,
 * including ratings and photos in flat queries (no N+1).
 */
export async function listPlacesForUser(
  userId: string,
  groupIdFilter?: string,
): Promise<PlaceWithRatings[]> {
  const memberships = await db
    .select({ groupId: groupMember.groupId })
    .from(groupMember)
    .where(eq(groupMember.userId, userId));

  const allowedGroupIds = memberships.map((m) => m.groupId);
  if (allowedGroupIds.length === 0) return [];

  const targetGroupIds = groupIdFilter
    ? allowedGroupIds.includes(groupIdFilter)
      ? [groupIdFilter]
      : []
    : allowedGroupIds;

  if (targetGroupIds.length === 0) return [];

  const places = await db
    .select()
    .from(place)
    .where(inArray(place.groupId, targetGroupIds))
    .orderBy(desc(place.createdAt));

  if (places.length === 0) return [];

  const placeIds = places.map((p) => p.id);
  const [ratingRows, photoRows] = await Promise.all([
    db
      .select({
        id: rating.id,
        placeId: rating.placeId,
        userId: rating.userId,
        score: rating.score,
        note: rating.note,
        updatedAt: rating.updatedAt,
        userName: user.name,
        userAccent: user.accentColor,
      })
      .from(rating)
      .innerJoin(user, eq(rating.userId, user.id))
      .where(inArray(rating.placeId, placeIds)),
    db
      .select({
        id: placePhoto.id,
        placeId: placePhoto.placeId,
        caption: placePhoto.caption,
        createdAt: placePhoto.createdAt,
        userName: user.name,
      })
      .from(placePhoto)
      .leftJoin(user, eq(placePhoto.userId, user.id))
      .where(inArray(placePhoto.placeId, placeIds))
      .orderBy(asc(placePhoto.createdAt)),
  ]);

  const ratingsByPlace = new Map<string, RatingEntry[]>();
  for (const row of ratingRows) {
    const entry: RatingEntry = {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userAccent: row.userAccent,
      score: row.score,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
    const bucket = ratingsByPlace.get(row.placeId);
    if (bucket) bucket.push(entry);
    else ratingsByPlace.set(row.placeId, [entry]);
  }

  const photosByPlace = new Map<string, PlacePhotoEntry[]>();
  for (const row of photoRows) {
    const entry: PlacePhotoEntry = {
      id: row.id,
      url: `/api/photos/${row.id}`,
      caption: row.caption,
      uploadedBy: row.userName ?? null,
      createdAt: row.createdAt.toISOString(),
    };
    const bucket = photosByPlace.get(row.placeId);
    if (bucket) bucket.push(entry);
    else photosByPlace.set(row.placeId, [entry]);
  }

  return places.map((p) => ({
    id: p.id,
    groupId: p.groupId,
    name: p.name,
    address: p.address,
    serviceType: p.serviceType,
    meals: p.meals,
    createdAt: p.createdAt.toISOString(),
    ratings: (ratingsByPlace.get(p.id) ?? []).sort((a, b) =>
      a.userName.localeCompare(b.userName, "es"),
    ),
    photos: photosByPlace.get(p.id) ?? [],
  }));
}

export async function getPlaceWithRatings(placeId: string): Promise<PlaceWithRatings | null> {
  const [found] = await db.select().from(place).where(eq(place.id, placeId)).limit(1);
  if (!found) return null;

  const [ratingRows, photoRows] = await Promise.all([
    db
      .select({
        id: rating.id,
        userId: rating.userId,
        score: rating.score,
        note: rating.note,
        updatedAt: rating.updatedAt,
        userName: user.name,
        userAccent: user.accentColor,
      })
      .from(rating)
      .innerJoin(user, eq(rating.userId, user.id))
      .where(eq(rating.placeId, placeId)),
    db
      .select({
        id: placePhoto.id,
        caption: placePhoto.caption,
        createdAt: placePhoto.createdAt,
        userName: user.name,
      })
      .from(placePhoto)
      .leftJoin(user, eq(placePhoto.userId, user.id))
      .where(eq(placePhoto.placeId, placeId))
      .orderBy(asc(placePhoto.createdAt)),
  ]);

  return {
    id: found.id,
    groupId: found.groupId,
    name: found.name,
    address: found.address,
    serviceType: found.serviceType,
    meals: found.meals,
    createdAt: found.createdAt.toISOString(),
    ratings: ratingRows
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        userAccent: r.userAccent,
        score: r.score,
        note: r.note,
        updatedAt: r.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName, "es")),
    photos: photoRows.map((ph) => ({
      id: ph.id,
      url: `/api/photos/${ph.id}`,
      caption: ph.caption,
      uploadedBy: ph.userName ?? null,
      createdAt: ph.createdAt.toISOString(),
    })),
  };
}

export async function createPlaceRecord(
  input: CreatePlaceInput,
  userId: string,
): Promise<{ status: "ok"; place: PlaceWithRatings } | { status: "forbidden" }> {
  const allowed = await isUserInGroup(userId, input.groupId);
  if (!allowed) return { status: "forbidden" };

  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(place).values({
    id,
    groupId: input.groupId,
    name: input.name,
    address: input.address,
    serviceType: input.serviceType,
    meals: input.meals,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  if (input.initialRating) {
    await db.insert(rating).values({
      id: crypto.randomUUID(),
      placeId: id,
      userId,
      score: input.initialRating.score,
      note: input.initialRating.note,
      createdAt: now,
      updatedAt: now,
    });
  }

  const created = await getPlaceWithRatings(id);
  if (!created) {
    throw new Error("No se pudo recuperar el lugar recién creado");
  }
  return { status: "ok", place: created };
}

export async function updatePlaceRecord(
  placeId: string,
  userId: string,
  input: UpdatePlaceInput,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [existing] = await db.select().from(place).where(eq(place.id, placeId)).limit(1);
  if (!existing) return { status: "not_found" };

  const allowed = await isUserInGroup(userId, existing.groupId);
  if (!allowed) return { status: "forbidden" };

  await db
    .update(place)
    .set({
      name: input.name ?? existing.name,
      address: input.address ?? existing.address,
      serviceType: input.serviceType ?? existing.serviceType,
      meals: input.meals ?? existing.meals,
      updatedAt: new Date(),
    })
    .where(eq(place.id, placeId));

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

export async function deletePlaceRecord(
  placeId: string,
  userId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const [existing] = await db
    .select({ id: place.id, groupId: place.groupId })
    .from(place)
    .where(eq(place.id, placeId))
    .limit(1);

  if (!existing) return "not_found";

  const allowed = await isUserInGroup(userId, existing.groupId);
  if (!allowed) return "forbidden";

  const photos = await db
    .select({ filename: placePhoto.filename })
    .from(placePhoto)
    .where(eq(placePhoto.placeId, placeId));

  await db.delete(place).where(eq(place.id, placeId));

  for (const ph of photos) {
    await removePhotoFile(ph.filename);
  }

  return "ok";
}

export async function upsertUserRating(
  placeId: string,
  userId: string,
  input: UpsertRatingInput,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [existingPlace] = await db
    .select({ id: place.id, groupId: place.groupId })
    .from(place)
    .where(eq(place.id, placeId))
    .limit(1);

  if (!existingPlace) return { status: "not_found" };

  const allowed = await isUserInGroup(userId, existingPlace.groupId);
  if (!allowed) return { status: "forbidden" };

  const now = new Date();
  const [existingRating] = await db
    .select({ id: rating.id })
    .from(rating)
    .where(and(eq(rating.placeId, placeId), eq(rating.userId, userId)))
    .limit(1);

  if (existingRating) {
    await db
      .update(rating)
      .set({
        score: input.score,
        note: input.note,
        updatedAt: now,
      })
      .where(eq(rating.id, existingRating.id));
  } else {
    await db.insert(rating).values({
      id: crypto.randomUUID(),
      placeId,
      userId,
      score: input.score,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    });
  }

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

export async function deleteUserRating(
  placeId: string,
  userId: string,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [existingPlace] = await db
    .select({ id: place.id, groupId: place.groupId })
    .from(place)
    .where(eq(place.id, placeId))
    .limit(1);

  if (!existingPlace) return { status: "not_found" };

  const allowed = await isUserInGroup(userId, existingPlace.groupId);
  if (!allowed) return { status: "forbidden" };

  await db
    .delete(rating)
    .where(and(eq(rating.placeId, placeId), eq(rating.userId, userId)));

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

export async function addPlacePhotoRecord(params: {
  placeId: string;
  userId: string;
  filename: string;
  mimeType: string;
  caption: string;
}): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [existingPlace] = await db
    .select({ id: place.id, groupId: place.groupId })
    .from(place)
    .where(eq(place.id, params.placeId))
    .limit(1);

  if (!existingPlace) return { status: "not_found" };

  const allowed = await isUserInGroup(params.userId, existingPlace.groupId);
  if (!allowed) return { status: "forbidden" };

  await db.insert(placePhoto).values({
    id: crypto.randomUUID(),
    placeId: params.placeId,
    userId: params.userId,
    filename: params.filename,
    mimeType: params.mimeType,
    caption: params.caption.slice(0, 140),
    createdAt: new Date(),
  });

  const updated = await getPlaceWithRatings(params.placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

export async function getAuthorizedPhoto(
  photoId: string,
  userId: string,
): Promise<
  | { status: "ok"; filename: string; mimeType: string; placeId: string }
  | { status: "not_found" }
  | { status: "forbidden" }
> {
  const [row] = await db
    .select({
      id: placePhoto.id,
      placeId: placePhoto.placeId,
      filename: placePhoto.filename,
      mimeType: placePhoto.mimeType,
      groupId: place.groupId,
    })
    .from(placePhoto)
    .innerJoin(place, eq(placePhoto.placeId, place.id))
    .where(eq(placePhoto.id, photoId))
    .limit(1);

  if (!row) return { status: "not_found" };

  const allowed = await isUserInGroup(userId, row.groupId);
  if (!allowed) return { status: "forbidden" };

  return {
    status: "ok",
    filename: row.filename,
    mimeType: row.mimeType,
    placeId: row.placeId,
  };
}

export async function deleteAuthorizedPhoto(
  photoId: string,
  userId: string,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const found = await getAuthorizedPhoto(photoId, userId);
  if (found.status !== "ok") return found;

  await db.delete(placePhoto).where(eq(placePhoto.id, photoId));
  await removePhotoFile(found.filename);

  const updated = await getPlaceWithRatings(found.placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}
