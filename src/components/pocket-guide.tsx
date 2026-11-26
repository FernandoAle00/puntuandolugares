"use client";

import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddPlaceModal } from "@/components/add-place-modal";
import { HomeDesktop } from "@/components/home/home-desktop";
import { HomeMobile } from "@/components/home/home-mobile";
import type { HomeModel } from "@/components/home/home-shared";
import { PlaceSheet } from "@/components/place-sheet";
import { SocialSheet } from "@/components/social-sheet";
import type { AccentColor, MealType, ServiceType } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import {
  computeGap,
  filterAndSortPlaces,
  isPendingPlace,
  pickRandomPending,
  pickRandomPlace,
  type GroupSummary,
  type PlacePhotoEntry,
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
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [socialModal, setSocialModal] = useState<{ open: boolean; tab: "friends" | "groups" }>({
    open: false,
    tab: "friends",
  });
  const [pickedByScope, setPickedByScope] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{
    photos: PlacePhotoEntry[];
    index: number;
    placeName: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lightboxDialogRef = useRef<HTMLDivElement | null>(null);
  const lightboxCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);

  function openLightbox(
    photos: PlacePhotoEntry[],
    index: number,
    placeName: string,
    triggerEl: HTMLElement | null = null,
  ) {
    lightboxTriggerRef.current = triggerEl;
    setLightbox({ photos, index, placeName });
  }

  function closeLightbox() {
    setLightbox(null);
    const trigger = lightboxTriggerRef.current;
    lightboxTriggerRef.current = null;
    requestAnimationFrame(() => trigger?.focus());
  }

  const isLightboxOpen = lightbox !== null;
  useEffect(() => {
    if (isLightboxOpen) {
      lightboxCloseBtnRef.current?.focus();
    }
  }, [isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "Tab") {
        const dialog = lightboxDialogRef.current;
        if (!dialog) return;
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "ArrowLeft") {
        setLightbox((prev) =>
          prev && prev.photos.length > 1
            ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }
            : prev,
        );
      } else if (e.key === "ArrowRight") {
        setLightbox((prev) =>
          prev && prev.photos.length > 1
            ? { ...prev, index: (prev.index + 1) % prev.photos.length }
            : prev,
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLightboxOpen]);

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

  const pendingReqCount = social.incomingRequests.length;

  const homeModel: HomeModel = {
    currentUser,
    groups,
    activeGroup,
    selectGroup: handleSelectGroup,
    section,
    setSection,
    mode: effectiveMode,
    setMode,
    showGapTab,
    meal,
    setMeal,
    query,
    setQuery,
    serviceCounts,
    repeatCount: repeatPlaces.length,
    ratedCount,
    pendingCount,
    gapCount,
    visiblePlaces,
    groupPlaces,
    pickedPlace,
    canSpin: isRepeatSection ? repeatPlaces.length > 1 : pendingCount > 1,
    spin: handleSpinRandom,
    openPlace: setSelectedPlaceId,
    openAdd: () => setAddOpen(true),
    openSocial: (tab) => setSocialModal({ open: true, tab }),
    pendingReqCount,
    refresh: handleRefresh,
    refreshing,
    logout: handleLogout,
    openLightbox: (photos, index, placeName, triggerEl) =>
      openLightbox(photos, index, placeName, triggerEl ?? null),
  };

  return (
    <main>
      {/* One layout per form factor; both read the same model. */}
      <div className="md:hidden">
        <HomeMobile m={homeModel} />
      </div>
      <div className="hidden md:block">
        <HomeDesktop m={homeModel} />
      </div>

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

      {/* Full-size Photo Lightbox from main list */}
      {lightbox && lightbox.photos[lightbox.index] && (() => {
        const activePhoto = lightbox.photos[lightbox.index]!;
        const total = lightbox.photos.length;
        return (
          <div
            ref={lightboxDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Foto de ${lightbox.placeName}`}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.92)",
              paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
            }}
            onClick={closeLightbox}
          >
            <button
              ref={lightboxCloseBtnRef}
              type="button"
              onClick={closeLightbox}
              aria-label="Cerrar foto"
              className="pressable absolute right-4 inline-flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                top: "max(16px, env(safe-area-inset-top, 0px))",
                backgroundColor: "rgba(255,255,255,0.16)",
                color: "#ffffff",
              }}
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className="relative flex w-full max-w-[520px] items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {total > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev ? { ...prev, index: (prev.index - 1 + total) % total } : prev,
                    )
                  }
                  aria-label="Foto anterior"
                  className="pressable absolute left-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#ffffff" }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto.url}
                alt={activePhoto.caption || lightbox.placeName}
                className="max-h-[78dvh] max-w-full rounded-2xl object-contain"
              />

              {total > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev ? { ...prev, index: (prev.index + 1) % total } : prev,
                    )
                  }
                  aria-label="Foto siguiente"
                  className="pressable absolute right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#ffffff" }}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="mt-3 text-center text-[14px] text-white">
              <div className="font-display font-bold">{lightbox.placeName}</div>
              {(activePhoto.caption || activePhoto.uploadedBy || total > 1) && (
                <div className="mt-0.5 text-[13px] text-white/80">
                  {activePhoto.caption && <span>{activePhoto.caption}</span>}
                  {activePhoto.uploadedBy && (
                    <span className={activePhoto.caption ? "ml-1.5 opacity-75" : "opacity-75"}>
                      ({activePhoto.uploadedBy})
                    </span>
                  )}
                  {total > 1 && (
                    <span className="tabular ml-2 opacity-75">
                      {lightbox.index + 1}/{total}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
