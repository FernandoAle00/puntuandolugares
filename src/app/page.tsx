import { AuthScreen } from "@/components/auth-screen";
import { PocketGuide } from "@/components/pocket-guide";
import { listPlacesForUser } from "@/db/places-repo";
import type { AccentColor } from "@/db/schema";
import { getSocialSnapshot, listGroupsForUser } from "@/db/social-repo";
import { getServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function resolveAccent(raw: unknown): AccentColor {
  if (raw === "orange" || raw === "cobalt" || raw === "berry" || raw === "teal") {
    return raw;
  }
  return "teal";
}

export default async function HomePage() {
  const session = await getServerSession();

  if (!session) {
    return (
      <AuthScreen inviteRequired={Boolean(process.env.INVITE_CODE?.trim())} />
    );
  }

  const [groups, places, social] = await Promise.all([
    listGroupsForUser(session.user.id),
    listPlacesForUser(session.user.id),
    getSocialSnapshot(session.user.id),
  ]);

  return (
    <PocketGuide
      initialGroups={groups}
      initialPlaces={places}
      initialSocial={social}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        accentColor: resolveAccent(session.user.accentColor),
      }}
    />
  );
}
