"use client";

import {
  Check,
  Dices,
  IceCreamCone,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  ShoppingBag,
  User,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddPlaceModal } from "@/components/add-place-modal";
import { accentCssVar, PlaceSheet } from "@/components/place-sheet";
import { SocialSheet } from "@/components/social-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AccentColor, MealType, ServiceType } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import {
  buildGoogleMapsUrl,
  computeAverage,
  computeGap,
  filterAndSortPlaces,
  formatScore,
  formatVisitDate,
  isPendingPlace,
  MEAL_LABELS,
  MEALS,
  pickRandomPending,
  pickRandomPlace,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type GroupSummary,
  type PlaceWithRatings,
  type SocialSnapshot,
  type ViewMode,
} from "@/lib/domain";

type SectionKey = ServiceType | "repeat";

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
  const [section, setSection] = useState<SectionKey>("dine_in");
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
  const [pickedByScope, setPickedByScope] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const showGapTab = Boolean(
    activeGroup && !activeGroup.isPersonal && activeGroup.members.length >= 2,
  );
  const effectiveMode: ViewMode = !showGapTab && mode === "gap" ? "ranking" : mode;

  const groupPlaces = useMemo(
    () => (activeGroupId ? places.filter((p) => p.groupId === activeGroupId) : []),
    [places, activeGroupId],
  );

  const serviceCounts = useMemo(() => {
    const counts: Record<ServiceType, number> = {
      dine_in: 0,
      delivery: 0,
      ice_cream: 0,
    };
    for (const p of groupPlaces) {
      counts[p.serviceType] = (counts[p.serviceType] ?? 0) + 1;
    }
    return counts;
  }, [groupPlaces]);

  const repeatPlaces = useMemo(
    () => groupPlaces.filter((p) => p.repeatMarked),
    [groupPlaces],
  );

  const isRepeatSection = section === "repeat";
  const activeServiceType: ServiceType = isRepeatSection ? "dine_in" : section;

  const servicePlaces = useMemo(
    () => (isRepeatSection ? repeatPlaces : groupPlaces.filter((p) => p.serviceType === section)),
    [groupPlaces, repeatPlaces, isRepeatSection, section],
  );

  const ratedCount = useMemo(
    () => servicePlaces.filter((p) => !isPendingPlace(p)).length,
    [servicePlaces],
  );
  const pendingCount = servicePlaces.length - ratedCount;
  const gapCount = useMemo(
    () => servicePlaces.filter((p) => computeGap(p.ratings) !== null).length,
    [servicePlaces],
  );

  const visiblePlaces = useMemo(
    () =>
      filterAndSortPlaces(groupPlaces, {
        mode: effectiveMode,
        meal,
        serviceType: isRepeatSection ? undefined : section,
        onlyRepeat: isRepeatSection,
        query,
      }),
    [groupPlaces, effectiveMode, meal, isRepeatSection, section, query],
  );

  const pickScopeKey = activeGroupId ? `${activeGroupId}:${section}` : null;

  const pickedPlace = useMemo(() => {
    if (!pickScopeKey) return null;
    const savedId = pickedByScope[pickScopeKey];
    if (isRepeatSection) {
      const exact = repeatPlaces.find((p) => p.id === savedId);
      return exact ?? repeatPlaces[0] ?? null;
    }
    const exact = servicePlaces.find((p) => p.id === savedId && isPendingPlace(p));
    return exact ?? servicePlaces.find(isPendingPlace) ?? null;
  }, [pickScopeKey, pickedByScope, isRepeatSection, repeatPlaces, servicePlaces]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  function handleSpinRandom() {
    if (!pickScopeKey) return;
    const next = isRepeatSection
      ? pickRandomPlace(repeatPlaces, pickedPlace?.id)
      : pickRandomPending(servicePlaces, pickedPlace?.id);
    if (next) {
      setPickedByScope((prev) => ({ ...prev, [pickScopeKey]: next.id }));
    }
  }

  function handleCreated(created: PlaceWithRatings) {
    setPlaces((prev) => [created, ...prev]);
    setSection(created.serviceType);
    if (isPendingPlace(created)) {
      const scopeKey = `${created.groupId}:${created.serviceType}`;
      setPickedByScope((prev) => ({ ...prev, [scopeKey]: created.id }));
    }
  }

  function handleUpdated(updated: PlaceWithRatings) {
    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted(placeId: string) {
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }

  function handleSelectGroup(group: GroupSummary) {
    setActiveGroupId(group.id);
    if ((group.isPersonal || group.members.length < 2) && mode === "gap") {
      setMode("ranking");
    }
  }

  function handleGroupCreated(created: GroupSummary) {
    setGroups((prev) =>
      [...prev, created].sort((a, b) => Number(a.isPersonal) - Number(b.isPersonal)),
    );
    setActiveGroupId(created.id);
    if ((created.isPersonal || created.members.length < 2) && mode === "gap") {
      setMode("ranking");
    }
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

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setJustRefreshed(false);
    try {
      const [groupsRes, placesRes, socialRes] = await Promise.all([
        fetch("/api/groups", { cache: "no-store" }),
        fetch("/api/places", { cache: "no-store" }),
        fetch("/api/friends", { cache: "no-store" }),
      ]);

      if (groupsRes.status === 401 || placesRes.status === 401 || socialRes.status === 401) {
        router.refresh();
        return;
      }

      if (groupsRes.ok) {
        const data = (await groupsRes.json()) as { groups?: GroupSummary[] };
        if (data.groups) {
          const nextGroups = data.groups;
          setGroups(nextGroups);
          setActiveGroupId((prev) =>
            prev && nextGroups.some((g) => g.id === prev) ? prev : (nextGroups[0]?.id ?? null),
          );
        }
      }
      if (placesRes.ok) {
        const data = (await placesRes.json()) as { places?: PlaceWithRatings[] };
        if (data.places) setPlaces(data.places);
      }
      if (socialRes.ok) {
        const data = (await socialRes.json()) as { social?: SocialSnapshot };
        if (data.social) setSocial(data.social);
      }

      setJustRefreshed(true);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => setJustRefreshed(false), 900);
    } catch {
      router.refresh();
    } finally {
      setRefreshing(false);
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
                onClick={() => handleSelectGroup(g)}
                className="pressable inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[12px] font-bold"
                style={{
                  borderColor: isCurrent ? "var(--border)" : "var(--border-soft)",
                  backgroundColor: isCurrent ? "var(--surface)" : "transparent",
                  color: "var(--fg)",
                }}
              >
                {g.isPersonal && <User className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{g.name}</span>
                {!g.isPersonal && (
                  <span className="tabular opacity-65">({g.members.length})</span>
                )}
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

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Actualizando datos" : "Actualizar datos"}
            aria-busy={refreshing}
            title="Actualizar"
            className="pressable inline-flex h-9 w-9 items-center justify-center rounded-full border-2 disabled:opacity-60"
            style={{
              borderColor: "var(--border)",
              backgroundColor: justRefreshed ? "var(--highlight-bg)" : "var(--surface)",
              color: justRefreshed ? "var(--highlight-fg)" : "var(--fg)",
            }}
          >
            {justRefreshed ? (
              <Check className="h-4 w-4 stroke-[2.5]" />
            ) : (
              <RefreshCw
                className={`h-4 w-4 transition-transform duration-300 ${refreshing ? "rotate-180" : ""}`}
              />
            )}
          </button>

          {activeGroup && (
            <>
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
            </>
          )}
        </div>
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

          {/* Section Switcher (Salidas / Delivery / Heladerías / A repetir) */}
          <div
            className="mb-3.5 grid grid-cols-2 gap-1 rounded-2xl border-2 p-1 sm:grid-cols-4"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--surface)",
            }}
            role="tablist"
            aria-label="Apartado"
          >
            {SERVICE_TYPES.map((type) => {
              const active = section === type;
              const count = serviceCounts[type];
              const Icon =
                type === "dine_in"
                  ? Utensils
                  : type === "delivery"
                    ? ShoppingBag
                    : IceCreamCone;
              return (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSection(type)}
                  className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] leading-none font-bold whitespace-nowrap sm:text-[12.5px]"
                  style={{
                    backgroundColor: active ? "var(--badge-bg)" : "transparent",
                    color: active ? "var(--badge-fg)" : "var(--fg-muted)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{SERVICE_LABELS[type]}</span>
                  <span className="tabular opacity-80">({count})</span>
                </button>
              );
            })}
            <button
              type="button"
              role="tab"
              aria-selected={isRepeatSection}
              onClick={() => setSection("repeat")}
              className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[12px] leading-none font-bold whitespace-nowrap sm:text-[12.5px]"
              style={{
                backgroundColor: isRepeatSection ? "var(--badge-bg)" : "transparent",
                color: isRepeatSection ? "var(--badge-fg)" : "var(--fg-muted)",
              }}
            >
              <Repeat className="h-3.5 w-3.5 shrink-0" />
              <span>A repetir</span>
              <span className="tabular opacity-80">({repeatPlaces.length})</span>
            </button>
          </div>

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
                  ? `${
                      isRepeatSection
                        ? "Para repetir"
                        : section === "delivery"
                          ? "Próximo pedido"
                          : section === "ice_cream"
                            ? "Próxima heladería"
                            : "Próxima salida"
                    }: ${pickedPlace.name}`
                  : isRepeatSection
                    ? "Todavía no marcaste lugares"
                    : "No quedan pendientes"}
              </div>
              <div className="mt-0.5 text-[13px]" style={{ color: "var(--highlight-muted)" }}>
                {pickedPlace
                  ? isRepeatSection && pickedPlace.nextOrder
                    ? `Próxima vez: ${pickedPlace.nextOrder}`
                    : pickedPlace.meals.map((m) => MEAL_LABELS[m]).join(" o ")
                  : isRepeatSection
                    ? "Abrí cualquier lugar y tocá A repetir"
                    : section === "delivery"
                      ? "Sumá un lugar nuevo para pedir"
                      : section === "ice_cream"
                        ? "Sumá una heladería nueva para probar"
                        : "Sumá un lugar nuevo para probar"}
              </div>
            </button>

            {(isRepeatSection ? repeatPlaces.length > 1 : pendingCount > 1) && (
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

          {/* View Mode Tabs (hidden inside A repetir so all marked places appear together) */}
          {!isRepeatSection && (
            <div
              className={`mb-3 grid gap-2 ${showGapTab ? "grid-cols-3" : "grid-cols-2"}`}
              role="tablist"
            >
              {(showGapTab
                ? ([
                    { key: "ranking", label: `Top (${ratedCount})` },
                    { key: "pending", label: `Pendientes (${pendingCount})` },
                    { key: "gap", label: `Polémicos (${gapCount})` },
                  ] as const)
                : ([
                    { key: "ranking", label: `Top (${ratedCount})` },
                    { key: "pending", label: `Pendientes (${pendingCount})` },
                  ] as const)
              ).map((tab) => {
                const active = effectiveMode === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(tab.key)}
                    className="pressable tabular rounded-xl border-2 px-1.5 py-2.5 text-center text-[12px] font-bold whitespace-nowrap sm:px-2 sm:text-[13px]"
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
          )}

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
              const isHighlighted =
                (isRepeatSection || effectiveMode === "pending") && pickedPlace?.id === place.id;

              const visitReviewItems = place.visits.flatMap((visit) => {
                const dateLabel = formatVisitDate(visit.visitedAt);
                return visit.entries
                  .filter((e) => e.dish.trim().length > 0 || e.note.trim().length > 0)
                  .map((e) => ({
                    id: e.id,
                    userName: e.userName,
                    userAccent: e.userAccent,
                    dish: e.dish.trim(),
                    note: e.note.trim(),
                    dateLabel,
                  }));
              });

              const reviewItems =
                visitReviewItems.length > 0
                  ? visitReviewItems
                  : place.ratings
                      .filter((r) => r.note.trim().length > 0)
                      .map((r) => ({
                        id: r.id,
                        userName: r.userName,
                        userAccent: r.userAccent,
                        dish: "",
                        note: r.note.trim(),
                        dateLabel: "",
                      }));

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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="font-display text-[18px] leading-snug font-bold">
                          {place.name}
                        </div>
                        {place.repeatMarked && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{
                              backgroundColor: "var(--highlight-bg)",
                              color: "var(--highlight-fg)",
                            }}
                          >
                            <Repeat className="h-3 w-3" />
                            A repetir
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {isRepeatSection && (
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                            style={{
                              backgroundColor: "var(--pill-bg)",
                              color: "var(--pill-fg)",
                            }}
                          >
                            {SERVICE_LABELS[place.serviceType]}
                          </span>
                        )}
                        <span>
                          {place.meals.map((m) => MEAL_LABELS[m]).join(" / ")}
                          {place.address ? ` en ${place.address}` : ""}
                        </span>
                        {place.visits.length > 0 && (
                          <span className="tabular font-semibold" style={{ color: "var(--fg)" }}>
                            {place.visits.length}{" "}
                            {place.serviceType === "delivery"
                              ? place.visits.length === 1
                                ? "pedido"
                                : "pedidos"
                              : place.visits.length === 1
                                ? "visita"
                                : "visitas"}
                          </span>
                        )}
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
                        {!isRepeatSection && effectiveMode === "gap" && gap !== null
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

                  {place.repeatMarked && place.nextOrder.trim().length > 0 && (
                    <div
                      className="flex items-start gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px]"
                      style={{
                        borderColor: "var(--border-soft)",
                        backgroundColor: "var(--bg)",
                      }}
                    >
                      <Repeat
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--fg-muted)" }}
                      />
                      <div>
                        <span className="font-bold">Próxima vez: </span>
                        <span>{place.nextOrder}</span>
                      </div>
                    </div>
                  )}

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

                  {reviewItems.length > 0 && (
                    <div
                      className="flex flex-col gap-2 rounded-xl px-3 py-2.5 text-[13px]"
                      style={{ backgroundColor: "var(--surface-soft)" }}
                    >
                      {reviewItems.map((item, itemIdx) => {
                        const authorColor = accentCssVar(item.userAccent);
                        return (
                          <div
                            key={item.id}
                            className={itemIdx > 0 ? "border-t pt-2" : undefined}
                            style={itemIdx > 0 ? { borderColor: "var(--border-soft)" } : undefined}
                          >
                            {item.dish ? (
                              <>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                  <div className="font-display text-[13.5px] leading-snug font-bold">
                                    {item.dish}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11.5px] font-bold">
                                    <span style={{ color: authorColor }}>{item.userName}</span>
                                    {item.dateLabel && (
                                      <span
                                        className="font-semibold"
                                        style={{ color: "var(--fg-muted)" }}
                                      >
                                        {item.dateLabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {item.note && (
                                  <p
                                    className="mt-0.5 mb-0 text-[12.5px] leading-snug"
                                    style={{ color: "var(--fg-muted)" }}
                                  >
                                    {item.note}
                                  </p>
                                )}
                              </>
                            ) : (
                              <div>
                                <strong style={{ color: authorColor }}>{item.userName}:</strong>{" "}
                                {item.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                {isRepeatSection
                  ? "Todavía no hay lugares marcados como A repetir."
                  : "No hay lugares para este filtro."}
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
        groupMembers={activeGroup?.members ?? []}
        onClose={() => setSelectedPlaceId(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />

      <AddPlaceModal
        open={addOpen}
        groupId={activeGroup?.id ?? null}
        groupName={activeGroup?.name ?? ""}
        defaultServiceType={activeServiceType}
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
