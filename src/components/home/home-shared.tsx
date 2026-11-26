"use client";

/**
 * Home model and small building blocks shared by HomeMobile and HomeDesktop.
 * PocketGuide owns all state and passes it down as a HomeModel.
 */

import {
  Check,
  ChevronDown,
  IceCreamCone,
  LogOut,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Sun,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { accentCssVar } from "@/components/place-sheet";
import type { AccentColor, MealType, ServiceType } from "@/db/schema";
import {
  formatScore,
  formatVisitDate,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type GroupSummary,
  type PlacePhotoEntry,
  type PlaceWithRatings,
  type ViewMode,
} from "@/lib/domain";

export type SectionKey = ServiceType | "repeat";

/** Everything a variant needs: state, derived lists and actions, all owned by PocketGuide. */
export interface HomeModel {
  currentUser: { id: string; name: string; accentColor: AccentColor };
  groups: GroupSummary[];
  activeGroup: GroupSummary | null;
  selectGroup: (group: GroupSummary) => void;
  section: SectionKey;
  setSection: (section: SectionKey) => void;
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  showGapTab: boolean;
  meal: MealType | "all";
  setMeal: (meal: MealType | "all") => void;
  query: string;
  setQuery: (query: string) => void;
  serviceCounts: Record<ServiceType, number>;
  repeatCount: number;
  ratedCount: number;
  pendingCount: number;
  gapCount: number;
  visiblePlaces: PlaceWithRatings[];
  groupPlaces: PlaceWithRatings[];
  pickedPlace: PlaceWithRatings | null;
  canSpin: boolean;
  spin: () => void;
  openPlace: (placeId: string) => void;
  openAdd: () => void;
  openSocial: (tab: "friends" | "groups") => void;
  pendingReqCount: number;
  refresh: () => Promise<void>;
  refreshing: boolean;
  logout: () => Promise<void>;
  openLightbox: (
    photos: PlacePhotoEntry[],
    index: number,
    placeName: string,
    triggerEl?: HTMLElement | null,
  ) => void;
}

export interface SectionItem {
  key: SectionKey;
  label: string;
  short: string;
  icon: LucideIcon;
  count: number;
}

const SECTION_ICONS: Record<ServiceType, LucideIcon> = {
  dine_in: Utensils,
  delivery: ShoppingBag,
  ice_cream: IceCreamCone,
};

const SECTION_SHORT: Record<SectionKey, string> = {
  dine_in: "Salir",
  delivery: "Pedir",
  ice_cream: "Helado",
  repeat: "Repetir",
};

export function sectionItems(m: HomeModel): SectionItem[] {
  return [
    ...SERVICE_TYPES.map((type) => ({
      key: type,
      label: SERVICE_LABELS[type],
      short: SECTION_SHORT[type],
      icon: SECTION_ICONS[type],
      count: m.serviceCounts[type],
    })),
    { key: "repeat", label: "A repetir", short: SECTION_SHORT.repeat, icon: Repeat, count: m.repeatCount },
  ];
}

export function pickLabel(section: SectionKey): string {
  switch (section) {
    case "repeat":
      return "Para repetir";
    case "delivery":
      return "Próximo pedido";
    case "ice_cream":
      return "Próxima heladería";
    default:
      return "Próxima salida";
  }
}

export function visitsLabel(place: PlaceWithRatings): string | null {
  const n = place.visits.length;
  if (n === 0) return null;
  if (place.serviceType === "delivery") return `${n} ${n === 1 ? "pedido" : "pedidos"}`;
  return `${n} ${n === 1 ? "visita" : "visitas"}`;
}

export function nextOrderPhotosOf(place: PlaceWithRatings): PlacePhotoEntry[] {
  return place.photos.filter((p) => p.kind === "next_order");
}

export function regularPhotosOf(place: PlaceWithRatings): PlacePhotoEntry[] {
  return place.photos.filter((p) => p.kind !== "next_order");
}

export interface ReviewItem {
  id: string;
  userName: string;
  userAccent: AccentColor;
  dish: string;
  note: string;
  dateLabel: string;
}

/** Visit entries with text, falling back to legacy rating notes. */
export function reviewItemsOf(place: PlaceWithRatings): ReviewItem[] {
  const fromVisits = place.visits.flatMap((visit) =>
    visit.entries
      .filter((e) => e.dish.trim() || e.note.trim())
      .map((e) => ({
        id: e.id,
        userName: e.userName,
        userAccent: e.userAccent,
        dish: e.dish.trim(),
        note: e.note.trim(),
        dateLabel: formatVisitDate(visit.visitedAt),
      })),
  );
  if (fromVisits.length > 0) return fromVisits;
  return place.ratings
    .filter((r) => r.note.trim())
    .map((r) => ({
      id: r.id,
      userName: r.userName,
      userAccent: r.userAccent,
      dish: "",
      note: r.note.trim(),
      dateLabel: "",
    }));
}

/** Inline "Fer 9,5  Juli 9" in each member's accent color. */
export function UserScores({ place, className = "" }: { place: PlaceWithRatings; className?: string }) {
  if (place.ratings.length === 0) return null;
  return (
    <span className={`tabular inline-flex flex-wrap gap-x-2.5 ${className}`}>
      {place.ratings.map((r) => (
        <span key={r.id} style={{ color: accentCssVar(r.userAccent) }}>
          {r.userName} {formatScore(r.score)}
        </span>
      ))}
    </span>
  );
}

/** Native select for the active group, with a "new group" escape hatch. */
export function GroupSelect({ m, className = "" }: { m: HomeModel; className?: string }) {
  return (
    <label className={`relative inline-flex min-w-0 items-center ${className}`}>
      <span className="sr-only">Grupo</span>
      <select
        value={m.activeGroup?.id ?? ""}
        onChange={(e) => {
          if (e.target.value === "__new") {
            m.openSocial("groups");
            return;
          }
          const next = m.groups.find((g) => g.id === e.target.value);
          if (next) m.selectGroup(next);
        }}
        className="font-display max-w-full cursor-pointer appearance-none truncate bg-transparent pr-6 font-bold tracking-tight outline-none"
        style={{ color: "var(--fg)", backgroundColor: "var(--bg)" }}
      >
        {m.groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.isPersonal ? `${g.name} (solo yo)` : `${g.name} (${g.members.length})`}
          </option>
        ))}
        <option value="__new">Nuevo grupo…</option>
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-0 h-4 w-4"
        style={{ color: "var(--fg-muted)" }}
        aria-hidden="true"
      />
    </label>
  );
}

function readTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function writeTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", next === "dark" ? "#0B1511" : "#F4F7F2");
  try {
    localStorage.setItem("puntuando-theme", next);
  } catch {
    // Private mode: theme still applies for this visit.
  }
}

/** Overflow menu: friends, refresh, theme and sign out behind one button. */
export function OverflowMenu({ m, align = "right" }: { m: HomeModel; align?: "left" | "right" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => setTheme(readTheme()), []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function close() {
    if (ref.current) ref.current.open = false;
  }

  const items: { label: string; icon: LucideIcon; onSelect: () => void; badge?: number }[] = [
    {
      label: "Amigos y grupos",
      icon: Users,
      badge: m.pendingReqCount,
      onSelect: () => {
        close();
        m.openSocial("friends");
      },
    },
    {
      label: m.refreshing ? "Actualizando…" : refreshed ? "Actualizado" : "Actualizar",
      icon: refreshed ? Check : RefreshCw,
      onSelect: async () => {
        await m.refresh();
        setRefreshed(true);
        setTimeout(() => setRefreshed(false), 1200);
      },
    },
    {
      label: theme === "dark" ? "Modo claro" : "Modo oscuro",
      icon: theme === "dark" ? Sun : Moon,
      onSelect: () => {
        const next = theme === "dark" ? "light" : "dark";
        writeTheme(next);
        setTheme(next);
      },
    },
    { label: "Salir", icon: LogOut, onSelect: () => void m.logout() },
  ];

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label="Más opciones"
        className="icon-btn pressable relative inline-flex size-10 cursor-pointer list-none items-center justify-center md:size-9 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-5 w-5" />
        {m.pendingReqCount > 0 && (
          <span
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2"
            style={{ backgroundColor: "var(--chip-active-bg)", borderColor: "var(--bg)" }}
            aria-label={`${m.pendingReqCount} solicitudes`}
          />
        )}
      </summary>
      <div
        role="menu"
        className={`zine-modal absolute top-full z-50 mt-2 w-56 overflow-hidden py-1 text-[14px] font-semibold ${align === "right" ? "right-0" : "left-0"}`}
      >
        <div className="truncate px-3 py-2 text-[13px]" style={{ color: "var(--fg-muted)" }}>
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: accentCssVar(m.currentUser.accentColor) }}
          />
          {m.currentUser.name}
        </div>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={item.onSelect}
            className="row-hover flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
          >
            <item.icon className="h-4 w-4" style={{ color: "var(--fg-muted)" }} />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="tabular text-[12px] font-semibold" style={{ color: "var(--chip-active-bg)" }}>
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </details>
  );
}
