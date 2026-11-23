"use client";

import { Check, Plus, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { accentCssVar } from "@/components/place-sheet";
import type { GroupSummary, SocialSnapshot } from "@/lib/domain";

interface SocialSheetProps {
  open: boolean;
  initialTab: "friends" | "groups";
  social: SocialSnapshot;
  groups: GroupSummary[];
  activeGroupId: string | null;
  onClose: () => void;
  onSocialUpdated: (social: SocialSnapshot) => void;
  onGroupCreated: (group: GroupSummary) => void;
  onGroupUpdated: (group: GroupSummary) => void;
}

export function SocialSheet({
  open,
  initialTab,
  social,
  groups,
  activeGroupId,
  onClose,
  onSocialUpdated,
  onGroupCreated,
  onGroupUpdated,
}: SocialSheetProps) {
  const [tab, setTab] = useState<"friends" | "groups">(initialTab);
  const [email, setEmail] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setFeedback(null);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const activeMemberIds = new Set(activeGroup?.members.map((m) => m.id) ?? []);
  const friendsNotInActiveGroup = social.friends.filter(
    (f) => !activeMemberIds.has(f.user.id),
  );

  async function handleSendRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as {
        status?: "sent" | "accepted";
        social?: SocialSnapshot;
        error?: string;
      } | null;

      if (!res.ok || !data?.social) {
        setFeedback({ kind: "err", text: data?.error || "No se pudo enviar la solicitud" });
        setBusy(false);
        return;
      }

      onSocialUpdated(data.social);
      setEmail("");
      setFeedback({
        kind: "ok",
        text: data.status === "accepted" ? "Ahora son amigos" : "Solicitud enviada",
      });
      setBusy(false);
    } catch {
      setFeedback({ kind: "err", text: "Error de conexión" });
      setBusy(false);
    }
  }

  async function handleRespond(friendshipId: string, action: "accept" | "decline") {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => null)) as {
        social?: SocialSnapshot;
        error?: string;
      } | null;

      if (!res.ok || !data?.social) {
        setFeedback({ kind: "err", text: data?.error || "No se pudo actualizar" });
        setBusy(false);
        return;
      }

      onSocialUpdated(data.social);
      setBusy(false);
    } catch {
      setFeedback({ kind: "err", text: "Error de conexión" });
      setBusy(false);
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as {
        social?: SocialSnapshot;
        error?: string;
      } | null;
      if (res.ok && data?.social) {
        onSocialUpdated(data.social);
      }
      setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  function toggleFriendSelection(userId: string) {
    setSelectedFriends((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, memberIds: selectedFriends }),
      });
      const data = (await res.json().catch(() => null)) as {
        group?: GroupSummary;
        error?: string;
      } | null;

      if (!res.ok || !data?.group) {
        setFeedback({ kind: "err", text: data?.error || "No se pudo crear el grupo" });
        setBusy(false);
        return;
      }

      onGroupCreated(data.group);
      setGroupName("");
      setSelectedFriends([]);
      setFeedback({ kind: "ok", text: `Grupo "${data.group.name}" creado` });
      setBusy(false);
    } catch {
      setFeedback({ kind: "err", text: "Error de conexión" });
      setBusy(false);
    }
  }

  async function handleAddMember(userId: string) {
    if (!activeGroup) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/groups/${activeGroup.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => null)) as {
        group?: GroupSummary;
        error?: string;
      } | null;

      if (!res.ok || !data?.group) {
        setFeedback({ kind: "err", text: data?.error || "No se pudo sumar al grupo" });
        setBusy(false);
        return;
      }

      onGroupUpdated(data.group);
      setFeedback({ kind: "ok", text: "Miembro agregado al grupo" });
      setBusy(false);
    } catch {
      setFeedback({ kind: "err", text: "Error de conexión" });
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ backgroundColor: "var(--backdrop)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Amigos y grupos"
        className="zine-sheet max-h-[90dvh] w-full max-w-[500px] overflow-y-auto px-5 pt-3 pb-6"
        style={{
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full sm:hidden"
          style={{ backgroundColor: "var(--border-soft)" }}
        />

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display m-0 text-[22px] font-bold">Amigos y grupos</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable inline-flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--pill-bg)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "friends"}
            onClick={() => {
              setTab("friends");
              setFeedback(null);
            }}
            className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-[13px] font-bold"
            style={{
              borderColor: "var(--border)",
              backgroundColor: tab === "friends" ? "var(--fg)" : "var(--surface)",
              color: tab === "friends" ? "var(--bg)" : "var(--fg)",
            }}
          >
            <UserPlus className="h-4 w-4" />
            Amigos ({social.friends.length})
            {social.incomingRequests.length > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px]"
                style={{ backgroundColor: "var(--chip-active-bg)", color: "var(--chip-active-fg)" }}
              >
                {social.incomingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "groups"}
            onClick={() => {
              setTab("groups");
              setFeedback(null);
            }}
            className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-[13px] font-bold"
            style={{
              borderColor: "var(--border)",
              backgroundColor: tab === "groups" ? "var(--fg)" : "var(--surface)",
              color: tab === "groups" ? "var(--bg)" : "var(--fg)",
            }}
          >
            <Users className="h-4 w-4" />
            Grupos ({groups.length})
          </button>
        </div>

        {feedback && (
          <p
            role="status"
            className="mb-3 rounded-xl px-3 py-2 text-[13px] font-semibold"
            style={{
              backgroundColor:
                feedback.kind === "err" ? "var(--danger-soft)" : "var(--highlight-bg)",
              color: feedback.kind === "err" ? "var(--danger)" : "var(--highlight-fg)",
            }}
          >
            {feedback.text}
          </p>
        )}

        {tab === "friends" ? (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSendRequest} className="flex gap-2">
              <input
                type="email"
                required
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Email de tu amigo..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="zine-input flex-1"
              />
              <button
                type="submit"
                disabled={busy}
                className="pressable shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold"
                style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
              >
                Agregar
              </button>
            </form>

            {social.incomingRequests.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[12px] font-bold" style={{ color: "var(--fg-muted)" }}>
                  Solicitudes recibidas
                </div>
                {social.incomingRequests.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold">{req.user.name}</div>
                      <div className="truncate text-[12px]" style={{ color: "var(--fg-muted)" }}>
                        {req.user.email}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRespond(req.friendshipId, "accept")}
                        className="pressable inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold"
                        style={{ backgroundColor: "var(--highlight-bg)", color: "var(--highlight-fg)" }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aceptar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRespond(req.friendshipId, "decline")}
                        className="pressable rounded-lg px-2.5 py-1.5 text-[12px] font-bold"
                        style={{ backgroundColor: "var(--pill-bg)", color: "var(--fg-muted)" }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="text-[12px] font-bold" style={{ color: "var(--fg-muted)" }}>
                Tus amigos
              </div>
              {social.friends.length === 0 ? (
                <p className="m-0 rounded-xl p-3 text-[13px]" style={{ backgroundColor: "var(--surface-soft)", color: "var(--fg-muted)" }}>
                  Todavía no agregaste amigos. Buscalos por su email para invitarlos a un grupo.
                </p>
              ) : (
                social.friends.map((item) => (
                  <div
                    key={item.friendshipId}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: "var(--surface-soft)" }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: accentCssVar(item.user.accentColor) }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold">{item.user.name}</div>
                        <div className="truncate text-[12px]" style={{ color: "var(--fg-muted)" }}>
                          {item.user.email}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemoveFriend(item.friendshipId)}
                      className="pressable shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Quitar
                    </button>
                  </div>
                ))
              )}
            </div>

            {social.outgoingRequests.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[12px] font-bold" style={{ color: "var(--fg-muted)" }}>
                  Enviadas pendientes
                </div>
                {social.outgoingRequests.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px]"
                    style={{ backgroundColor: "var(--bg)", border: "1.5px solid var(--border-soft)" }}
                  >
                    <span className="truncate">
                      <strong>{req.user.name}</strong> ({req.user.email})
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemoveFriend(req.friendshipId)}
                      className="pressable shrink-0 text-[12px] font-semibold"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {activeGroup && (
              <div
                className="flex flex-col gap-2.5 rounded-2xl border-2 p-3.5"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
              >
                <div className="font-display text-[16px] font-bold">
                  Grupo actual: {activeGroup.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeGroup.members.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
                      style={{ backgroundColor: "var(--surface-soft)" }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: accentCssVar(m.accentColor) }}
                      />
                      {m.name}
                    </span>
                  ))}
                </div>

                {friendsNotInActiveGroup.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                      Sumar a este grupo
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {friendsNotInActiveGroup.map((f) => (
                        <button
                          key={f.user.id}
                          type="button"
                          disabled={busy}
                          onClick={() => handleAddMember(f.user.id)}
                          className="pressable inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[12px] font-bold"
                          style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--surface)" }}
                        >
                          <Plus className="h-3 w-3" />
                          {f.user.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-3">
              <div className="text-[13px] font-bold">Crear nuevo grupo</div>
              <input
                type="text"
                required
                placeholder="Ej. Fer y Juli, Cafés con amigos..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="zine-input"
              />

              {social.friends.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                    Incluir amigos
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {social.friends.map((f) => {
                      const active = selectedFriends.includes(f.user.id);
                      return (
                        <button
                          key={f.user.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleFriendSelection(f.user.id)}
                          className="pressable inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-bold"
                          style={{
                            borderColor: active ? "var(--border)" : "var(--border-soft)",
                            backgroundColor: active ? "var(--highlight-bg)" : "var(--surface)",
                            color: active ? "var(--highlight-fg)" : "var(--fg)",
                          }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: accentCssVar(f.user.accentColor) }}
                          />
                          {f.user.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="pressable w-full rounded-xl px-4 py-2.5 text-[14px] font-bold"
                style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
              >
                Crear grupo
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
