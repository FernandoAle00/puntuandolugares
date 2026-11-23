import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { schema } from "@/db/schema";

const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "dev-only-insecure-secret-change-in-production-32chars");

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const isHttps = baseURL.startsWith("https://");
const extraOrigins = (process.env.TRUSTED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const trustedOrigins = Array.from(new Set([baseURL, ...extraOrigins]));

export const auth = betterAuth({
  secret: authSecret,
  baseURL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      accentColor: {
        type: "string",
        required: false,
        defaultValue: "teal",
        input: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // refresca diariamente al usar la app
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  advanced: {
    useSecureCookies: isHttps,
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
