import { sql } from "drizzle-orm";
import {
  check,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export type MealType = "desayuno" | "almuerzo" | "merienda" | "cena";
export type AccentColor = "teal" | "orange" | "cobalt" | "berry";
export type FriendshipStatus = "pending" | "accepted";
export type GroupRole = "owner" | "member";

// Better Auth core tables
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  accentColor: text("accent_color").$type<AccentColor>().notNull().default("teal"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Social graph: friendships & shared rating groups
export const friendship = sqliteTable(
  "friendship",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<FriendshipStatus>().notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("friendship_pair_unique").on(table.requesterId, table.addresseeId),
    check("friendship_no_self", sql`${table.requesterId} <> ${table.addresseeId}`),
  ],
);

export const foodGroup = sqliteTable("food_group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const groupMember = sqliteTable(
  "group_member",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => foodGroup.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<GroupRole>().notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("group_member_unique").on(table.groupId, table.userId),
  ],
);

// Places belong to a shared group
export const place = sqliteTable("place", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => foodGroup.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  meals: text("meals", { mode: "json" }).$type<MealType[]>().notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const rating = sqliteTable(
  "rating",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => place.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("rating_place_user_unique").on(table.placeId, table.userId),
    check("rating_score_range", sql`${table.score} >= 1 AND ${table.score} <= 10`),
  ],
);

export const placePhoto = sqliteTable("place_photo", {
  id: text("id").primaryKey(),
  placeId: text("place_id")
    .notNull()
    .references(() => place.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  caption: text("caption").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  friendship,
  foodGroup,
  groupMember,
  place,
  rating,
  placePhoto,
};
