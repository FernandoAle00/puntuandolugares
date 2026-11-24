import crypto from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { foodGroup, friendship, groupMember, place, rating, user } from "@/db/schema";
import type {
  CreateGroupInput,
  FriendItem,
  GroupMemberSummary,
  GroupSummary,
  SocialSnapshot,
  UserSummary,
} from "@/lib/domain";

/**
 * Loads the authenticated user's accepted friends plus incoming and outgoing friend requests.
 */
export async function getSocialSnapshot(userId: string): Promise<SocialSnapshot> {
  const rows = await db
    .select()
    .from(friendship)
    .where(or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId)));

  if (rows.length === 0) {
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }

  const otherIds = Array.from(
    new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId))),
  );

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      accentColor: user.accentColor,
    })
    .from(user)
    .where(inArray(user.id, otherIds));

  const userMap = new Map<string, UserSummary>(users.map((u) => [u.id, u]));

  const friends: FriendItem[] = [];
  const incomingRequests: FriendItem[] = [];
  const outgoingRequests: FriendItem[] = [];

  for (const row of rows) {
    const otherId = row.requesterId === userId ? row.addresseeId : row.requesterId;
    const other = userMap.get(otherId);
    if (!other) continue;

    const item: FriendItem = { friendshipId: row.id, user: other };
    if (row.status === "accepted") {
      friends.push(item);
    } else if (row.addresseeId === userId) {
      incomingRequests.push(item);
    } else {
      outgoingRequests.push(item);
    }
  }

  const byName = (a: FriendItem, b: FriendItem) =>
    a.user.name.localeCompare(b.user.name, "es");

  return {
    friends: friends.sort(byName),
    incomingRequests: incomingRequests.sort(byName),
    outgoingRequests: outgoingRequests.sort(byName),
  };
}

export async function areAcceptedFriends(userA: string, userB: string): Promise<boolean> {
  const [row] = await db
    .select({ id: friendship.id })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(
          and(eq(friendship.requesterId, userA), eq(friendship.addresseeId, userB)),
          and(eq(friendship.requesterId, userB), eq(friendship.addresseeId, userA)),
        ),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Sends a friend request to another account by email.
 * If the target user already sent a pending request to the caller, accepts it automatically.
 */
export async function sendFriendRequestByEmail(
  requesterId: string,
  targetEmail: string,
): Promise<
  | { status: "sent" | "accepted" }
  | { status: "error"; message: string; httpStatus: number }
> {
  const [target] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, targetEmail))
    .limit(1);

  if (!target) {
    return {
      status: "error",
      message: "No encontramos una cuenta con ese email",
      httpStatus: 404,
    };
  }

  if (target.id === requesterId) {
    return {
      status: "error",
      message: "No podés agregarte a vos mismo",
      httpStatus: 400,
    };
  }

  const [existing] = await db
    .select()
    .from(friendship)
    .where(
      or(
        and(eq(friendship.requesterId, requesterId), eq(friendship.addresseeId, target.id)),
        and(eq(friendship.requesterId, target.id), eq(friendship.addresseeId, requesterId)),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      return { status: "error", message: "Ya son amigos", httpStatus: 409 };
    }
    if (existing.requesterId === target.id) {
      await db
        .update(friendship)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(friendship.id, existing.id));
      return { status: "accepted" };
    }
    return { status: "error", message: "Ya enviaste una solicitud a esta cuenta", httpStatus: 409 };
  }

  const now = new Date();
  await db.insert(friendship).values({
    id: crypto.randomUUID(),
    requesterId,
    addresseeId: target.id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  return { status: "sent" };
}

export async function respondToFriendRequest(
  friendshipId: string,
  currentUserId: string,
  action: "accept" | "decline",
): Promise<"ok" | "not_found" | "forbidden"> {
  const [row] = await db
    .select()
    .from(friendship)
    .where(eq(friendship.id, friendshipId))
    .limit(1);

  if (!row) return "not_found";
  if (row.addresseeId !== currentUserId || row.status !== "pending") {
    return "forbidden";
  }

  if (action === "accept") {
    await db
      .update(friendship)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendship.id, friendshipId));
  } else {
    await db.delete(friendship).where(eq(friendship.id, friendshipId));
  }

  return "ok";
}

export async function removeFriendship(
  friendshipId: string,
  currentUserId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const [row] = await db
    .select()
    .from(friendship)
    .where(eq(friendship.id, friendshipId))
    .limit(1);

  if (!row) return "not_found";
  if (row.requesterId !== currentUserId && row.addresseeId !== currentUserId) {
    return "forbidden";
  }

  await db.delete(friendship).where(eq(friendship.id, friendshipId));
  return "ok";
}

/**
 * Lists all rating groups the user belongs to, along with each group's members.
 */
export async function listGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const myMemberships = await db
    .select({ groupId: groupMember.groupId })
    .from(groupMember)
    .where(eq(groupMember.userId, userId));

  const groupIds = myMemberships.map((m) => m.groupId);
  if (groupIds.length === 0) return [];

  const [groups, allMembers] = await Promise.all([
    db
      .select()
      .from(foodGroup)
      .where(inArray(foodGroup.id, groupIds))
      .orderBy(asc(foodGroup.createdAt)),
    db
      .select({
        groupId: groupMember.groupId,
        role: groupMember.role,
        id: user.id,
        name: user.name,
        email: user.email,
        accentColor: user.accentColor,
      })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .where(inArray(groupMember.groupId, groupIds)),
  ]);

  const membersByGroup = new Map<string, GroupMemberSummary[]>();
  for (const row of allMembers) {
    const member: GroupMemberSummary = {
      id: row.id,
      name: row.name,
      email: row.email,
      accentColor: row.accentColor,
      role: row.role,
    };
    const bucket = membersByGroup.get(row.groupId);
    if (bucket) {
      bucket.push(member);
    } else {
      membersByGroup.set(row.groupId, [member]);
    }
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: (membersByGroup.get(g.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    ),
  }));
}

/**
 * Creates a new rating group owned by the caller and adds only verified accepted friends.
 */
export async function createGroupForUser(
  creatorId: string,
  input: CreateGroupInput,
): Promise<{ status: "ok"; group: GroupSummary } | { status: "error"; message: string }> {
  const uniqueInvitees = Array.from(new Set(input.memberIds)).filter((id) => id !== creatorId);

  for (const friendId of uniqueInvitees) {
    const ok = await areAcceptedFriends(creatorId, friendId);
    if (!ok) {
      return {
        status: "error",
        message: "Solo podés sumar amigos confirmados al grupo",
      };
    }
  }

  const now = new Date();
  const groupId = crypto.randomUUID();

  await db.insert(foodGroup).values({
    id: groupId,
    name: input.name,
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(groupMember).values([
    {
      id: crypto.randomUUID(),
      groupId,
      userId: creatorId,
      role: "owner",
      joinedAt: now,
    },
    ...uniqueInvitees.map((friendId) => ({
      id: crypto.randomUUID(),
      groupId,
      userId: friendId,
      role: "member" as const,
      joinedAt: now,
    })),
  ]);

  const groups = await listGroupsForUser(creatorId);
  const created = groups.find((g) => g.id === groupId);
  if (!created) {
    throw new Error("No se pudo recuperar el grupo recién creado");
  }
  return { status: "ok", group: created };
}

/**
 * Adds an accepted friend to a group the caller already belongs to.
 * If the group still holds the initial placeholder Juli account (juli@puntuando.local),
 * seamlessly transfers all its ratings in this group to the real account and removes the placeholder.
 */
export async function addFriendToGroup(
  groupId: string,
  callerId: string,
  friendUserId: string,
): Promise<
  { status: "ok"; group: GroupSummary } | { status: "error"; message: string; httpStatus: number }
> {
  const [callerMembership] = await db
    .select({ id: groupMember.id })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, callerId)))
    .limit(1);

  if (!callerMembership) {
    return { status: "error", message: "No tenés acceso a este grupo", httpStatus: 403 };
  }

  const friends = await areAcceptedFriends(callerId, friendUserId);
  if (!friends) {
    return {
      status: "error",
      message: "Solo podés sumar cuentas que sean tus amigas",
      httpStatus: 403,
    };
  }

  const [existing] = await db
    .select({ id: groupMember.id })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, friendUserId)))
    .limit(1);

  if (!existing) {
    // Check if the group currently has the seeded placeholder account for Juli
    const [placeholderMember] = await db
      .select({ userId: user.id })
      .from(groupMember)
      .innerJoin(user, eq(groupMember.userId, user.id))
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(user.email, "juli@puntuando.local"),
        ),
      )
      .limit(1);

    await db.transaction(async (tx) => {
      await tx.insert(groupMember).values({
        id: crypto.randomUUID(),
        groupId,
        userId: friendUserId,
        role: "member",
        joinedAt: new Date(),
      });

      if (placeholderMember && placeholderMember.userId !== friendUserId) {
        const groupPlaces = await tx
          .select({ id: place.id })
          .from(place)
          .where(eq(place.groupId, groupId));

        const placeIds = groupPlaces.map((p) => p.id);
        if (placeIds.length > 0) {
          await tx
            .update(rating)
            .set({ userId: friendUserId, updatedAt: new Date() })
            .where(
              and(
                eq(rating.userId, placeholderMember.userId),
                inArray(rating.placeId, placeIds),
              ),
            );
        }

        // Give the incoming friend Juli's distinct orange accent if it still has the default teal
        const [friendRow] = await tx
          .select({ accentColor: user.accentColor })
          .from(user)
          .where(eq(user.id, friendUserId))
          .limit(1);

        if (friendRow?.accentColor === "teal") {
          await tx
            .update(user)
            .set({ accentColor: "orange", updatedAt: new Date() })
            .where(eq(user.id, friendUserId));
        }

        // Remove placeholder account completely (cascades its membership & friendship)
        await tx.delete(user).where(eq(user.id, placeholderMember.userId));
      }
    });
  }

  const groups = await listGroupsForUser(callerId);
  const updated = groups.find((g) => g.id === groupId);
  if (!updated) {
    return { status: "error", message: "Grupo no encontrado", httpStatus: 404 };
  }
  return { status: "ok", group: updated };
}
