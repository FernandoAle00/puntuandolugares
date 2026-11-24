import crypto from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  groupMember,
  place,
  placePhoto,
  placeVisit,
  rating,
  user,
  visitEntry,
} from "@/db/schema";
import {
  deriveRatingsFromVisits,
  getTodayIsoDate,
  type CreatePlaceInput,
  type CreateVisitInput,
  type PlacePhotoEntry,
  type PlaceVisit,
  type PlaceWithRatings,
  type RatingEntry,
  type UpdatePlaceInput,
  type UpdateVisitInput,
  type UpsertRatingInput,
  type UpsertVisitEntryInput,
  type VisitEntryItem,
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

function sortVisitsNewestFirst(a: PlaceVisit, b: PlaceVisit): number {
  if (a.visitedAt && b.visitedAt && a.visitedAt !== b.visitedAt) {
    return b.visitedAt.localeCompare(a.visitedAt);
  }
  if (a.visitedAt && !b.visitedAt) return -1;
  if (!a.visitedAt && b.visitedAt) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Fetches all places belonging to groups the authenticated user is a member of,
 * including visits, per-person visit entries, derived ratings, and photos in flat queries (no N+1).
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
  const [visitRows, legacyRatingRows, photoRows] = await Promise.all([
    db
      .select()
      .from(placeVisit)
      .where(inArray(placeVisit.placeId, placeIds))
      .orderBy(desc(placeVisit.visitedAt), desc(placeVisit.createdAt)),
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
        visitId: placePhoto.visitId,
        caption: placePhoto.caption,
        createdAt: placePhoto.createdAt,
        userName: user.name,
      })
      .from(placePhoto)
      .leftJoin(user, eq(placePhoto.userId, user.id))
      .where(inArray(placePhoto.placeId, placeIds))
      .orderBy(asc(placePhoto.createdAt)),
  ]);

  const visitIds = visitRows.map((v) => v.id);
  const entryRows =
    visitIds.length > 0
      ? await db
          .select({
            id: visitEntry.id,
            visitId: visitEntry.visitId,
            userId: visitEntry.userId,
            dish: visitEntry.dish,
            score: visitEntry.score,
            note: visitEntry.note,
            updatedAt: visitEntry.updatedAt,
            userName: user.name,
            userAccent: user.accentColor,
          })
          .from(visitEntry)
          .innerJoin(user, eq(visitEntry.userId, user.id))
          .where(inArray(visitEntry.visitId, visitIds))
      : [];

  const entriesByVisit = new Map<string, VisitEntryItem[]>();
  for (const row of entryRows) {
    const item: VisitEntryItem = {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userAccent: row.userAccent,
      dish: row.dish,
      score: row.score,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
    const bucket = entriesByVisit.get(row.visitId);
    if (bucket) bucket.push(item);
    else entriesByVisit.set(row.visitId, [item]);
  }

  const photosByPlace = new Map<string, PlacePhotoEntry[]>();
  const photosByVisit = new Map<string, PlacePhotoEntry[]>();
  for (const row of photoRows) {
    const entry: PlacePhotoEntry = {
      id: row.id,
      visitId: row.visitId ?? null,
      url: `/api/photos/${row.id}`,
      caption: row.caption,
      uploadedBy: row.userName ?? null,
      createdAt: row.createdAt.toISOString(),
    };
    const placeBucket = photosByPlace.get(row.placeId);
    if (placeBucket) placeBucket.push(entry);
    else photosByPlace.set(row.placeId, [entry]);

    if (row.visitId) {
      const visitBucket = photosByVisit.get(row.visitId);
      if (visitBucket) visitBucket.push(entry);
      else photosByVisit.set(row.visitId, [entry]);
    }
  }

  const visitsByPlace = new Map<string, PlaceVisit[]>();
  for (const row of visitRows) {
    const visit: PlaceVisit = {
      id: row.id,
      visitedAt: row.visitedAt,
      createdAt: row.createdAt.toISOString(),
      entries: (entriesByVisit.get(row.id) ?? []).sort((a, b) =>
        a.userName.localeCompare(b.userName, "es"),
      ),
      photos: photosByVisit.get(row.id) ?? [],
    };
    const bucket = visitsByPlace.get(row.placeId);
    if (bucket) bucket.push(visit);
    else visitsByPlace.set(row.placeId, [visit]);
  }

  const legacyRatingsByPlace = new Map<string, RatingEntry[]>();
  for (const row of legacyRatingRows) {
    const entry: RatingEntry = {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userAccent: row.userAccent,
      score: row.score,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
    const bucket = legacyRatingsByPlace.get(row.placeId);
    if (bucket) bucket.push(entry);
    else legacyRatingsByPlace.set(row.placeId, [entry]);
  }

  return places.map((p) => {
    const visits = (visitsByPlace.get(p.id) ?? []).sort(sortVisitsNewestFirst);
    const derived = deriveRatingsFromVisits(visits);
    const ratings =
      visits.length > 0
        ? derived
        : (legacyRatingsByPlace.get(p.id) ?? []).sort((a, b) =>
            a.userName.localeCompare(b.userName, "es"),
          );

    return {
      id: p.id,
      groupId: p.groupId,
      name: p.name,
      address: p.address,
      serviceType: p.serviceType,
      repeatMarked: p.repeatMarked,
      nextOrder: p.nextOrder,
      meals: p.meals,
      createdAt: p.createdAt.toISOString(),
      ratings,
      visits,
      photos: photosByPlace.get(p.id) ?? [],
    };
  });
}

export async function getPlaceWithRatings(placeId: string): Promise<PlaceWithRatings | null> {
  const [found] = await db.select().from(place).where(eq(place.id, placeId)).limit(1);
  if (!found) return null;

  const [visitRows, legacyRatingRows, photoRows] = await Promise.all([
    db
      .select()
      .from(placeVisit)
      .where(eq(placeVisit.placeId, placeId))
      .orderBy(desc(placeVisit.visitedAt), desc(placeVisit.createdAt)),
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
        visitId: placePhoto.visitId,
        caption: placePhoto.caption,
        createdAt: placePhoto.createdAt,
        userName: user.name,
      })
      .from(placePhoto)
      .leftJoin(user, eq(placePhoto.userId, user.id))
      .where(eq(placePhoto.placeId, placeId))
      .orderBy(asc(placePhoto.createdAt)),
  ]);

  const visitIds = visitRows.map((v) => v.id);
  const entryRows =
    visitIds.length > 0
      ? await db
          .select({
            id: visitEntry.id,
            visitId: visitEntry.visitId,
            userId: visitEntry.userId,
            dish: visitEntry.dish,
            score: visitEntry.score,
            note: visitEntry.note,
            updatedAt: visitEntry.updatedAt,
            userName: user.name,
            userAccent: user.accentColor,
          })
          .from(visitEntry)
          .innerJoin(user, eq(visitEntry.userId, user.id))
          .where(inArray(visitEntry.visitId, visitIds))
      : [];

  const entriesByVisit = new Map<string, VisitEntryItem[]>();
  for (const row of entryRows) {
    const item: VisitEntryItem = {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userAccent: row.userAccent,
      dish: row.dish,
      score: row.score,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
    const bucket = entriesByVisit.get(row.visitId);
    if (bucket) bucket.push(item);
    else entriesByVisit.set(row.visitId, [item]);
  }

  const photos: PlacePhotoEntry[] = photoRows.map((ph) => ({
    id: ph.id,
    visitId: ph.visitId ?? null,
    url: `/api/photos/${ph.id}`,
    caption: ph.caption,
    uploadedBy: ph.userName ?? null,
    createdAt: ph.createdAt.toISOString(),
  }));

  const photosByVisit = new Map<string, PlacePhotoEntry[]>();
  for (const ph of photos) {
    if (!ph.visitId) continue;
    const bucket = photosByVisit.get(ph.visitId);
    if (bucket) bucket.push(ph);
    else photosByVisit.set(ph.visitId, [ph]);
  }

  const visits: PlaceVisit[] = visitRows
    .map((v) => ({
      id: v.id,
      visitedAt: v.visitedAt,
      createdAt: v.createdAt.toISOString(),
      entries: (entriesByVisit.get(v.id) ?? []).sort((a, b) =>
        a.userName.localeCompare(b.userName, "es"),
      ),
      photos: photosByVisit.get(v.id) ?? [],
    }))
    .sort(sortVisitsNewestFirst);

  const ratings =
    visits.length > 0
      ? deriveRatingsFromVisits(visits)
      : legacyRatingRows
          .map((r) => ({
            id: r.id,
            userId: r.userId,
            userName: r.userName,
            userAccent: r.userAccent,
            score: r.score,
            note: r.note,
            updatedAt: r.updatedAt.toISOString(),
          }))
          .sort((a, b) => a.userName.localeCompare(b.userName, "es"));

  return {
    id: found.id,
    groupId: found.groupId,
    name: found.name,
    address: found.address,
    serviceType: found.serviceType,
    repeatMarked: found.repeatMarked,
    nextOrder: found.nextOrder,
    meals: found.meals,
    createdAt: found.createdAt.toISOString(),
    ratings,
    visits,
    photos,
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

  await db.transaction(async (tx) => {
    await tx.insert(place).values({
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
      const visitId = crypto.randomUUID();
      await tx.insert(placeVisit).values({
        id: visitId,
        placeId: id,
        visitedAt: input.initialRating.visitedAt ?? getTodayIsoDate(),
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(visitEntry).values({
        id: crypto.randomUUID(),
        visitId,
        userId,
        dish: input.initialRating.dish,
        score: input.initialRating.score,
        note: input.initialRating.note,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

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
      repeatMarked: input.repeatMarked ?? existing.repeatMarked,
      nextOrder: input.nextOrder ?? existing.nextOrder,
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

/**
 * Creates a new shared visit for a place along with the caller's dish, score, and note.
 */
export async function createPlaceVisit(
  placeId: string,
  userId: string,
  input: CreateVisitInput,
): Promise<
  | { status: "ok"; place: PlaceWithRatings; visitId: string }
  | { status: "not_found" }
  | { status: "forbidden" }
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
  const visitId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(placeVisit).values({
      id: visitId,
      placeId,
      visitedAt: input.visitedAt,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(visitEntry).values({
      id: crypto.randomUUID(),
      visitId,
      userId,
      dish: input.dish,
      score: input.score,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    });
  });

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated, visitId } : { status: "not_found" };
}

/**
 * Updates metadata (date) of an existing visit after verifying group membership.
 */
export async function updatePlaceVisit(
  placeId: string,
  visitId: string,
  userId: string,
  input: UpdateVisitInput,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [row] = await db
    .select({ id: placeVisit.id, groupId: place.groupId })
    .from(placeVisit)
    .innerJoin(place, eq(placeVisit.placeId, place.id))
    .where(and(eq(placeVisit.id, visitId), eq(placeVisit.placeId, placeId)))
    .limit(1);

  if (!row) return { status: "not_found" };

  const allowed = await isUserInGroup(userId, row.groupId);
  if (!allowed) return { status: "forbidden" };

  await db
    .update(placeVisit)
    .set({ visitedAt: input.visitedAt, updatedAt: new Date() })
    .where(eq(placeVisit.id, visitId));

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

/**
 * Deletes a visit (cascading its entries; any linked photos remain on the place with visitId = null).
 */
export async function deletePlaceVisit(
  placeId: string,
  visitId: string,
  userId: string,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [row] = await db
    .select({ id: placeVisit.id, groupId: place.groupId })
    .from(placeVisit)
    .innerJoin(place, eq(placeVisit.placeId, place.id))
    .where(and(eq(placeVisit.id, visitId), eq(placeVisit.placeId, placeId)))
    .limit(1);

  if (!row) return { status: "not_found" };

  const allowed = await isUserInGroup(userId, row.groupId);
  if (!allowed) return { status: "forbidden" };

  await db.delete(placeVisit).where(eq(placeVisit.id, visitId));

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

/**
 * Saves or updates a group member's dish, score, and note inside a shared visit.
 * Any member of the place's group can edit their own entry or another group member's entry.
 */
export async function upsertVisitEntry(
  placeId: string,
  visitId: string,
  callerId: string,
  input: UpsertVisitEntryInput,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [row] = await db
    .select({ id: placeVisit.id, groupId: place.groupId })
    .from(placeVisit)
    .innerJoin(place, eq(placeVisit.placeId, place.id))
    .where(and(eq(placeVisit.id, visitId), eq(placeVisit.placeId, placeId)))
    .limit(1);

  if (!row) return { status: "not_found" };

  const callerAllowed = await isUserInGroup(callerId, row.groupId);
  if (!callerAllowed) return { status: "forbidden" };

  const targetUserId = input.userId ?? callerId;
  if (targetUserId !== callerId) {
    const targetAllowed = await isUserInGroup(targetUserId, row.groupId);
    if (!targetAllowed) return { status: "forbidden" };
  }

  const now = new Date();
  const [existing] = await db
    .select({ id: visitEntry.id })
    .from(visitEntry)
    .where(and(eq(visitEntry.visitId, visitId), eq(visitEntry.userId, targetUserId)))
    .limit(1);

  if (existing) {
    await db
      .update(visitEntry)
      .set({
        dish: input.dish,
        score: input.score,
        note: input.note,
        updatedAt: now,
      })
      .where(eq(visitEntry.id, existing.id));
  } else {
    await db.insert(visitEntry).values({
      id: crypto.randomUUID(),
      visitId,
      userId: targetUserId,
      dish: input.dish,
      score: input.score,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    });
  }

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

/**
 * Removes a group member's entry from a visit, cleaning up the visit only if no entries or photos remain.
 */
export async function deleteVisitEntry(
  placeId: string,
  visitId: string,
  callerId: string,
  requestedUserId?: string,
): Promise<
  { status: "ok"; place: PlaceWithRatings } | { status: "not_found" } | { status: "forbidden" }
> {
  const [row] = await db
    .select({ id: placeVisit.id, groupId: place.groupId })
    .from(placeVisit)
    .innerJoin(place, eq(placeVisit.placeId, place.id))
    .where(and(eq(placeVisit.id, visitId), eq(placeVisit.placeId, placeId)))
    .limit(1);

  if (!row) return { status: "not_found" };

  const callerAllowed = await isUserInGroup(callerId, row.groupId);
  if (!callerAllowed) return { status: "forbidden" };

  const targetUserId = requestedUserId ?? callerId;
  if (targetUserId !== callerId) {
    const targetAllowed = await isUserInGroup(targetUserId, row.groupId);
    if (!targetAllowed) return { status: "forbidden" };
  }

  await db
    .delete(visitEntry)
    .where(and(eq(visitEntry.visitId, visitId), eq(visitEntry.userId, targetUserId)));

  const [remainingEntry, remainingPhoto] = await Promise.all([
    db.select({ id: visitEntry.id }).from(visitEntry).where(eq(visitEntry.visitId, visitId)).limit(1),
    db.select({ id: placePhoto.id }).from(placePhoto).where(eq(placePhoto.visitId, visitId)).limit(1),
  ]);

  if (remainingEntry.length === 0 && remainingPhoto.length === 0) {
    await db.delete(placeVisit).where(eq(placeVisit.id, visitId));
  }

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

/**
 * Backwards-compatible rating upsert: updates the caller's entry on the latest visit or creates Visit #1.
 */
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

  const [latestVisit] = await db
    .select({ id: placeVisit.id })
    .from(placeVisit)
    .where(eq(placeVisit.placeId, placeId))
    .orderBy(desc(placeVisit.visitedAt), desc(placeVisit.createdAt))
    .limit(1);

  if (latestVisit) {
    return upsertVisitEntry(placeId, latestVisit.id, userId, {
      dish: "",
      score: input.score,
      note: input.note,
    });
  }

  const created = await createPlaceVisit(placeId, userId, {
    visitedAt: getTodayIsoDate(),
    dish: "",
    score: input.score,
    note: input.note,
  });
  return created.status === "ok" ? { status: "ok", place: created.place } : created;
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

  const visits = await db
    .select({ id: placeVisit.id })
    .from(placeVisit)
    .where(eq(placeVisit.placeId, placeId));

  const visitIds = visits.map((v) => v.id);
  if (visitIds.length > 0) {
    await db
      .delete(visitEntry)
      .where(and(inArray(visitEntry.visitId, visitIds), eq(visitEntry.userId, userId)));
  }

  await db
    .delete(rating)
    .where(and(eq(rating.placeId, placeId), eq(rating.userId, userId)));

  const updated = await getPlaceWithRatings(placeId);
  return updated ? { status: "ok", place: updated } : { status: "not_found" };
}

export async function addPlacePhotoRecord(params: {
  placeId: string;
  visitId?: string | null;
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

  let verifiedVisitId: string | null = null;
  if (params.visitId) {
    const [validVisit] = await db
      .select({ id: placeVisit.id })
      .from(placeVisit)
      .where(and(eq(placeVisit.id, params.visitId), eq(placeVisit.placeId, params.placeId)))
      .limit(1);
    if (!validVisit) return { status: "not_found" };
    verifiedVisitId = validVisit.id;
  }

  await db.insert(placePhoto).values({
    id: crypto.randomUUID(),
    placeId: params.placeId,
    visitId: verifiedVisitId,
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
