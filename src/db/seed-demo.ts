/**
 * Seeds a throwaway demo database with fictional but complete data:
 * 5 users, friendships (one pending), 2 shared groups + personal lists,
 * places in every section, multi-visit histories with dishes/notes/category scores,
 * "A repetir" marks and generated photos.
 *
 * Usage (refuses to run unless DATABASE_URL points at a local file named *demo*):
 *   DATABASE_URL=file:./data/demo.db UPLOADS_DIR=data/uploads-demo npx tsx src/db/migrate.ts
 *   DATABASE_URL=file:./data/demo.db UPLOADS_DIR=data/uploads-demo npm run db:seed-demo
 * All accounts use the password DEMO_PASSWORD below.
 */

import crypto from "node:crypto";
import zlib from "node:zlib";
import { db } from "@/db";
import {
  addPlacePhotoRecord,
  createPlaceRecord,
  createPlaceVisit,
  updatePlaceRecord,
  upsertVisitEntry,
} from "@/db/places-repo";
import { foodGroup, friendship, type AccentColor, type MealType, type ServiceType } from "@/db/schema";
import { createGroupForUser, ensurePersonalGroup } from "@/db/social-repo";
import { auth } from "@/lib/auth";
import { savePhotoBuffer } from "@/lib/photos";
import type { ScoreBreakdown } from "@/lib/domain";

const DEMO_PASSWORD = "demo12345";

const USERS = [
  { key: "ana", name: "Ana", email: "ana@demo.local", accent: "teal" },
  { key: "bruno", name: "Bruno", email: "bruno@demo.local", accent: "orange" },
  { key: "caro", name: "Caro", email: "caro@demo.local", accent: "cobalt" },
  { key: "diego", name: "Diego", email: "diego@demo.local", accent: "berry" },
  { key: "eli", name: "Eli", email: "eli@demo.local", accent: "teal" },
] as const satisfies readonly { key: string; name: string; email: string; accent: AccentColor }[];

type UserKey = (typeof USERS)[number]["key"];

/** One member's take on a visit: overall feel plus small per-category offsets. */
interface Take {
  by: UserKey;
  score: number;
  dish?: string;
  note?: string;
}

interface DemoVisit {
  date: string;
  takes: Take[];
}

interface DemoPlace {
  name: string;
  address: string;
  service: ServiceType;
  meals: MealType[];
  visits?: DemoVisit[];
  repeat?: string;
  photos?: number;
}

function scores(base: number, seed: number): ScoreBreakdown {
  const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v * 10) / 10));
  const wobble = [0.3, -0.2, 0.1, -0.4, 0.4, -0.1];
  return {
    service: clamp(base + wobble[seed % 6]!),
    food: clamp(base + wobble[(seed + 1) % 6]! + 0.2),
    place: clamp(base + wobble[(seed + 2) % 6]!),
    price: clamp(base + wobble[(seed + 3) % 6]! - 0.2),
  };
}

const MAIN_GROUP: DemoPlace[] = [
  {
    name: "Parrilla Don Ernesto",
    address: "Av. Corrientes 4120, Almagro",
    service: "dine_in",
    meals: ["almuerzo", "cena"],
    repeat: "Ojo de bife jugoso + provoleta",
    photos: 3,
    visits: [
      {
        date: "2026-03-14",
        takes: [
          { by: "ana", score: 9.4, dish: "Ojo de bife", note: "El punto perfecto, papas fritas caseras." },
          { by: "bruno", score: 9.1, dish: "Vacío", note: "Muy tierno. Un poco de espera." },
          { by: "caro", score: 8.8, dish: "Provoleta y ensalada" },
        ],
      },
      {
        date: "2026-08-02",
        takes: [
          { by: "ana", score: 9.6, dish: "Ojo de bife", note: "Mejor que la primera vez." },
          { by: "bruno", score: 9.3, dish: "Entraña" },
        ],
      },
    ],
  },
  {
    name: "Trattoria Nonna Lucía",
    address: "Gurruchaga 1540, Palermo",
    service: "dine_in",
    meals: ["cena"],
    repeat: "Sorrentinos de calabaza con manteca y salvia",
    photos: 2,
    visits: [
      {
        date: "2026-05-22",
        takes: [
          { by: "ana", score: 8.9, dish: "Sorrentinos de calabaza", note: "La salsa, impecable." },
          { by: "bruno", score: 8.5, dish: "Lasagna" },
          { by: "caro", score: 9.2, dish: "Tiramisú", note: "El mejor tiramisú del barrio." },
        ],
      },
    ],
  },
  {
    name: "Café Martina",
    address: "Thames 980, Villa Crespo",
    service: "dine_in",
    meals: ["desayuno", "merienda"],
    photos: 2,
    visits: [
      {
        date: "2026-04-05",
        takes: [
          { by: "ana", score: 8.2, dish: "Tostado de campo y flat white" },
          { by: "caro", score: 6.4, dish: "Medialunas", note: "Las medialunas, secas. El café sí muy bueno." },
          { by: "bruno", score: 7.8 },
        ],
      },
      {
        date: "2026-09-19",
        takes: [{ by: "caro", score: 7.0, dish: "Budín de limón", note: "Mejoró bastante." }],
      },
    ],
  },
  {
    name: "Ramen Kazoku",
    address: "Arenales 2301, Recoleta",
    service: "dine_in",
    meals: ["almuerzo", "cena"],
    photos: 1,
    visits: [
      {
        date: "2026-06-11",
        takes: [
          { by: "ana", score: 6.2, dish: "Tonkotsu", note: "Caldo flojo, fideos pasados." },
          { by: "bruno", score: 8.6, dish: "Shoyu ramen", note: "A mí me encantó." },
          { by: "caro", score: 7.1, dish: "Gyozas" },
        ],
      },
    ],
  },
  {
    name: "La Esquina de Pepe",
    address: "Bolívar 1102, San Telmo",
    service: "dine_in",
    meals: ["almuerzo"],
    visits: [
      {
        date: "2026-02-08",
        takes: [
          { by: "ana", score: 7.4, dish: "Milanesa napolitana" },
          { by: "bruno", score: 7.9, dish: "Bife a caballo", note: "Abundante y barato." },
          { by: "caro", score: 7.2 },
        ],
      },
    ],
  },
  {
    name: "Taquería El Güero",
    address: "Honduras 4802, Palermo",
    service: "dine_in",
    meals: ["cena"],
    photos: 1,
    visits: [
      {
        date: "2026-07-03",
        takes: [
          { by: "ana", score: 8.0, dish: "Tacos al pastor" },
          { by: "bruno", score: 5.8, dish: "Quesadilla", note: "Demasiado picante para mí." },
          { by: "caro", score: 8.7, dish: "Tacos de pescado", note: "Picantes de verdad, bien." },
        ],
      },
    ],
  },
  {
    name: "Bodegón El Tano",
    address: "Av. Rivadavia 6230, Caballito",
    service: "dine_in",
    meals: ["almuerzo", "cena"],
    visits: [
      {
        date: "2026-01-25",
        takes: [
          { by: "ana", score: 7.8, dish: "Ñoquis con tuco" },
          { by: "bruno", score: 8.1, dish: "Matambre a la pizza" },
        ],
      },
    ],
  },
  {
    name: "Brunch Lab",
    address: "Costa Rica 5590, Palermo",
    service: "dine_in",
    meals: ["desayuno", "almuerzo", "merienda"],
    photos: 2,
    visits: [
      {
        date: "2026-10-12",
        takes: [
          { by: "ana", score: 8.5, dish: "Huevos benedictinos", note: "Caro pero vale la pena." },
          { by: "caro", score: 8.3, dish: "Pancakes con frutos rojos" },
          { by: "bruno", score: 7.0, dish: "Avocado toast", note: "Porciones chicas." },
        ],
      },
    ],
  },
  {
    name: "Cantina Bellavista",
    address: "Av. Juan B. Justo 3300, Villa Crespo",
    service: "dine_in",
    meals: ["cena"],
    visits: [
      {
        date: "2026-08-30",
        takes: [
          { by: "ana", score: 6.8, dish: "Fusilli al fierrito" },
          { by: "bruno", score: 7.2 },
          { by: "caro", score: 6.5, note: "Ruidoso, no se podía charlar." },
        ],
      },
    ],
  },
  {
    name: "Pizzería Los Cuatro Hermanos",
    address: "Av. Corrientes 1380, Centro",
    service: "dine_in",
    meals: ["almuerzo", "cena"],
    repeat: "Fugazzeta rellena + fainá",
    visits: [
      {
        date: "2026-04-28",
        takes: [
          { by: "ana", score: 8.7, dish: "Muzzarella al molde" },
          { by: "bruno", score: 9.0, dish: "Fugazzeta rellena", note: "Clásico que nunca falla." },
          { by: "caro", score: 8.4 },
        ],
      },
      {
        date: "2026-10-01",
        takes: [{ by: "bruno", score: 9.2, dish: "Fugazzeta rellena" }],
      },
    ],
  },
  // Pending (no visits yet)
  { name: "Sushi Club Nikkei", address: "Báez 210, Las Cañitas", service: "dine_in", meals: ["cena"] },
  { name: "Almacén Las Violetas", address: "Av. Rivadavia 3899, Almagro", service: "dine_in", meals: ["merienda", "desayuno"] },
  { name: "Mercado de Belgrano", address: "Juramento 2527, Belgrano", service: "dine_in", meals: ["almuerzo"] },
  { name: "Bistró Olivo", address: "Fitz Roy 1820, Palermo", service: "dine_in", meals: ["cena"] },
  { name: "Restaurante con un nombre larguísimo para probar cómo se corta", address: "Calle Falsa 123", service: "dine_in", meals: ["almuerzo", "cena"] },

  // Delivery
  {
    name: "Burger Garage",
    address: "Delivery, Palermo",
    service: "delivery",
    meals: ["cena"],
    repeat: "Doble cheddar sin pepinos + papas con cheddar",
    photos: 1,
    visits: [
      {
        date: "2026-06-20",
        takes: [
          { by: "ana", score: 8.4, dish: "Doble cheddar", note: "Llegó caliente, bien armada." },
          { by: "bruno", score: 8.8, dish: "Bacon burger" },
        ],
      },
      { date: "2026-09-05", takes: [{ by: "ana", score: 8.0, dish: "Doble cheddar", note: "Tardó 50 min." }] },
    ],
  },
  {
    name: "Sushi Pop",
    address: "Delivery, Belgrano",
    service: "delivery",
    meals: ["cena"],
    visits: [
      {
        date: "2026-07-18",
        takes: [
          { by: "caro", score: 8.9, dish: "Combinado 30 piezas" },
          { by: "ana", score: 7.6, dish: "Rolls tempura", note: "Arroz un poco pasado." },
        ],
      },
    ],
  },
  {
    name: "Empanadas La Salteña",
    address: "Delivery, Colegiales",
    service: "delivery",
    meals: ["almuerzo", "cena"],
    visits: [
      {
        date: "2026-03-30",
        takes: [
          { by: "bruno", score: 7.5, dish: "Docena surtida" },
          { by: "ana", score: 7.9, dish: "Carne cortada a cuchillo" },
          { by: "caro", score: 6.9, note: "Llegaron frías." },
        ],
      },
    ],
  },
  {
    name: "Green Bowl",
    address: "Delivery, Núñez",
    service: "delivery",
    meals: ["almuerzo"],
    visits: [{ date: "2026-08-14", takes: [{ by: "caro", score: 8.1, dish: "Bowl de quinoa y salmón" }] }],
  },
  { name: "Wok Express", address: "Delivery, Almagro", service: "delivery", meals: ["cena"] },
  { name: "Pastas Doña Rosa", address: "Delivery, Caballito", service: "delivery", meals: ["almuerzo", "cena"] },

  // Heladerías
  {
    name: "Heladería Cadore",
    address: "Av. Corrientes 1695, Centro",
    service: "ice_cream",
    meals: ["postre", "merienda"],
    repeat: "Dulce de leche granizado + sambayón",
    photos: 1,
    visits: [
      {
        date: "2026-01-12",
        takes: [
          { by: "ana", score: 9.5, dish: "Dulce de leche granizado" },
          { by: "bruno", score: 9.2, dish: "Sambayón" },
          { by: "caro", score: 9.0, dish: "Chocolate amargo" },
        ],
      },
    ],
  },
  {
    name: "Rapanui",
    address: "Arenales 2302, Recoleta",
    service: "ice_cream",
    meals: ["postre"],
    visits: [
      {
        date: "2026-02-20",
        takes: [
          { by: "ana", score: 8.6, dish: "Frambuesas al chocolate" },
          { by: "caro", score: 8.9 },
        ],
      },
    ],
  },
  {
    name: "Gelato Nuvola",
    address: "Malabia 1720, Palermo",
    service: "ice_cream",
    meals: ["postre", "merienda"],
    visits: [
      {
        date: "2026-11-02",
        takes: [
          { by: "bruno", score: 6.0, dish: "Pistacho", note: "Muy dulce, poco sabor a pistacho." },
          { by: "caro", score: 8.2, dish: "Limón al champagne" },
        ],
      },
    ],
  },
  { name: "Heladería del Barrio", address: "Av. Cabildo 2100, Belgrano", service: "ice_cream", meals: ["postre"] },
];

const PAIR_GROUP: DemoPlace[] = [
  {
    name: "Bar Notable El Federal",
    address: "Carlos Calvo 599, San Telmo",
    service: "dine_in",
    meals: ["merienda", "cena"],
    visits: [
      {
        date: "2026-05-01",
        takes: [
          { by: "ana", score: 8.3, dish: "Picada para dos" },
          { by: "diego", score: 8.0, dish: "Lomito" },
        ],
      },
    ],
  },
  {
    name: "Chori Corner",
    address: "Delivery, Villa Urquiza",
    service: "delivery",
    meals: ["almuerzo"],
    visits: [{ date: "2026-09-27", takes: [{ by: "diego", score: 7.7, dish: "Choripán completo" }] }],
  },
  { name: "Vermutería Gallo", address: "Gorriti 4900, Palermo", service: "dine_in", meals: ["cena"] },
];

const PERSONAL_ANA: DemoPlace[] = [
  {
    name: "Panadería Lúa",
    address: "Loyola 1100, Villa Crespo",
    service: "dine_in",
    meals: ["desayuno"],
    visits: [{ date: "2026-10-20", takes: [{ by: "ana", score: 9.0, dish: "Croissant de almendras" }] }],
  },
  { name: "Cafetería Tostado", address: "Scalabrini Ortiz 900", service: "dine_in", meals: ["merienda"] },
];

// ---- Generated photos: warm gradient PNGs, no external assets ----

const PALETTES: [number, number, number][][] = [
  [[234, 88, 12], [251, 191, 36]],
  [[15, 41, 30], [132, 204, 22]],
  [[190, 18, 60], [251, 146, 60]],
  [[30, 64, 175], [56, 189, 248]],
  [[120, 53, 15], [234, 179, 8]],
  [[13, 148, 136], [217, 249, 157]],
];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Diagonal gradient with a soft "plate" circle so photos read as food-ish thumbnails. */
function makePhoto(seed: number): Buffer {
  const w = 640;
  const h = 480;
  const [a, b] = PALETTES[seed % PALETTES.length]!;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const cx = w * (0.4 + (seed % 3) * 0.1);
  const cy = h * 0.55;
  const r = h * 0.24;
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      let px = [0, 1, 2].map((i) => a![i]! + (b![i]! - a![i]!) * t);
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) px = px.map((v) => v * 0.55 + 236 * 0.45);
      if (d < r * 0.7) px = [0, 1, 2].map((i) => a![i]! * 0.8 + b![i]! * 0.2);
      px.forEach((v, i) => (raw[row + 1 + x * 3 + i] = Math.round(v)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Seeding ----

function assertOk<T extends { status: string }>(result: T, what: string): Extract<T, { status: "ok" }> {
  if (result.status !== "ok") throw new Error(`${what}: ${result.status}`);
  return result as Extract<T, { status: "ok" }>;
}

async function seedPlaces(
  groupId: string,
  places: DemoPlace[],
  ids: Record<UserKey, string>,
  creator: UserKey,
  photoSeed: { n: number },
) {
  for (const [i, p] of places.entries()) {
    const created = assertOk(
      await createPlaceRecord(
        { groupId, name: p.name, address: p.address, serviceType: p.service, meals: p.meals },
        ids[creator],
      ),
      `place ${p.name}`,
    );
    const placeId = created.place.id;
    let firstVisitId: string | null = null;

    for (const visit of p.visits ?? []) {
      const [first, ...rest] = visit.takes;
      if (!first) continue;
      const v = assertOk(
        await createPlaceVisit(placeId, ids[first.by], {
          visitedAt: visit.date,
          dish: first.dish ?? "",
          note: first.note ?? "",
          scores: scores(first.score, i),
        }),
        `visit ${p.name}`,
      );
      firstVisitId ??= v.visitId;
      for (const [j, take] of rest.entries()) {
        assertOk(
          await upsertVisitEntry(placeId, v.visitId, ids[first.by], {
            userId: ids[take.by],
            dish: take.dish ?? "",
            note: take.note ?? "",
            scores: scores(take.score, i + j + 1),
          }),
          `entry ${p.name}`,
        );
      }
    }

    if (p.repeat) {
      assertOk(await updatePlaceRecord(placeId, ids[creator], { repeatMarked: true, nextOrder: p.repeat }), "repeat");
    }

    for (let k = 0; k < (p.photos ?? 0); k++) {
      const filename = await savePhotoBuffer(makePhoto(photoSeed.n++), "png");
      assertOk(
        await addPlacePhotoRecord({
          placeId,
          visitId: firstVisitId,
          userId: ids[creator],
          filename,
          mimeType: "image/png",
          caption: k === 0 ? (p.visits?.[0]?.takes[0]?.dish ?? "") : "",
        }),
        `photo ${p.name}`,
      );
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:") || !url.includes("demo")) {
    throw new Error(`Seed demo solo corre contra una DB local *demo* (DATABASE_URL=${url || "vacía"})`);
  }

  const [existing] = await db.select({ id: foodGroup.id }).from(foodGroup).limit(1);
  if (existing) {
    console.log("La DB demo ya tiene datos. Borrá el archivo para regenerarla.");
    return;
  }

  const ids = {} as Record<UserKey, string>;
  for (const u of USERS) {
    const created = await auth.api.signUpEmail({
      body: { name: u.name, email: u.email, password: DEMO_PASSWORD, accentColor: u.accent },
    });
    ids[u.key] = created.user.id;
    await ensurePersonalGroup(created.user.id);
  }

  const now = new Date();
  const pairs: [UserKey, UserKey, "accepted" | "pending"][] = [
    ["ana", "bruno", "accepted"],
    ["ana", "caro", "accepted"],
    ["bruno", "caro", "accepted"],
    ["ana", "diego", "accepted"],
    ["eli", "ana", "pending"],
  ];
  await db.insert(friendship).values(
    pairs.map(([from, to, status]) => ({
      id: crypto.randomUUID(),
      requesterId: ids[from],
      addresseeId: ids[to],
      status,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const main = assertOk(
    await createGroupForUser(ids.ana, { name: "Los de siempre", memberIds: [ids.bruno, ids.caro] }),
    "group main",
  );
  const pair = assertOk(
    await createGroupForUser(ids.ana, { name: "Ana y Diego", memberIds: [ids.diego] }),
    "group pair",
  );
  const anaPersonal = await ensurePersonalGroup(ids.ana);

  const photoSeed = { n: 0 };
  await seedPlaces(main.group.id, MAIN_GROUP, ids, "ana", photoSeed);
  await seedPlaces(pair.group.id, PAIR_GROUP, ids, "ana", photoSeed);
  await seedPlaces(anaPersonal, PERSONAL_ANA, ids, "ana", photoSeed);

  console.log(
    `Demo lista: ${USERS.length} usuarios (clave ${DEMO_PASSWORD}), ${
      MAIN_GROUP.length + PAIR_GROUP.length + PERSONAL_ANA.length
    } lugares, ${photoSeed.n} fotos.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error en seed demo:", err);
    process.exit(1);
  });
