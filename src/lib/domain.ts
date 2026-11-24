import { z } from "zod";
import type { AccentColor, GroupRole, MealType, ServiceType } from "@/db/schema";

export const MEALS: readonly MealType[] = [
  "desayuno",
  "almuerzo",
  "merienda",
  "cena",
  "postre",
] as const;

export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
  postre: "Postre",
};

export const SERVICE_TYPES: readonly ServiceType[] = [
  "dine_in",
  "delivery",
  "ice_cream",
] as const;

export const SERVICE_LABELS: Record<ServiceType, string> = {
  dine_in: "Salidas",
  delivery: "Delivery",
  ice_cream: "Heladerías",
};

export const SERVICE_FULL_LABELS: Record<ServiceType, string> = {
  dine_in: "Salidas",
  delivery: "Delivery / Take away",
  ice_cream: "Heladerías",
};

export const ACCENTS: readonly AccentColor[] = [
  "teal",
  "orange",
  "cobalt",
  "berry",
] as const;

export const mealSchema = z.enum(["desayuno", "almuerzo", "merienda", "cena", "postre"]);
export const serviceTypeSchema = z.enum(["dine_in", "delivery", "ice_cream"]);

export const scoreSchema = z
  .number({ invalid_type_error: "El puntaje tiene que ser un número" })
  .min(1, "El puntaje mínimo es 1")
  .max(10, "El puntaje máximo es 10")
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
    message: "Usá pasos de 0,1 (por ejemplo 7,5 u 8,3)",
  });

export const visitDateSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Usá una fecha válida (AAAA-MM-DD)",
  });

export const createPlaceSchema = z.object({
  groupId: z.string().min(1, "Elegí un grupo"),
  name: z
    .string()
    .trim()
    .min(1, "Escribí el nombre del lugar")
    .max(120, "Nombre demasiado largo"),
  address: z.string().trim().max(240, "Dirección demasiado larga").default(""),
  serviceType: serviceTypeSchema.default("dine_in"),
  meals: z
    .array(mealSchema)
    .min(1, "Elegí al menos un momento")
    .max(5)
    .transform((arr) => Array.from(new Set(arr))),
  initialRating: z
    .object({
      dish: z.string().trim().max(240, "Texto de comida demasiado largo").default(""),
      score: scoreSchema,
      note: z.string().trim().max(600, "La reseña es demasiado larga").default(""),
      visitedAt: visitDateSchema.optional(),
    })
    .optional(),
});

export const updatePlaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribí el nombre del lugar")
    .max(120, "Nombre demasiado largo")
    .optional(),
  address: z.string().trim().max(240, "Dirección demasiado larga").optional(),
  serviceType: serviceTypeSchema.optional(),
  repeatMarked: z.boolean().optional(),
  nextOrder: z.string().trim().max(300, "Texto demasiado largo").optional(),
  meals: z
    .array(mealSchema)
    .min(1, "Elegí al menos un momento")
    .max(5)
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
});

export const upsertRatingSchema = z.object({
  score: scoreSchema,
  note: z.string().trim().max(600, "La reseña es demasiado larga").default(""),
});

export const createVisitSchema = z.object({
  visitedAt: visitDateSchema.default(""),
  dish: z.string().trim().max(240, "Texto de comida demasiado largo").default(""),
  score: scoreSchema,
  note: z.string().trim().max(600, "La reseña es demasiado larga").default(""),
});

export const updateVisitSchema = z.object({
  visitedAt: visitDateSchema,
});

export const upsertVisitEntrySchema = z.object({
  userId: z.string().min(1).optional(),
  dish: z.string().trim().max(240, "Texto de comida demasiado largo").default(""),
  score: scoreSchema,
  note: z.string().trim().max(600, "La reseña es demasiado larga").default(""),
});

export const friendRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
});

export const friendRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribí un nombre para el grupo")
    .max(80, "Nombre demasiado largo"),
  memberIds: z.array(z.string().min(1)).max(30).default([]),
});

export const addGroupMemberSchema = z.object({
  userId: z.string().min(1, "Elegí un amigo"),
});

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
export type UpsertRatingInput = z.infer<typeof upsertRatingSchema>;
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
export type UpsertVisitEntryInput = z.infer<typeof upsertVisitEntrySchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  accentColor: AccentColor;
}

export interface FriendItem {
  friendshipId: string;
  user: UserSummary;
}

export interface SocialSnapshot {
  friends: FriendItem[];
  incomingRequests: FriendItem[];
  outgoingRequests: FriendItem[];
}

export interface GroupMemberSummary extends UserSummary {
  role: GroupRole;
}

export interface GroupSummary {
  id: string;
  name: string;
  isPersonal: boolean;
  members: GroupMemberSummary[];
}

export interface RatingEntry {
  id: string;
  userId: string;
  userName: string;
  userAccent: AccentColor;
  score: number;
  note: string;
  updatedAt: string;
}

export interface PlacePhotoEntry {
  id: string;
  visitId: string | null;
  url: string;
  caption: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface VisitEntryItem {
  id: string;
  userId: string;
  userName: string;
  userAccent: AccentColor;
  dish: string;
  score: number;
  note: string;
  updatedAt: string;
}

export interface PlaceVisit {
  id: string;
  visitedAt: string;
  createdAt: string;
  entries: VisitEntryItem[];
  photos: PlacePhotoEntry[];
}

export interface PlaceWithRatings {
  id: string;
  groupId: string;
  name: string;
  address: string;
  serviceType: ServiceType;
  repeatMarked: boolean;
  nextOrder: string;
  meals: MealType[];
  createdAt: string;
  ratings: RatingEntry[];
  visits: PlaceVisit[];
  photos: PlacePhotoEntry[];
}

export type ViewMode = "ranking" | "pending" | "gap";

/**
 * Derives each user's overall rating for a place by averaging their scores across visits.
 */
export function deriveRatingsFromVisits(visits: readonly PlaceVisit[]): RatingEntry[] {
  const byUser = new Map<
    string,
    {
      userId: string;
      userName: string;
      userAccent: AccentColor;
      total: number;
      count: number;
      latestNote: string;
      latestUpdatedAt: string;
      latestEntryId: string;
    }
  >();

  for (const visit of visits) {
    for (const entry of visit.entries) {
      const existing = byUser.get(entry.userId);
      if (!existing) {
        byUser.set(entry.userId, {
          userId: entry.userId,
          userName: entry.userName,
          userAccent: entry.userAccent,
          total: entry.score,
          count: 1,
          latestNote: entry.note.trim(),
          latestUpdatedAt: entry.updatedAt,
          latestEntryId: entry.id,
        });
      } else {
        existing.total += entry.score;
        existing.count += 1;
        if (entry.updatedAt >= existing.latestUpdatedAt) {
          existing.latestUpdatedAt = entry.updatedAt;
          existing.latestEntryId = entry.id;
          if (entry.note.trim()) {
            existing.latestNote = entry.note.trim();
          }
        } else if (!existing.latestNote && entry.note.trim()) {
          existing.latestNote = entry.note.trim();
        }
      }
    }
  }

  return Array.from(byUser.values())
    .map((agg) => ({
      id: agg.latestEntryId,
      userId: agg.userId,
      userName: agg.userName,
      userAccent: agg.userAccent,
      score: Math.round((agg.total / agg.count) * 10) / 10,
      note: agg.latestNote,
      updatedAt: agg.latestUpdatedAt,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, "es"));
}

const SHORT_MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/**
 * Formats an ISO visit date (YYYY-MM-DD) for display in Rioplatense Spanish.
 */
export function formatVisitDate(visitedAt: string, referenceYear?: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(visitedAt.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const month = SHORT_MONTHS_ES[monthIdx];
  if (!month || day < 1 || day > 31) return visitedAt;
  const currentYear = referenceYear ?? new Date().getFullYear();
  return year === currentYear ? `${day} ${month}` : `${day} ${month} ${year}`;
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the arithmetic mean of all ratings for a place, or null if none exist.
 */
export function computeAverage(ratings: readonly Pick<RatingEntry, "score">[]): number | null {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, r) => sum + r.score, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

/**
 * Returns the difference between the highest and lowest score when at least two people rated the place.
 */
export function computeGap(ratings: readonly Pick<RatingEntry, "score">[]): number | null {
  if (ratings.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const r of ratings) {
    if (r.score < min) min = r.score;
    if (r.score > max) max = r.score;
  }
  return Math.round((max - min) * 10) / 10;
}

export function isPendingPlace(place: Pick<PlaceWithRatings, "ratings">): boolean {
  return place.ratings.length === 0;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Sin nota";
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

export function buildGoogleMapsUrl(place: Pick<PlaceWithRatings, "name" | "address">): string {
  const query = place.address.trim()
    ? `${place.name}, ${place.address}`
    : place.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Filters and sorts places for the active tab, service type, repeat flag, meal filter, and search text.
 */
export function filterAndSortPlaces(
  places: readonly PlaceWithRatings[],
  options: {
    mode: ViewMode;
    meal: MealType | "all";
    serviceType?: ServiceType;
    onlyRepeat?: boolean;
    query?: string;
  },
): PlaceWithRatings[] {
  const normalizedQuery = (options.query ?? "").trim().toLowerCase();

  const matching = places.filter((p) => {
    if (options.onlyRepeat && !p.repeatMarked) return false;
    if (options.serviceType && p.serviceType !== options.serviceType) return false;
    if (options.meal !== "all" && !p.meals.includes(options.meal)) return false;
    if (!normalizedQuery) return true;
    const notesText = p.ratings.map((r) => `${r.userName} ${r.note}`).join(" ");
    const visitsText = p.visits
      .flatMap((v) => v.entries.map((e) => `${e.userName} ${e.dish} ${e.note}`))
      .join(" ");
    const haystack = `${p.name} ${p.address} ${p.nextOrder} ${notesText} ${visitsText}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  if (options.onlyRepeat) {
    return [...matching].sort((a, b) => {
      const avgA = computeAverage(a.ratings) ?? -1;
      const avgB = computeAverage(b.ratings) ?? -1;
      if (avgB !== avgA) return avgB - avgA;
      return a.name.localeCompare(b.name, "es");
    });
  }

  if (options.mode === "pending") {
    return matching
      .filter((p) => isPendingPlace(p))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  if (options.mode === "gap") {
    return matching
      .filter((p) => computeGap(p.ratings) !== null)
      .sort((a, b) => {
        const diff = (computeGap(b.ratings) ?? 0) - (computeGap(a.ratings) ?? 0);
        if (diff !== 0) return diff;
        return (computeAverage(b.ratings) ?? 0) - (computeAverage(a.ratings) ?? 0);
      });
  }

  return matching
    .filter((p) => !isPendingPlace(p))
    .sort((a, b) => {
      const diff = (computeAverage(b.ratings) ?? 0) - (computeAverage(a.ratings) ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "es");
    });
}

/**
 * Picks a random place from a list, avoiding the currently highlighted place when more than one exists.
 */
export function pickRandomPlace(
  places: readonly PlaceWithRatings[],
  excludeId?: string | null,
  randomFn: () => number = Math.random,
): PlaceWithRatings | null {
  if (places.length === 0) return null;
  const pool =
    excludeId && places.length > 1
      ? places.filter((p) => p.id !== excludeId)
      : places;
  const idx = Math.floor(randomFn() * pool.length);
  return pool[idx] ?? places[0] ?? null;
}

/**
 * Picks a random pending place, avoiding the currently highlighted place when more than one exists.
 */
export function pickRandomPending(
  places: readonly PlaceWithRatings[],
  excludeId?: string | null,
  randomFn: () => number = Math.random,
): PlaceWithRatings | null {
  return pickRandomPlace(places.filter(isPendingPlace), excludeId, randomFn);
}
