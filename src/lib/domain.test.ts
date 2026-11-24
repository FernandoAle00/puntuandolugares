import { describe, expect, it } from "vitest";
import {
  computeAverage,
  computeGap,
  createGroupSchema,
  createPlaceSchema,
  filterAndSortPlaces,
  formatScore,
  friendRequestSchema,
  pickRandomPending,
  scoreSchema,
  updatePlaceSchema,
  type PlaceWithRatings,
} from "@/lib/domain";

const SAMPLE_PLACES: PlaceWithRatings[] = [
  {
    id: "dominga",
    groupId: "g-fer-juli",
    name: "La Dominga",
    address: "Belgrano 412",
    serviceType: "dine_in",
    meals: ["cena", "almuerzo"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r1",
        userId: "fer",
        userName: "Fer",
        userAccent: "teal",
        score: 9.5,
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        userId: "juli",
        userName: "Juli",
        userAccent: "orange",
        score: 9,
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    photos: [],
  },
  {
    id: "ariadna",
    groupId: "g-fer-juli",
    name: "Ariadna",
    address: "",
    serviceType: "dine_in",
    meals: ["desayuno", "merienda"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r3",
        userId: "fer",
        userName: "Fer",
        userAccent: "teal",
        score: 8,
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r4",
        userId: "juli",
        userName: "Juli",
        userAccent: "orange",
        score: 5,
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    photos: [],
  },
  {
    id: "iris",
    groupId: "g-fer-juli",
    name: "Café Iris",
    address: "",
    serviceType: "dine_in",
    meals: ["desayuno", "merienda"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [],
    photos: [],
  },
  {
    id: "troppo",
    groupId: "g-fer-juli",
    name: "Troppo Napoletano",
    address: "",
    serviceType: "dine_in",
    meals: ["cena"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [],
    photos: [],
  },
];

const DELIVERY_PLACES: PlaceWithRatings[] = [
  {
    id: "sushi-home",
    groupId: "g-fer-juli",
    name: "Kuro Sushi",
    address: "PedidosYa",
    serviceType: "delivery",
    meals: ["cena"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r5",
        userId: "fer",
        userName: "Fer",
        userAccent: "teal",
        score: 8.5,
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    photos: [],
  },
  {
    id: "empanadas-sur",
    groupId: "g-fer-juli",
    name: "Empanadas del Sur",
    address: "Rappi",
    serviceType: "delivery",
    meals: ["almuerzo", "cena"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [],
    photos: [],
  },
];

describe("domain validation", () => {
  it("accepts scores from 1 to 10 in 0.1 increments", () => {
    expect(scoreSchema.safeParse(1).success).toBe(true);
    expect(scoreSchema.safeParse(6.5).success).toBe(true);
    expect(scoreSchema.safeParse(7.3).success).toBe(true);
    expect(scoreSchema.safeParse(9.8).success).toBe(true);
    expect(scoreSchema.safeParse(10).success).toBe(true);
  });

  it("rejects out-of-range or more than one decimal digit", () => {
    expect(scoreSchema.safeParse(0.9).success).toBe(false);
    expect(scoreSchema.safeParse(10.1).success).toBe(false);
    expect(scoreSchema.safeParse(7.35).success).toBe(false);
  });

  it("deduplicates meal types on place creation", () => {
    const parsed = createPlaceSchema.parse({
      groupId: "g-fer-juli",
      name: "  Keik  ",
      address: " España 310 ",
      meals: ["desayuno", "desayuno", "merienda"],
    });
    expect(parsed.groupId).toBe("g-fer-juli");
    expect(parsed.name).toBe("Keik");
    expect(parsed.address).toBe("España 310");
    expect(parsed.serviceType).toBe("dine_in");
    expect(parsed.meals).toEqual(["desayuno", "merienda"]);
  });

  it("validates serviceType on place creation and update", () => {
    const delivery = createPlaceSchema.parse({
      groupId: "g-fer-juli",
      name: "Kuro Sushi",
      serviceType: "delivery",
      meals: ["cena"],
    });
    expect(delivery.serviceType).toBe("delivery");

    expect(
      createPlaceSchema.safeParse({
        groupId: "g-fer-juli",
        name: "Kuro Sushi",
        serviceType: "takeout",
        meals: ["cena"],
      }).success,
    ).toBe(false);

    expect(updatePlaceSchema.parse({ serviceType: "delivery" }).serviceType).toBe("delivery");
    expect(updatePlaceSchema.parse({ name: "Nuevo" }).serviceType).toBeUndefined();
  });

  it("normalizes friend email and validates group creation", () => {
    expect(friendRequestSchema.parse({ email: "  Juli@Ejemplo.COM " }).email).toBe(
      "juli@ejemplo.com",
    );
    expect(
      createGroupSchema.parse({ name: "  Fer y Juli  ", memberIds: ["u2"] }),
    ).toEqual({
      name: "Fer y Juli",
      memberIds: ["u2"],
    });
  });
});

describe("rating calculations and filtering", () => {
  it("computes average and gap accurately", () => {
    expect(computeAverage([{ score: 9.5 }, { score: 9 }])).toBe(9.3);
    expect(computeAverage([])).toBeNull();
    expect(computeGap([{ score: 8 }, { score: 5 }])).toBe(3);
    expect(computeGap([{ score: 8 }])).toBeNull();
    expect(formatScore(6.5)).toBe("6,5");
    expect(formatScore(9)).toBe("9");
  });

  it("sorts ranking by average descending and gap by disagreement descending", () => {
    const ranking = filterAndSortPlaces(SAMPLE_PLACES, { mode: "ranking", meal: "all" });
    expect(ranking.map((p) => p.id)).toEqual(["dominga", "ariadna"]);

    const gaps = filterAndSortPlaces(SAMPLE_PLACES, { mode: "gap", meal: "all" });
    expect(gaps.map((p) => p.id)).toEqual(["ariadna", "dominga"]);

    const pending = filterAndSortPlaces(SAMPLE_PLACES, { mode: "pending", meal: "cena" });
    expect(pending.map((p) => p.id)).toEqual(["troppo"]);
  });

  it("picks another pending place when excluding current pick", () => {
    const picked = pickRandomPending(SAMPLE_PLACES, "iris", () => 0);
    expect(picked?.id).toBe("troppo");
  });

  it("filters places by serviceType when provided", () => {
    const combined = [...SAMPLE_PLACES, ...DELIVERY_PLACES];

    const dineInRanking = filterAndSortPlaces(combined, {
      mode: "ranking",
      meal: "all",
      serviceType: "dine_in",
    });
    expect(dineInRanking.map((p) => p.id)).toEqual(["dominga", "ariadna"]);

    const deliveryRanking = filterAndSortPlaces(combined, {
      mode: "ranking",
      meal: "all",
      serviceType: "delivery",
    });
    expect(deliveryRanking.map((p) => p.id)).toEqual(["sushi-home"]);

    const deliveryPending = filterAndSortPlaces(combined, {
      mode: "pending",
      meal: "all",
      serviceType: "delivery",
    });
    expect(deliveryPending.map((p) => p.id)).toEqual(["empanadas-sur"]);

    const allRanking = filterAndSortPlaces(combined, {
      mode: "ranking",
      meal: "all",
    });
    expect(allRanking.map((p) => p.id)).toEqual(["dominga", "sushi-home", "ariadna"]);
  });
});
