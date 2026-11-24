"use client";

import { Dices, LogOut, MapPin, Plus, Search, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddPlaceModal } from "@/components/add-place-modal";
import { accentCssVar, PlaceSheet } from "@/components/place-sheet";
import { SocialSheet } from "@/components/social-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AccentColor, MealType } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import {
  buildGoogleMapsUrl,
  computeAverage,
  computeGap,
  filterAndSortPlaces,
  formatScore,
  isPendingPlace,
  MEAL_LABELS,
  MEALS,
  pickRandomPending,
  type GroupSummary,
  type PlaceWithRatings,
  type SocialSnapshot,
  type ViewMode,
} from "@/lib/domain";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  accentColor: AccentColor;
}

interface PocketGuideProps {
  initialGroups: GroupSummary[];
  initialPlaces: PlaceWithRatings[];
  initialSocial: SocialSnapshot;
  currentUser: CurrentUser;
}

export function PocketGuide({
  initialGroups,
  initialPlaces,
  initialSocial,
  currentUser,
}: PocketGuideProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[]>(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    initialGroups[0]?.id ?? null,
  );
  const [places, setPlaces] = useState<PlaceWithRatings[]>(initialPlaces);
  const [social, setSocial] = useState<SocialSnapshot>(initialSocial);
  const [mode, setMode] = useState<ViewMode>("ranking");
  const [meal, setMeal] = useState<MealType | "all">("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [socialModal, setSocialModal] = useState<{ open: boolean; tab: "friends" | "groups" }>({
    open: false,
    tab: "friends",
  });
  const [pickedByGroup, setPickedByGroup] = useState<Record<string, string>>({});

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const groupPlaces = useMemo(
    () => (activeGroupId ? places.filter((p) => p.groupId === activeGroupId) : []),
    [places, activeGroupId],
  );

  const ratedCount = useMemo(
    () => groupPlaces.filter((p) => !isPendingPlace(p)).length,
    [groupPlaces],
  );
  const pendingCount = groupPlaces.length - ratedCount;

  const visiblePlaces = useMemo(
    () => filterAndSortPlaces(groupPlaces, { mode, meal, query }),
    [groupPlaces, mode, meal, query],
  );

  const pickedPlace = useMemo(() => {
    if (!activeGroupId) return null;
    const savedId = pickedByGroup[activeGroupId];
    const exact = groupPlaces.find((p) => p.id === savedId && isPendingPlace(p));
    return exact ?? groupPlaces.find(isPendingPlace) ?? null;
  }, [activeGroupId, pickedByGroup, groupPlaces]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  function handleSpinRandom() {
    if (!activeGroupId) return;
    const next = pickRandomPending(groupPlaces, pickedPlace?.id);
    if (next) {
      setPickedByGroup((prev) => ({ ...prev, [activeGroupId]: next.id }));
    }
  }

  function handleCreated(created: PlaceWithRatings) {
    setPlaces((prev) => [created, ...prev]);
    if (isPendingPlace(created)) {
      setPickedByGroup((prev) => ({ ...prev, [created.groupId]: created.id }));
    }
  }

  function handleUpdated(updated: PlaceWithRatings) {
    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(placeId: string) {
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }

  function handleGroupCreated(created: GroupSummary) {
    setGroups((prev) => [...prev, created]);
    setActiveGroupId(created.id);
    setSocialModal((prev) => ({ ...prev, open: false }));
  }

  async function handleGroupUpdated(updated: GroupSummary) {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    try {
      const [placesRes, socialRes] = await Promise.all([
        fetch("/api/places"),
        fetch("/api/friends"),
      ]);
      if (placesRes.ok) {
        const data = (await placesRes.json()) as { places?: PlaceWithRatings[] };
        if (data.places) setPlaces(data.places);
      }
      if (socialRes.ok) {
        const data = (await socialRes.json()) as { social?: SocialSnapshot };
        if (data.social) setSocial(data.social);
      }
    } catch {
      router.refresh();
    }
  }

  async function handleLogout() {
    await authClient.signOut();
    router.refresh();
  }

  const userAccent = accentCssVar(currentUser.accentColor);
  const pendingReqCount = social.incomingRequests.length;

  return (
    <main
      className="mx-auto w-full max-w-[540px] px-4 pt-4 pb-12"
      style={{
        paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(44px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display m-0 text-[22px] leading-none font-bold tracking-tight sm:text-[25px]">
            ¿Dónde comemos?
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: userAccent }}
            />
            <span className="truncate">{currentUser.name}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSocialModal({ open: true, tab: "friends" })}
            aria-label="Amigos y grupos"
            title="Amigos y grupos"
            className="pressable relative inline-flex h-9 w-9 items-center justify-center rounded-full border-2"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--fg)",
            }}
          >
            <Users className="h-4 w-4" />
            {pendingReqCount > 0 && (
              <span
                className="tabular absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{
                  backgroundColor: "var(--chip-active-bg)",
                  color: "var(--chip-active-fg)",
                }}
              >
                {pendingReqCount}
              </span>
            )}
          </button>

          <ThemeToggle />

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="pressable inline-flex h-9 w-9 items-center justify-center rounded-full border-2"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--fg)",
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Group Selector + Primary Action Row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tus grupos">
          {groups.map((g) => {
            const isCurrent = g.id === activeGroupId;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={isCurrent}
                onClick={() => setActiveGroupId(g.id)}
                className="pressable inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-bold"
                style={{
                  borderColor: isCurrent ? "var(--border)" : "var(--border-soft)",
                  backgroundColor: isCurrent ? "var(--surface)" : "transparent",
                  color: "var(--fg)",
                }}
              >
                <span>{g.name}</span>
                <span className="tabular opacity-65">({g.members.length})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSocialModal({ open: true, tab: "groups" })}
            className="pressable inline-flex items-center gap-1 rounded-full border-2 border-dashed px-2.5 py-1 text-[12px] font-bold"
            style={{ borderColor: "var(--border-soft)", color: "var(--fg-muted)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Grupo
          </button>
        </div>

        {activeGroup && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setQuery("");
              }}
              aria-label="Buscar lugares"
              aria-pressed={searchOpen}
              className="pressable inline-flex h-9 w-9 items-center justify-center rounded-full border-2"
              style={{
                borderColor: "var(--border)",
                backgroundColor: searchOpen ? "var(--highlight-bg)" : "var(--surface)",
                color: searchOpen ? "var(--highlight-fg)" : "var(--fg)",
              }}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="pressable inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap"
              style={{
                backgroundColor: "var(--badge-bg)",
                color: "var(--badge-fg)",
              }}
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              Sumar
            </button>
          </div>
        )}
      </div>

      {!activeGroup ? (
        <section className="zine-card flex flex-col items-start gap-3 p-5">
          <div className="font-display text-[20px] font-bold">
            Creá tu primer grupo para puntuar
          </div>
          <p className="m-0 text-[14px]" style={{ color: "var(--fg-muted)" }}>
            Agregá amigos por email y armá un grupo compartido para cargar lugares, puntajes y reseñas.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSocialModal({ open: true, tab: "groups" })}
              className="pressable rounded-xl px-4 py-2.5 text-[13px] font-bold"
              style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
            >
              Crear grupo
            </button>
            <button
              type="button"
              onClick={() => setSocialModal({ open: true, tab: "friends" })}
              className="pressable rounded-xl border-2 px-4 py-2.5 text-[13px] font-bold"
              style={{ borderColor: "var(--border)" }}
            >
              Agregar amigos
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Expandable Search */}
          {searchOpen && (
            <div className="mb-3.5">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, dirección o nota..."
                className="zine-input"
              />
            </div>
          )}

          {/* Roulette Decision Widget */}
          <section className="zine-roulette mb-4 flex items-center justify-between gap-3 p-4">
            <button
              type="button"
              onClick={() => {
                if (pickedPlace) setSelectedPlaceId(pickedPlace.id);
              }}
              disabled={!pickedPlace}
              className="min-w-0 flex-1 text-left"
            >
              <div className="font-display text-[17px] leading-snug font-bold">
                {pickedPlace
                  ? `Próxima salida: ${pickedPlace.name}`
                  : "No quedan pendientes"}
              </div>
              <div className="mt-0.5 text-[13px]" style={{ color: "var(--highlight-muted)" }}>
                {pickedPlace
                  ? pickedPlace.meals.map((m) => MEAL_LABELS[m]).join(" o ")
                  : "Sumá un lugar nuevo para probar"}
              </div>
            </button>

            {pendingCount > 1 && (
              <button
                type="button"
                onClick={handleSpinRandom}
                className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap"
                style={{
                  backgroundColor: "#0F291E",
                  color: "#FFFFFF",
                }}
              >
                <Dices className="h-4 w-4" />
                Otro al azar
              </button>
            )}
          </section>

          {/* View Mode Tabs */}
          <div className="mb-3 grid grid-cols-3 gap-2" role="tablist">
            {(
              [
                { key: "ranking", label: `Top (${ratedCount})` },
                { key: "pending", label: `Pendientes (${pendingCount})` },
                { key: "gap", label: "Polémicos" },
              ] as const
            ).map((tab) => {
              const active = mode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.key)}
                  className="pressable rounded-xl border-2 px-2 py-2.5 text-center text-[13px] font-bold"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: active ? "var(--fg)" : "var(--surface)",
                    color: active ? "var(--bg)" : "var(--fg)",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Meal Filters */}
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por momento">
            <button
              type="button"
              aria-pressed={meal === "all"}
              onClick={() => setMeal("all")}
              className="pressable rounded-full px-3 py-1.5 text-[12px] font-bold"
              style={{
                backgroundColor: meal === "all" ? "var(--chip-active-bg)" : "var(--pill-bg)",
                color: meal === "all" ? "var(--chip-active-fg)" : "var(--pill-fg)",
              }}
            >
              Todo
            </button>
            {MEALS.map((m) => {
              const active = meal === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMeal(m)}
                  className="pressable rounded-full px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    backgroundColor: active ? "var(--chip-active-bg)" : "var(--pill-bg)",
                    color: active ? "var(--chip-active-fg)" : "var(--pill-fg)",
                  }}
                >
                  {MEAL_LABELS[m]}
                </button>
              );
            })}
          </div>

          {/* Places List */}
          <section className="flex flex-col gap-3" aria-label="Listado de lugares">
            {visiblePlaces.map((place) => {
              const avg = computeAverage(place.ratings);
              const gap = computeGap(place.ratings);
              const isHighlighted = mode === "pending" && pickedPlace?.id === place.id;
              const notes = place.ratings.filter((r) => r.note.trim().length > 0);

              return (
                <div
                  key={place.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlaceId(place.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedPlaceId(place.id);
                    }
                  }}
                  className="zine-card zine-card-interactive pressable flex w-full cursor-pointer flex-col gap-2.5 p-4 text-left"
                  style={
                    isHighlighted
                      ? {
                          backgroundColor: "var(--card-pick-bg)",
                          boxShadow: "4px 4px 0 var(--shadow-ink)",
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display text-[18px] leading-snug font-bold">
                        {place.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]" style={{ color: "var(--fg-muted)" }}>
                        <span>
                          {place.meals.map((m) => MEAL_LABELS[m]).join(" / ")}
                          {place.address ? ` en ${place.address}` : ""}
                        </span>
                        <a
                          href={buildGoogleMapsUrl(place)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 font-bold underline decoration-dotted underline-offset-2"
                          style={{ color: "var(--fg)" }}
                        >
                          <MapPin className="h-3 w-3" />
                          Maps
                        </a>
                      </div>
                    </div>

                    {avg !== null ? (
                      <span
                        className="font-display tabular shrink-0 rounded-xl px-2.5 py-1 text-[18px] leading-tight font-bold"
                        style={{
                          backgroundColor: "var(--badge-bg)",
                          color: "var(--badge-fg)",
                        }}
                      >
                        {mode === "gap" && gap !== null
                          ? `${formatScore(gap)} diff`
                          : formatScore(avg)}
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-xl border-2 px-2.5 py-1 text-[12px] font-bold"
                        style={{
                          borderColor: "var(--border)",
                          backgroundColor: "var(--bg)",
                        }}
                      >
                        Puntuar
                      </span>
                    )}
                  </div>

                  {place.ratings.length > 0 && (
                    <div className="tabular flex flex-col gap-1.5">
                      {place.ratings.map((r) => {
                        const color = accentCssVar(r.userAccent);
                        return (
                          <div
                            key={r.id}
                            className="grid grid-cols-[52px_1fr_36px] items-center gap-2 text-[12px] font-bold"
                          >
                            <span className="truncate" style={{ color }}>
                              {r.userName}
                            </span>
                            <div
                              className="h-2 overflow-hidden rounded-full"
                              style={{ backgroundColor: "var(--surface-soft)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${r.score * 10}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                            <span className="text-right" style={{ color }}>
                              {formatScore(r.score)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {place.photos.length > 0 && (
                    <div className="flex items-center gap-2">
                      {place.photos.slice(0, 4).map((photo) => (
                        <div
                          key={photo.id}
                          className="h-14 w-14 overflow-hidden rounded-xl border"
                          style={{ borderColor: "var(--border-soft)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={photo.caption || `Foto de ${place.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                      {place.photos.length > 4 && (
                        <span
                          className="tabular text-[12px] font-bold"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          +{place.photos.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {notes.length > 0 && (
                    <div
                      className="flex flex-col gap-1 rounded-xl px-3 py-2 text-[13px]"
                      style={{ backgroundColor: "var(--surface-soft)" }}
                    >
                      {notes.map((r) => (
                        <div key={r.id}>
                          <strong style={{ color: accentCssVar(r.userAccent) }}>
                            {r.userName}:
                          </strong>{" "}
                          {r.note}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {visiblePlaces.length === 0 && (
              <div
                className="zine-card p-6 text-center text-[14px]"
                style={{ color: "var(--fg-muted)" }}
              >
                No hay lugares para este filtro.
              </div>
            )}
          </section>
        </>
      )}

      <PlaceSheet
        place={selectedPlace}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        currentUserAccent={currentUser.accentColor}
        onClose={() => setSelectedPlaceId(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />

      <AddPlaceModal
        open={addOpen}
        groupId={activeGroup?.id ?? null}
        groupName={activeGroup?.name ?? ""}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />

      <SocialSheet
        open={socialModal.open}
        initialTab={socialModal.tab}
        social={social}
        groups={groups}
        activeGroupId={activeGroupId}
        onClose={() => setSocialModal((prev) => ({ ...prev, open: false }))}
        onSocialUpdated={setSocial}
        onGroupCreated={handleGroupCreated}
        onGroupUpdated={handleGroupUpdated}
      />
    </main>
  );
}
