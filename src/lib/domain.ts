import { z } from "zod";
import type { AccentColor, GroupRole, MealType } from "@/db/schema";

export const MEALS: readonly MealType[] = [
  "desayuno",
  "almuerzo",
  "merienda",
  "cena",
] as const;

export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};

export const ACCENTS: readonly AccentColor[] = [
  "teal",
  "orange",
  "cobalt",
  "berry",
] as const;

export const mealSchema = z.enum(["desayuno", "almuerzo", "merienda", "cena"]);

export const scoreSchema = z
  .number({ invalid_type_error: "El puntaje tiene que ser un número" })
  .min(1, "El puntaje mínimo es 1")
  .max(10, "El puntaje máximo es 10")
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
    message: "Usá pasos de 0,1 (por ejemplo 7,5 u 8,3)",
  });

export const createPlaceSchema = z.object({
  groupId: z.string().min(1, "Elegí un grupo"),
  name: z
    .string()
    .trim()
    .min(1, "Escribí el nombre del lugar")
    .max(120, "Nombre demasiado largo"),
  address: z.string().trim().max(240, "Dirección demasiado larga").default(""),
  meals: z
    .array(mealSchema)
    .min(1, "Elegí al menos un momento")
    .max(4)
    .transform((arr) => Array.from(new Set(arr))),
  initialRating: z
    .object({
      score: scoreSchema,
      note: z.string().trim().max(600, "La reseña es demasiado larga").default(""),
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
  meals: z
    .array(mealSchema)
    .min(1, "Elegí al menos un momento")
    .max(4)
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
});

export const upsertRatingSchema = z.object({
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
  url: string;
  caption: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface PlaceWithRatings {
  id: string;
  groupId: string;
  name: string;
  address: string;
  meals: MealType[];
  createdAt: string;
  ratings: RatingEntry[];
  photos: PlacePhotoEntry[];
}

export type ViewMode = "ranking" | "pending" | "gap";

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
 * Filters and sorts places for the active tab, meal filter, and search text.
 */
export function filterAndSortPlaces(
  places: readonly PlaceWithRatings[],
  options: {
    mode: ViewMode;
    meal: MealType | "all";
    query?: string;
  },
): PlaceWithRatings[] {
  const normalizedQuery = (options.query ?? "").trim().toLowerCase();

  const matching = places.filter((p) => {
    if (options.meal !== "all" && !p.meals.includes(options.meal)) return false;
    if (!normalizedQuery) return true;
    const notesText = p.ratings.map((r) => `${r.userName} ${r.note}`).join(" ");
    const haystack = `${p.name} ${p.address} ${notesText}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

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
 * Picks a random pending place, avoiding the currently highlighted place when more than one exists.
 */
export function pickRandomPending(
  places: readonly PlaceWithRatings[],
  excludeId?: string | null,
  randomFn: () => number = Math.random,
): PlaceWithRatings | null {
  const pending = places.filter(isPendingPlace);
  if (pending.length === 0) return null;
  const pool =
    excludeId && pending.length > 1
      ? pending.filter((p) => p.id !== excludeId)
      : pending;
  const idx = Math.floor(randomFn() * pool.length);
  return pool[idx] ?? pending[0] ?? null;
}
