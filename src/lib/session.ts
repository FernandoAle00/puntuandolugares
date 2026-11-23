import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth";

export async function getServerSession(): Promise<AuthSession | null> {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<AuthSession | null> {
  return getServerSession();
}
