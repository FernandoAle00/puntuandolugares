import crypto from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  foodGroup,
  friendship,
  groupMember,
  place,
  rating,
  user,
  type AccentColor,
  type MealType,
} from "@/db/schema";
import { auth } from "@/lib/auth";

interface SeedPlace {
  name: string;
  address: string;
  meals: MealType[];
  fer?: { score: number; note?: string };
  juli?: { score: number; note?: string };
}

const DEFAULT_GROUP_NAME = "Fer y Juli";

const INITIAL_PLACES: SeedPlace[] = [
  {
    name: "La Dominga",
    address: "",
    meals: ["cena", "almuerzo"],
    fer: { score: 9.5 },
    juli: { score: 9 },
  },
  {
    name: "Envero",
    address: "",
    meals: ["cena"],
    fer: { score: 9 },
    juli: { score: 9 },
  },
  {
    name: "Mío Sabores",
    address: "",
    meals: ["almuerzo", "cena"],
    fer: { score: 8 },
    juli: { score: 8 },
  },
  {
    name: "Vito",
    address: "",
    meals: ["cena", "almuerzo"],
    fer: { score: 8 },
    juli: { score: 8 },
  },
  {
    name: "La Lisería",
    address: "",
    meals: ["almuerzo", "cena"],
    fer: {
      score: 7,
      note: "Bien la tabla 1 pero no muy rica la carne, las empanadas muy buenas",
    },
    juli: {
      score: 7.5,
      note: "Muy buena la tabla 1",
    },
  },
  {
    name: "Verbena",
    address: "",
    meals: ["desayuno", "merienda", "almuerzo"],
    fer: { score: 6.5 },
    juli: { score: 7 },
  },
  {
    name: "Ariadna",
    address: "",
    meals: ["desayuno", "merienda"],
    fer: { score: 8 },
    juli: { score: 5 },
  },
  {
    name: "Keik",
    address: "",
    meals: ["desayuno", "merienda"],
    fer: { score: 5 },
    juli: { score: 6.5, note: "Café muy bueno, comida no" },
  },
  {
    name: "Café Iris",
    address: "",
    meals: ["desayuno", "merienda"],
  },
  {
    name: "Troppo Napoletano",
    address: "",
    meals: ["cena"],
  },
  {
    name: "Fortis",
    address: "",
    meals: ["almuerzo", "cena"],
  },
  {
    name: "El Nacional",
    address: "",
    meals: ["almuerzo", "cena"],
  },
  {
    name: "La Chopería",
    address: "",
    meals: ["cena"],
  },
  {
    name: "Rocca",
    address: "",
    meals: ["cena", "merienda"],
  },
];

async function ensureUser(params: {
  name: string;
  email: string;
  password: string;
  accentColor: AccentColor;
}): Promise<string> {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, params.email))
    .limit(1);

  if (existing) {
    await db
      .update(user)
      .set({ accentColor: params.accentColor, updatedAt: new Date() })
      .where(eq(user.id, existing.id));
    return existing.id;
  }

  const created = await auth.api.signUpEmail({
    body: {
      name: params.name,
      email: params.email,
      password: params.password,
      accentColor: params.accentColor,
    },
  });

  if (!created?.user?.id) {
    throw new Error(`No se pudo crear el usuario ${params.email}`);
  }

  return created.user.id;
}

async function ensureFriendship(ferId: string, juliId: string) {
  const [existing] = await db
    .select({ id: friendship.id, status: friendship.status })
    .from(friendship)
    .where(
      or(
        and(eq(friendship.requesterId, ferId), eq(friendship.addresseeId, juliId)),
        and(eq(friendship.requesterId, juliId), eq(friendship.addresseeId, ferId)),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing) {
    if (existing.status !== "accepted") {
      await db
        .update(friendship)
        .set({ status: "accepted", updatedAt: now })
        .where(eq(friendship.id, existing.id));
    }
    return;
  }

  await db.insert(friendship).values({
    id: crypto.randomUUID(),
    requesterId: ferId,
    addresseeId: juliId,
    status: "accepted",
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureGroup(ferId: string, juliId: string): Promise<string> {
  const [existing] = await db
    .select({ id: foodGroup.id })
    .from(foodGroup)
    .where(eq(foodGroup.name, DEFAULT_GROUP_NAME))
    .limit(1);

  const now = new Date();
  let groupId = existing?.id;

  if (!groupId) {
    groupId = crypto.randomUUID();
    await db.insert(foodGroup).values({
      id: groupId,
      name: DEFAULT_GROUP_NAME,
      createdBy: ferId,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const member of [
    { userId: ferId, role: "owner" as const },
    { userId: juliId, role: "member" as const },
  ]) {
    const [exists] = await db
      .select({ id: groupMember.id })
      .from(groupMember)
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, member.userId)))
      .limit(1);

    if (!exists) {
      await db.insert(groupMember).values({
        id: crypto.randomUUID(),
        groupId,
        userId: member.userId,
        role: member.role,
        joinedAt: now,
      });
    }
  }

  return groupId;
}

async function main() {
  // Never re-seed placeholder accounts once the database already has a group
  const [existingGroup] = await db
    .select({ id: foodGroup.id })
    .from(foodGroup)
    .limit(1);

  if (existingGroup) {
    console.log("Seed omitido: la base de datos ya fue inicializada.");
    return;
  }

  const ferEmail = process.env.SEED_FER_EMAIL || "fer@puntuando.local";
  const ferPassword = process.env.SEED_FER_PASSWORD || "FerPuntuando2026!";
  const juliEmail = process.env.SEED_JULI_EMAIL || "juli@puntuando.local";
  const juliPassword = process.env.SEED_JULI_PASSWORD || "JuliPuntuando2026!";

  const ferId = await ensureUser({
    name: "Fer",
    email: ferEmail,
    password: ferPassword,
    accentColor: "teal",
  });

  const juliId = await ensureUser({
    name: "Juli",
    email: juliEmail,
    password: juliPassword,
    accentColor: "orange",
  });

  await ensureFriendship(ferId, juliId);
  const groupId = await ensureGroup(ferId, juliId);

  const now = new Date();
  let insertedPlaces = 0;

  for (const item of INITIAL_PLACES) {
    const [existing] = await db
      .select({ id: place.id })
      .from(place)
      .where(and(eq(place.groupId, groupId), eq(place.name, item.name)))
      .limit(1);

    let placeId = existing?.id;
    if (!placeId) {
      placeId = crypto.randomUUID();
      await db.insert(place).values({
        id: placeId,
        groupId,
        name: item.name,
        address: item.address,
        meals: item.meals,
        createdBy: ferId,
        createdAt: now,
        updatedAt: now,
      });
      insertedPlaces++;
    }

    const entries: Array<{ userId: string; data?: { score: number; note?: string } }> = [
      { userId: ferId, data: item.fer },
      { userId: juliId, data: item.juli },
    ];

    for (const entry of entries) {
      if (!entry.data) continue;
      const [existingRating] = await db
        .select({ id: rating.id })
        .from(rating)
        .where(and(eq(rating.placeId, placeId), eq(rating.userId, entry.userId)))
        .limit(1);

      if (!existingRating) {
        await db.insert(rating).values({
          id: crypto.randomUUID(),
          placeId,
          userId: entry.userId,
          score: entry.data.score,
          note: entry.data.note ?? "",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  console.log(
    `Seed completado: Fer y Juli amigos en "${DEFAULT_GROUP_NAME}", ${insertedPlaces} lugares nuevos cargados.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error ejecutando seed:", err);
    process.exit(1);
  });
