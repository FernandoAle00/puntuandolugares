import { z } from "zod";
import type { AccentColor, GroupRole, MealType, PhotoKind, ServiceType } from "@/db/schema";

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

export const SCORE_CATEGORIES = ["service", "food", "place", "price"] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

/**
 * Display order for delivery places: Comida, Precio, Tiempo de envío (stored in `service`), Llegada (stored in `place`).
 */
export const DELIVERY_SCORE_CATEGORIES = ["food", "price", "service", "place"] as const;

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  service: "Atención",
  food: "Comida",
  place: "Lugar",
  price: "Precio",
};

const DELIVERY_SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  food: "Comida",
  price: "Precio",
  service: "Tiempo de envío",
  place: "Llegada",
};

const DELIVERY_SCORE_CATEGORY_COMPACT_LABELS: Record<ScoreCategory, string> = {
  food: "Comida",
  price: "Precio",
  service: "Envío",
  place: "Llegada",
};

/**
 * Returns the ordered 4 evaluation categories for a given service type.
 */
export function getScoreCategories(
  serviceType: ServiceType = "dine_in",
): readonly ScoreCategory[] {
  return serviceType === "delivery" ? DELIVERY_SCORE_CATEGORIES : SCORE_CATEGORIES;
}

/**
 * Returns the user-facing label for a score category according to the place's service type.
 */
export function getScoreCategoryLabel(
  category: ScoreCategory,
  serviceType: ServiceType = "dine_in",
  options?: { compact?: boolean },
): string {
  if (serviceType === "delivery") {
    return options?.compact
      ? DELIVERY_SCORE_CATEGORY_COMPACT_LABELS[category]
      : DELIVERY_SCORE_CATEGORY_LABELS[category];
  }
  return SCORE_CATEGORY_LABELS[category];
}

export interface ScoreBreakdown {
  service: number;
  food: number;
  place: number;
  price: number;
}

export const DEFAULT_SCORE_BREAKDOWN: ScoreBreakdown = {
  service: 8,
  food: 8,
  place: 8,
  price: 8,
};

export const mealSchema = z.enum(["desayuno", "almuerzo", "merienda", "cena", "postre"]);
export const serviceTypeSchema = z.enum(["dine_in", "delivery", "ice_cream"]);
export const photoKindSchema = z.enum(["general", "next_order"]);

export const scoreSchema = z
  .number({ invalid_type_error: "El puntaje tiene que ser un número" })
  .min(1, "El puntaje mínimo es 1")
  .max(10, "El puntaje máximo es 10")
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
    message: "Usá pasos de 0,1 (por ejemplo 7,5 u 8,3)",
  });

export const scoreBreakdownSchema = z.object({
  service: scoreSchema,
  food: scoreSchema,
  place: scoreSchema,
  price: scoreSchema,
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
      scores: scoreBreakdownSchema,
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
  scores: scoreBreakdownSchema,
  note: z.string().trim().max(600, "La reseña es demasiado larga").optional(),
});

export const createVisitSchema = z.object({
  visitedAt: visitDateSchema.default(""),
  dish: z.string().trim().max(240, "Texto de comida demasiado largo").default(""),
  scores: scoreBreakdownSchema,
  note: z.string().trim().max(600, "La reseña es demasiado larga").default(""),
});

export const updateVisitSchema = z.object({
  visitedAt: visitDateSchema,
});

export const upsertVisitEntrySchema = z.object({
  userId: z.string().min(1).optional(),
  dish: z.string().trim().max(240, "Texto de comida demasiado largo").optional(),
  scores: scoreBreakdownSchema,
  note: z.string().trim().max(600, "La reseña es demasiado larga").optional(),
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
  scores: ScoreBreakdown;
  note: string;
  updatedAt: string;
}

export interface PlacePhotoEntry {
  id: string;
  visitId: string | null;
  kind: PhotoKind;
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
  score: number | null;
  scores: ScoreBreakdown | null;
  legacyScore: number | null;
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

function roundOneDecimal(value: number): number {
  return Math.round((value + 1e-12) * 10) / 10;
}

/**
 * Computes the exact arithmetic mean across the 4 evaluation categories (Atención, Comida, Lugar, Precio).
 * Sums in integer tenths to avoid IEEE-754 drift on boundary values like (1 + 1 + 1.1 + 8.7) / 4 = 2.95.
 */
export function computeBreakdownAverage(scores: ScoreBreakdown): number {
  const totalTenths =
    Math.round(scores.service * 10) +
    Math.round(scores.food * 10) +
    Math.round(scores.place * 10) +
    Math.round(scores.price * 10);
  return totalTenths / 40;
}

/**
 * Computes the group-wide average breakdown across all scored members for a place.
 */
export function computePlaceBreakdown(
  ratings: readonly Pick<RatingEntry, "scores">[],
): ScoreBreakdown | null {
  if (ratings.length === 0) return null;
  let service = 0;
  let food = 0;
  let place = 0;
  let price = 0;
  for (const r of ratings) {
    service += r.scores.service;
    food += r.scores.food;
    place += r.scores.place;
    price += r.scores.price;
  }
  const n = ratings.length;
  return {
    service: roundOneDecimal(service / n),
    food: roundOneDecimal(food / n),
    place: roundOneDecimal(place / n),
    price: roundOneDecimal(price / n),
  };
}

/**
 * Derives each user's overall rating for a place by averaging their 4-category scores across visits.
 * Preserves full floating-point precision so downstream place-level averages only round once at display.
 * Legacy visit entries without 4-category scores are preserved for their dish/review text but excluded
 * from the derived score until re-rated.
 */
export function deriveRatingsFromVisits(visits: readonly PlaceVisit[]): RatingEntry[] {
  const byUser = new Map<
    string,
    {
      userId: string;
      userName: string;
      userAccent: AccentColor;
      totalScore: number;
      serviceTotal: number;
      foodTotal: number;
      placeTotal: number;
      priceTotal: number;
      count: number;
      latestNote: string;
      latestUpdatedAt: string;
      latestEntryId: string;
    }
  >();

  for (const visit of visits) {
    for (const entry of visit.entries) {
      if (!entry.scores) continue;
      const entryRawMean = computeBreakdownAverage(entry.scores);
      const existing = byUser.get(entry.userId);
      if (!existing) {
        byUser.set(entry.userId, {
          userId: entry.userId,
          userName: entry.userName,
          userAccent: entry.userAccent,
          totalScore: entryRawMean,
          serviceTotal: entry.scores.service,
          foodTotal: entry.scores.food,
          placeTotal: entry.scores.place,
          priceTotal: entry.scores.price,
          count: 1,
          latestNote: entry.note.trim(),
          latestUpdatedAt: entry.updatedAt,
          latestEntryId: entry.id,
        });
      } else {
        existing.totalScore += entryRawMean;
        existing.serviceTotal += entry.scores.service;
        existing.foodTotal += entry.scores.food;
        existing.placeTotal += entry.scores.place;
        existing.priceTotal += entry.scores.price;
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
      score: agg.totalScore / agg.count,
      scores: {
        service: agg.serviceTotal / agg.count,
        food: agg.foodTotal / agg.count,
        place: agg.placeTotal / agg.count,
        price: agg.priceTotal / agg.count,
      },
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
  return roundOneDecimal(total / ratings.length);
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
  return roundOneDecimal(max - min);
}

export function isPendingPlace(place: Pick<PlaceWithRatings, "ratings">): boolean {
  return place.ratings.length === 0;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Sin nota";
  const rounded = roundOneDecimal(score);
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
    const nextOrderPhotosText = p.photos
      .filter((ph) => ph.kind === "next_order")
      .map((ph) => ph.caption)
      .join(" ");
    const haystack =
      `${p.name} ${p.address} ${p.nextOrder} ${nextOrderPhotosText} ${notesText} ${visitsText}`.toLowerCase();
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
