import { describe, expect, it } from "vitest";
import {
  computeAverage,
  computeBreakdownAverage,
  computeGap,
  computePlaceBreakdown,
  createGroupSchema,
  createPlaceSchema,
  createVisitSchema,
  deriveRatingsFromVisits,
  filterAndSortPlaces,
  formatScore,
  formatVisitDate,
  friendRequestSchema,
  getScoreCategories,
  getScoreCategoryLabel,
  photoKindSchema,
  pickRandomPending,
  scoreSchema,
  updatePlaceSchema,
  upsertVisitEntrySchema,
  type PlaceVisit,
  type PlaceWithRatings,
  type ScoreBreakdown,
} from "@/lib/domain";

function uniformScores(score: number): ScoreBreakdown {
  return { service: score, food: score, place: score, price: score };
}

const SAMPLE_PLACES: PlaceWithRatings[] = [
  {
    id: "dominga",
    groupId: "g-fer-juli",
    name: "La Dominga",
    address: "Belgrano 412",
    serviceType: "dine_in",
    repeatMarked: true,
    nextOrder: "Probar tiramisú",
    meals: ["cena", "almuerzo"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r1",
        userId: "fer",
        userName: "Fer",
        userAccent: "teal",
        score: 9.5,
        scores: { service: 9.5, food: 10, place: 9.5, price: 9 },
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        userId: "juli",
        userName: "Juli",
        userAccent: "orange",
        score: 9,
        scores: uniformScores(9),
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
            scores: { service: 9.5, food: 10, place: 9.5, price: 9 },
            legacyScore: null,
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
            scores: uniformScores(9),
            legacyScore: null,
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
    repeatMarked: false,
    nextOrder: "",
    meals: ["desayuno", "merienda"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r3",
        userId: "fer",
        userName: "Fer",
        userAccent: "teal",
        score: 8,
        scores: uniformScores(8),
        note: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r4",
        userId: "juli",
        userName: "Juli",
        userAccent: "orange",
        score: 5,
        scores: uniformScores(5),
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
    repeatMarked: false,
    nextOrder: "",
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
    repeatMarked: false,
    nextOrder: "",
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
    repeatMarked: true,
    nextOrder: "Roll salmón ahumado",
    meals: ["cena"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r5",
        userId: "fer",
        userName: "Fer",
        userAccent: "teal",
        score: 8.5,
        scores: uniformScores(8.5),
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
    repeatMarked: false,
    nextOrder: "",
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
    repeatMarked: true,
    nextOrder: "Pistacho y chocolate amargo",
    meals: ["merienda", "cena"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ratings: [
      {
        id: "r6",
        userId: "juli",
        userName: "Juli",
        userAccent: "orange",
        score: 9.2,
        scores: uniformScores(9.2),
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
        meals: ["postre", "merienda"],
      }),
    ).toMatchObject({
      serviceType: "ice_cream",
      meals: ["postre", "merienda"],
    });

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
    expect(
      updatePlaceSchema.parse({ repeatMarked: true, nextOrder: "  Pedir tiramisú  " }),
    ).toEqual({
      repeatMarked: true,
      nextOrder: "Pedir tiramisú",
    });
  });

  it("validates visit creation payloads with 4-category scores", () => {
    const parsed = createVisitSchema.parse({
      visitedAt: "2026-11-23",
      dish: "  Milanesa napolitana  ",
      scores: { service: 9, food: 9.5, place: 8, price: 7.5 },
      note: " Muy rica ",
    });
    expect(parsed).toEqual({
      visitedAt: "2026-11-23",
      dish: "Milanesa napolitana",
      scores: { service: 9, food: 9.5, place: 8, price: 7.5 },
      note: "Muy rica",
    });

    expect(
      createVisitSchema.safeParse({
        visitedAt: "2026-11-23",
        dish: "Pizza",
        scores: { service: 9, food: 8, place: 8 },
      }).success,
    ).toBe(false);

    expect(
      createVisitSchema.safeParse({
        visitedAt: "23/11/2026",
        dish: "Pizza",
        scores: uniformScores(8),
      }).success,
    ).toBe(false);

    // Omitting dish/note on visit entry update leaves them undefined so existing text is preserved
    expect(
      upsertVisitEntrySchema.parse({
        scores: { service: 9, food: 8, place: 8, price: 7 },
      }),
    ).toEqual({
      scores: { service: 9, food: 8, place: 8, price: 7 },
    });
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
  it("computes 4-category breakdown average, overall average, and gap accurately", () => {
    expect(computeBreakdownAverage({ service: 9, food: 10, place: 8, price: 7 })).toBe(8.5);
    const boundaryMean = computeBreakdownAverage({ service: 1, food: 1, place: 1.1, price: 8.7 });
    expect(boundaryMean).toBe(2.95);
    expect(formatScore(boundaryMean)).toBe("3");
    expect(computeAverage([{ score: boundaryMean }])).toBe(3);
    expect(
      computePlaceBreakdown([
        { scores: uniformScores(1) },
        { scores: uniformScores(1) },
        { scores: uniformScores(1.1) },
        { scores: uniformScores(8.7) },
      ]),
    ).toEqual(uniformScores(3));
    expect(computeAverage([{ score: 9.5 }, { score: 9 }])).toBe(9.3);
    expect(computeAverage([])).toBeNull();
    expect(computeGap([{ score: 8 }, { score: 5 }])).toBe(3);
    expect(computeGap([{ score: 8 }])).toBeNull();
    expect(formatScore(6.5)).toBe("6,5");
    expect(formatScore(9)).toBe("9");
    expect(getScoreCategories("dine_in")).toEqual(["service", "food", "place", "price"]);
    expect(getScoreCategories("delivery")).toEqual(["food", "price", "service", "place"]);
    expect(
      getScoreCategories("delivery").map((c) => getScoreCategoryLabel(c, "delivery")),
    ).toEqual(["Comida", "Precio", "Tiempo de envío", "Llegada"]);
    expect(
      getScoreCategories("delivery").map((c) =>
        getScoreCategoryLabel(c, "delivery", { compact: true }),
      ),
    ).toEqual(["Comida", "Precio", "Envío", "Llegada"]);
    expect(
      getScoreCategories("ice_cream").map((c) => getScoreCategoryLabel(c, "ice_cream")),
    ).toEqual(["Atención", "Comida", "Lugar", "Precio"]);
  });

  it("derives each user's average score and 4-category breakdown across visits while ignoring legacy unscored entries", () => {
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
            scores: { service: 9, food: 10, place: 8, price: 9 },
            legacyScore: null,
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
            scores: { service: 7, food: 8, place: 8, price: 9 },
            legacyScore: null,
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
            scores: { service: 8, food: 7, place: 8, price: 7 },
            legacyScore: null,
            note: "Rica",
            updatedAt: "2026-11-01T21:00:00.000Z",
          },
          {
            id: "e-legacy",
            userId: "legacy-user",
            userName: "Invitado",
            userAccent: "cobalt",
            dish: "Empanadas",
            score: null,
            scores: null,
            legacyScore: 9.5,
            note: "Reseña vieja conservada",
            updatedAt: "2026-11-01T21:00:00.000Z",
          },
        ],
        photos: [],
      },
    ];

    const derived = deriveRatingsFromVisits(visits);
    expect(
      derived.map((r) => ({ user: r.userName, score: r.score, scores: r.scores, note: r.note })),
    ).toEqual([
      {
        user: "Fer",
        score: 8.5,
        scores: { service: 8, food: 9, place: 8, price: 9 },
        note: "Mejor que la primera vez",
      },
      {
        user: "Juli",
        score: 7.5,
        scores: { service: 8, food: 7, place: 8, price: 7 },
        note: "Rica",
      },
    ]);
    expect(computeAverage(derived)).toBe(8);
    expect(computePlaceBreakdown(derived)).toEqual({
      service: 8,
      food: 8,
      place: 8,
      price: 8,
    });

    // Regression: avoids double-rounding drift between per-person averages and place average (8 and 8.075 -> 8.0375 -> 8)
    const precisionVisits: PlaceVisit[] = [
      {
        id: "vp1",
        visitedAt: "2026-11-24",
        createdAt: "2026-11-24T21:00:00.000Z",
        entries: [
          {
            id: "ep1",
            userId: "fer",
            userName: "Fer",
            userAccent: "teal",
            dish: "",
            score: 8,
            scores: { service: 8, food: 8, place: 8, price: 8 },
            legacyScore: null,
            note: "",
            updatedAt: "2026-11-24T21:00:00.000Z",
          },
          {
            id: "ep2",
            userId: "juli",
            userName: "Juli",
            userAccent: "orange",
            dish: "",
            score: 8.075,
            scores: { service: 8.3, food: 8, place: 8, price: 8 },
            legacyScore: null,
            note: "",
            updatedAt: "2026-11-24T21:00:00.000Z",
          },
        ],
        photos: [],
      },
    ];
    const precisionDerived = deriveRatingsFromVisits(precisionVisits);
    expect(computeAverage(precisionDerived)).toBe(8);

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

  it("filters places by serviceType including ice_cream and repeatMarked", () => {
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

    expect(
      filterAndSortPlaces(combined, {
        mode: "ranking",
        meal: "all",
        onlyRepeat: true,
      }).map((p) => p.id),
    ).toEqual(["dominga", "rapanui", "sushi-home"]);

    expect(photoKindSchema.safeParse("general").success).toBe(true);
    expect(photoKindSchema.safeParse("next_order").success).toBe(true);
    expect(photoKindSchema.safeParse("").success).toBe(false);
    expect(photoKindSchema.safeParse(" next_order ").success).toBe(false);
    expect(photoKindSchema.safeParse("avatar").success).toBe(false);

    const firstPlace = SAMPLE_PLACES[0];
    expect(firstPlace).toBeDefined();
    if (!firstPlace) return;

    const withNextOrderPhoto: PlaceWithRatings[] = [
      {
        ...firstPlace,
        photos: [
          {
            id: "ph-next-1",
            visitId: null,
            kind: "next_order",
            url: "/api/photos/ph-next-1",
            caption: "Volcán de dulce de leche",
            uploadedBy: "Fer",
            createdAt: "2026-11-26T20:00:00.000Z",
          },
        ],
      },
    ];
    expect(
      filterAndSortPlaces(withNextOrderPhoto, {
        mode: "ranking",
        meal: "all",
        onlyRepeat: true,
        query: "volcán",
      }).map((p) => p.id),
    ).toEqual(["dominga"]);

    expect(
      filterAndSortPlaces(combined, {
        mode: "ranking",
        meal: "all",
        onlyRepeat: true,
        query: "tiramisú",
      }).map((p) => p.id),
    ).toEqual(["dominga"]);
  });
});
