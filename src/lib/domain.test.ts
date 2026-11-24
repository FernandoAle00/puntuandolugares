import { describe, expect, it } from "vitest";
import {
  computeAverage,
  computeGap,
  createGroupSchema,
  createPlaceSchema,
  createVisitSchema,
  deriveRatingsFromVisits,
  filterAndSortPlaces,
  formatScore,
  formatVisitDate,
  friendRequestSchema,
  pickRandomPending,
  scoreSchema,
  updatePlaceSchema,
  type PlaceVisit,
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
    visits: [
      {
        id: "v1",
        visitedAt: "2026-10-12",
        createdAt: "2026-10-12T21:00:00.000Z",
        entries: [
          {
            id: "ve1",
            userId: "fer",
            userName: "Fer",
            userAccent: "teal",
            dish: "Sorrentinos de calabaza",
            score: 9.5,
            note: "",
            updatedAt: "2026-10-12T21:00:00.000Z",
          },
          {
            id: "ve2",
            userId: "juli",
            userName: "Juli",
            userAccent: "orange",
            dish: "Bife de chorizo",
            score: 9,
            note: "",
            updatedAt: "2026-10-12T21:00:00.000Z",
          },
        ],
        photos: [],
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
    visits: [],
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
    visits: [],
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
    visits: [],
    photos: [],
  },
];

const EXTRA_SERVICE_PLACES: PlaceWithRatings[] = [
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
    visits: [],
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
    visits: [],
    photos: [],
  },
  {
    id: "rapanui",
    groupId: "g-fer-juli",
    name: "Rapanui",
    address: "Bv. Gálvez",
    serviceType: "ice_cream",
    meals: ["merienda", "cena"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r6",
        userId: "juli",
        userName: "Juli",
        userAccent: "orange",
        score: 9.2,
        note: "Pistacho increíble",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    visits: [],
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

  it("validates serviceType including delivery and ice_cream", () => {
    expect(
      createPlaceSchema.parse({
        groupId: "g-fer-juli",
        name: "Kuro Sushi",
        serviceType: "delivery",
        meals: ["cena"],
      }).serviceType,
    ).toBe("delivery");

    expect(
      createPlaceSchema.parse({
        groupId: "g-fer-juli",
        name: "Rapanui",
        serviceType: "ice_cream",
        meals: ["merienda"],
      }).serviceType,
    ).toBe("ice_cream");

    expect(
      createPlaceSchema.safeParse({
        groupId: "g-fer-juli",
        name: "Kuro Sushi",
        serviceType: "takeout",
        meals: ["cena"],
      }).success,
    ).toBe(false);

    expect(updatePlaceSchema.parse({ serviceType: "ice_cream" }).serviceType).toBe("ice_cream");
    expect(updatePlaceSchema.parse({ name: "Nuevo" }).serviceType).toBeUndefined();
  });

  it("validates visit creation payloads", () => {
    const parsed = createVisitSchema.parse({
      visitedAt: "2026-11-23",
      dish: "  Milanesa napolitana  ",
      score: 8.5,
      note: " Muy rica ",
    });
    expect(parsed).toEqual({
      visitedAt: "2026-11-23",
      dish: "Milanesa napolitana",
      score: 8.5,
      note: "Muy rica",
    });

    expect(
      createVisitSchema.safeParse({
        visitedAt: "23/11/2026",
        dish: "Pizza",
        score: 8,
      }).success,
    ).toBe(false);
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

describe("rating calculations, visits, and filtering", () => {
  it("computes average and gap accurately", () => {
    expect(computeAverage([{ score: 9.5 }, { score: 9 }])).toBe(9.3);
    expect(computeAverage([])).toBeNull();
    expect(computeGap([{ score: 8 }, { score: 5 }])).toBe(3);
    expect(computeGap([{ score: 8 }])).toBeNull();
    expect(formatScore(6.5)).toBe("6,5");
    expect(formatScore(9)).toBe("9");
  });

  it("derives each user's average score across multiple visits", () => {
    const visits: PlaceVisit[] = [
      {
        id: "v2",
        visitedAt: "2026-11-23",
        createdAt: "2026-11-23T21:00:00.000Z",
        entries: [
          {
            id: "e3",
            userId: "fer",
            userName: "Fer",
            userAccent: "teal",
            dish: "Ñoquis",
            score: 9,
            note: "Mejor que la primera vez",
            updatedAt: "2026-11-23T21:00:00.000Z",
          },
        ],
        photos: [],
      },
      {
        id: "v1",
        visitedAt: "2026-11-01",
        createdAt: "2026-11-01T21:00:00.000Z",
        entries: [
          {
            id: "e1",
            userId: "fer",
            userName: "Fer",
            userAccent: "teal",
            dish: "Milanesa",
            score: 8,
            note: "Bien",
            updatedAt: "2026-11-01T21:00:00.000Z",
          },
          {
            id: "e2",
            userId: "juli",
            userName: "Juli",
            userAccent: "orange",
            dish: "Ensalada",
            score: 7.5,
            note: "Rica",
            updatedAt: "2026-11-01T21:00:00.000Z",
          },
        ],
        photos: [],
      },
    ];

    const derived = deriveRatingsFromVisits(visits);
    expect(derived.map((r) => ({ user: r.userName, score: r.score, note: r.note }))).toEqual([
      { user: "Fer", score: 8.5, note: "Mejor que la primera vez" },
      { user: "Juli", score: 7.5, note: "Rica" },
    ]);
    expect(computeAverage(derived)).toBe(8);
    expect(formatVisitDate("2026-11-23", 2026)).toBe("23 nov");
    expect(formatVisitDate("2025-08-05", 2026)).toBe("5 ago 2025");
    expect(formatVisitDate("")).toBe("");
  });

  it("sorts ranking by average descending and gap by disagreement descending", () => {
    const ranking = filterAndSortPlaces(SAMPLE_PLACES, { mode: "ranking", meal: "all" });
    expect(ranking.map((p) => p.id)).toEqual(["dominga", "ariadna"]);

    const gaps = filterAndSortPlaces(SAMPLE_PLACES, { mode: "gap", meal: "all" });
    expect(gaps.map((p) => p.id)).toEqual(["ariadna", "dominga"]);

    const pending = filterAndSortPlaces(SAMPLE_PLACES, { mode: "pending", meal: "cena" });
    expect(pending.map((p) => p.id)).toEqual(["troppo"]);

    const byDish = filterAndSortPlaces(SAMPLE_PLACES, {
      mode: "ranking",
      meal: "all",
      query: "sorrentinos",
    });
    expect(byDish.map((p) => p.id)).toEqual(["dominga"]);
  });

  it("picks another pending place when excluding current pick", () => {
    const picked = pickRandomPending(SAMPLE_PLACES, "iris", () => 0);
    expect(picked?.id).toBe("troppo");
  });

  it("filters places by serviceType including ice_cream", () => {
    const combined = [...SAMPLE_PLACES, ...EXTRA_SERVICE_PLACES];

    expect(
      filterAndSortPlaces(combined, {
        mode: "ranking",
        meal: "all",
        serviceType: "dine_in",
      }).map((p) => p.id),
    ).toEqual(["dominga", "ariadna"]);

    expect(
      filterAndSortPlaces(combined, {
        mode: "ranking",
        meal: "all",
        serviceType: "delivery",
      }).map((p) => p.id),
    ).toEqual(["sushi-home"]);

    expect(
      filterAndSortPlaces(combined, {
        mode: "ranking",
        meal: "all",
        serviceType: "ice_cream",
      }).map((p) => p.id),
    ).toEqual(["rapanui"]);

    expect(
      filterAndSortPlaces(combined, {
        mode: "pending",
        meal: "all",
        serviceType: "delivery",
      }).map((p) => p.id),
    ).toEqual(["empanadas-sur"]);
  });
});
