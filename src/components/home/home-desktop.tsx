"use client";

/**
 * Home for md+ screens: answers "where do we eat?" first with a big pick and dice,
 * then Top (podium + list), Por probar and Polémicos as sections of one scroll.
 * Rendered from the md breakpoint up; HomeMobile covers small screens.
 */

import { Dices, MapPin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildGoogleMapsUrl,
  computeAverage,
  computeGap,
  filterAndSortPlaces,
  formatScore,
  MEAL_LABELS,
  MEALS,
  type PlaceWithRatings,
} from "@/lib/domain";
import {
  GroupSelect,
  OverflowMenu,
  pickLabel,
  sectionItems,
  UserScores,
  visitsLabel,
  type HomeModel,
} from "./home-shared";

export function HomeDesktop({ m }: { m: HomeModel }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const sections = sectionItems(m);
  const isRepeat = m.section === "repeat";

  const lists = useMemo(() => {
    const base = {
      meal: m.meal,
      query: m.query,
      serviceType: isRepeat ? undefined : m.section === "repeat" ? undefined : m.section,
      onlyRepeat: isRepeat,
    };
    return {
      top: filterAndSortPlaces(m.groupPlaces, { ...base, mode: "ranking" }),
      pending: isRepeat ? [] : filterAndSortPlaces(m.groupPlaces, { ...base, mode: "pending" }),
      gap: isRepeat || !m.showGapTab ? [] : filterAndSortPlaces(m.groupPlaces, { ...base, mode: "gap" }).slice(0, 5),
    };
  }, [m.groupPlaces, m.meal, m.query, m.section, isRepeat, m.showGapTab]);

  const podium = isRepeat ? [] : lists.top.slice(0, 3);
  const rest = isRepeat ? lists.top : lists.top.slice(3);
  const picked = m.pickedPlace;
  const pickedPhoto = picked?.photos[0];

  return (
    <div className="pb-24">
      <header
        className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-8"
        style={{ marginTop: "env(safe-area-inset-top, 0px)" }}
      >
        <GroupSelect m={m} className="mr-auto text-[18px]" />
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) m.setQuery("");
          }}
          aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
          className="icon-btn pressable inline-flex size-9 items-center justify-center"
        >
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
        <OverflowMenu m={m} />
        <button
          type="button"
          onClick={m.openAdd}
          className="pressable ml-1 inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold"
          style={{ backgroundColor: "var(--badge-bg)", color: "var(--badge-fg)" }}
        >
          <Plus className="h-4 w-4" />
          Sumar lugar
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-8">
        {/* Sections as big words */}
        <nav className="scroll-x flex gap-4 pt-2" role="tablist" aria-label="Apartado">
          {sections.map((s) => {
            const active = s.key === m.section;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => m.setSection(s.key)}
                className="font-display shrink-0 rounded-xl px-2 py-1 text-[28px] leading-none font-bold tracking-tight"
                style={{
                  color: active ? "var(--highlight-fg)" : "var(--fg-muted)",
                  backgroundColor: active ? "var(--highlight-bg)" : "transparent",
                }}
              >
                {s.short}
                <sup className="tabular ml-0.5 text-[12px] font-semibold">{s.count}</sup>
              </button>
            );
          })}
        </nav>

        {searchOpen && (
          <input
            type="search"
            autoFocus
            value={m.query}
            onChange={(e) => m.setQuery(e.target.value)}
            placeholder="Nombre, dirección, plato…"
            className="zine-input mt-5"
          />
        )}

        {/* Hero pick */}
        <section className="zine-roulette my-10 grid grid-cols-[minmax(0,1fr)_340px] items-end gap-6 p-8">
          <div className="min-w-0">
            <div className="text-[14px] font-bold" style={{ color: "var(--highlight-muted)" }}>
              {pickLabel(m.section)}
            </div>
            {picked ? (
              <>
                <button
                  type="button"
                  onClick={() => m.openPlace(picked.id)}
                  className="font-display mt-2 block text-left text-[64px] leading-[0.95] font-bold tracking-tight break-words"
                >
                  {picked.name}
                </button>
                <div className="mt-3 text-[15px] font-semibold" style={{ color: "var(--highlight-muted)" }}>
                  {isRepeat && picked.nextOrder
                    ? `Próxima vez: ${picked.nextOrder}`
                    : [picked.meals.map((x) => MEAL_LABELS[x]).join(" o "), picked.address].filter(Boolean).join(" · ")}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {m.canSpin && (
                    <button
                      type="button"
                      onClick={m.spin}
                      className="pressable inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-bold"
                      style={{ backgroundColor: "#0F291E", color: "#FFFFFF" }}
                    >
                      <Dices className="h-5 w-5" />
                      Otro al azar
                    </button>
                  )}
                  <a
                    href={buildGoogleMapsUrl(picked)}
                    target="_blank"
                    rel="noreferrer"
                    className="pressable inline-flex h-11 items-center gap-2 rounded-xl border-2 px-4 text-[14px] font-bold"
                    style={{ borderColor: "#0F291E", color: "#0F291E" }}
                  >
                    <MapPin className="h-4 w-4" />
                    Cómo llegar
                  </a>
                </div>
              </>
            ) : (
              <p className="font-display mt-2 text-[48px] leading-tight font-bold">
                {isRepeat ? "Nada marcado para repetir" : "No quedan pendientes"}
              </p>
            )}
          </div>
          {pickedPhoto && picked && (
            <button
              type="button"
              onClick={() => m.openLightbox(picked.photos, 0, picked.name)}
              className="aspect-[4/3] overflow-hidden rounded-2xl border-2"
              style={{ borderColor: "var(--border)" }}
              aria-label={`Ver fotos de ${picked.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pickedPhoto.url} alt="" className="h-full w-full object-cover" />
            </button>
          )}
        </section>

        {/* Meal filter */}
        <div className="scroll-x flex gap-1.5 pb-6 text-[12.5px]">
          {(["all", ...MEALS] as const).map((meal) => {
            const active = m.meal === meal;
            return (
              <button
                key={meal}
                type="button"
                aria-pressed={active}
                onClick={() => m.setMeal(meal)}
                className="pressable shrink-0 rounded-full px-3 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: active ? "var(--chip-active-bg)" : "var(--pill-bg)",
                  color: active ? "var(--chip-active-fg)" : "var(--pill-fg)",
                }}
              >
                {meal === "all" ? "Todo" : MEAL_LABELS[meal]}
              </button>
            );
          })}
        </div>

        {podium.length > 0 && (
          <Block title="Top" count={lists.top.length}>
            <ol className="m-0 grid list-none grid-cols-3 items-start gap-4 p-0">
              {podium.map((place, i) => (
                <PodiumItem key={place.id} place={place} rank={i + 1} m={m} />
              ))}
            </ol>
          </Block>
        )}

        {rest.length > 0 && (
          <Block title={isRepeat ? "A repetir" : podium.length ? "" : "Top"} count={isRepeat ? rest.length : undefined}>
            <ol className="zine-card m-0 grid list-none overflow-hidden p-0 grid-cols-2" start={podium.length + 1}>
              {rest.map((place, i) => (
                <CompactRow
                  key={place.id}
                  place={place}
                  rank={isRepeat ? null : podium.length + i + 1}
                  m={m}
                  note={isRepeat && place.nextOrder ? `Próxima vez: ${place.nextOrder}` : undefined}
                />
              ))}
            </ol>
          </Block>
        )}

        {lists.pending.length > 0 && (
          <Block title="Por probar" count={lists.pending.length}>
            <div className="scroll-x grid grid-cols-4 gap-3 pt-0.5 pb-2">
              {lists.pending.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => m.openPlace(place.id)}
                  className="zine-card zine-card-interactive pressable flex flex-col items-start p-3.5 text-left"
                  style={place.id === picked?.id ? { backgroundColor: "var(--card-pick-bg)" } : undefined}
                >
                  <span className="font-display line-clamp-2 text-[16px] leading-snug font-bold">{place.name}</span>
                  <span className="mt-1 text-[12px]" style={{ color: "var(--fg-muted)" }}>{place.meals.map((x) => MEAL_LABELS[x]).join(", ")}</span>
                </button>
              ))}
            </div>
          </Block>
        )}

        {lists.gap.length > 0 && (
          <Block title="Polémicos" count={m.gapCount}>
            <ul className="zine-card m-0 grid list-none overflow-hidden p-0 grid-cols-2">
              {lists.gap.map((place) => (
                <li key={place.id} style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
                  <button
                    type="button"
                    onClick={() => m.openPlace(place.id)}
                    className="row-hover flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-display block truncate text-[16px] font-bold">{place.name}</span>
                      <UserScores place={place} className="text-[12.5px] font-bold" />
                    </span>
                    <span className="score-badge text-[14px]">{formatScore(computeGap(place.ratings))} diff</span>
                  </button>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {lists.top.length + lists.pending.length === 0 && (
          <p className="py-10 text-[15px]" style={{ color: "var(--fg-muted)" }}>
            Nada con este filtro.
          </p>
        )}
      </main>

    </div>
  );
}

function Block({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="pb-10">
      {title && (
        <h2 className="font-display mb-4 flex items-baseline gap-2 text-[20px] font-bold tracking-tight">
          {title}
          {count !== undefined && (
            <span className="tabular text-[14px] font-bold" style={{ color: "var(--fg-muted)" }}>
              ({count})
            </span>
          )}
        </h2>
      )}
      {children}
    </section>
  );
}

function PodiumItem({ place, rank, m }: { place: PlaceWithRatings; rank: number; m: HomeModel }) {
  const photo = place.photos[0];
  const meta = [place.meals.map((x) => MEAL_LABELS[x]).join(", "), visitsLabel(place)].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={() => m.openPlace(place.id)}
        className="zine-card zine-card-interactive pressable block w-full overflow-hidden p-4 text-left"
        style={rank === 1 ? { boxShadow: "4px 4px 0 var(--shadow-ink)" } : undefined}
      >
        {photo && (
          <span className="-mx-4 -mt-4 mb-3 block aspect-[4/3] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </span>
        )}
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span
              className="font-display tabular mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold"
              style={{ backgroundColor: rank === 1 ? "var(--highlight-bg)" : "var(--pill-bg)", color: rank === 1 ? "var(--highlight-fg)" : "var(--pill-fg)" }}
            >
              #{rank}
            </span>
            <span className="font-display block truncate text-[20px] leading-tight font-bold">{place.name}</span>
            <span className="block truncate text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
              {meta}
            </span>
          </span>
          <span className="score-badge shrink-0 text-[26px]">{formatScore(computeAverage(place.ratings))}</span>
        </span>
        <UserScores place={place} className="mt-2 text-[12.5px] font-bold" />
      </button>
    </li>
  );
}

function CompactRow({
  place,
  rank,
  m,
  note,
}: {
  place: PlaceWithRatings;
  rank: number | null;
  m: HomeModel;
  note?: string;
}) {
  const avg = computeAverage(place.ratings);
  return (
    <li style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
      <button type="button" onClick={() => m.openPlace(place.id)} className="row-hover flex w-full items-center gap-3 px-4 py-3 text-left">
        {rank !== null && (
          <span className="font-display tabular w-5 shrink-0 text-[14px] font-bold" style={{ color: "var(--fg-muted)" }}>
            {rank}
          </span>
        )}
        {place.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.photos[0].url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-display block truncate text-[16px] font-bold">{place.name}</span>
          <span className="block truncate text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            {note ?? place.meals.map((x) => MEAL_LABELS[x]).join(", ")}
          </span>
        </span>
        <span className="score-badge text-[15px]">{avg !== null ? formatScore(avg) : "-"}</span>
      </button>
    </li>
  );
}
