"use client";

/**
 * Home for small screens: compact ranking list, sections in a bottom tab bar (thumb reach)
 * and a floating "Sumar" button. Rendered below the md breakpoint; HomeDesktop covers the rest.
 */

import { Dices, Plus, Repeat, Search, X } from "lucide-react";
import { useState } from "react";
import { computeAverage, computeGap, formatScore, isPendingPlace, MEAL_LABELS, MEALS, type ViewMode } from "@/lib/domain";
import {
  GroupSelect,
  OverflowMenu,
  pickLabel,
  sectionItems,
  UserScores,
  visitsLabel,
  type HomeModel,
} from "./home-shared";

export function HomeMobile({ m }: { m: HomeModel }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const sections = sectionItems(m);
  const current = sections.find((s) => s.key === m.section) ?? sections[0]!;
  const isRepeat = m.section === "repeat";

  const modes: { key: ViewMode; label: string; count: number }[] = [
    { key: "ranking", label: "Top", count: m.ratedCount },
    { key: "pending", label: "Pendientes", count: m.pendingCount },
    ...(m.showGapTab ? [{ key: "gap" as const, label: "Polémicos", count: m.gapCount }] : []),
  ];

  return (
    <div className="pb-[calc(150px+env(safe-area-inset-bottom,0px))]">
      <header
        className="sticky top-0 z-30"
        style={{
          backgroundColor: "var(--bg)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex h-16 items-center gap-2 px-4">
          <GroupSelect m={m} className="mr-auto text-[20px]" />
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) m.setQuery("");
            }}
            aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
            aria-pressed={searchOpen}
            className="icon-btn pressable inline-flex size-10 items-center justify-center"
            style={searchOpen ? { backgroundColor: "var(--highlight-bg)", color: "var(--highlight-fg)" } : undefined}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <OverflowMenu m={m} />
        </div>

        {searchOpen && (
          <div className="px-4 pb-3">
            <input
              type="search"
              autoFocus
              value={m.query}
              onChange={(e) => m.setQuery(e.target.value)}
              placeholder="Nombre, dirección, plato…"
              className="zine-input"
            />
          </div>
        )}
      </header>

      <div className="px-4">
        <h1 className="font-display mt-2 mb-3 flex items-baseline gap-2 text-[28px] leading-none font-bold tracking-tight">
          {current.label}
          <span className="tabular text-[17px] font-semibold" style={{ color: "var(--fg-muted)" }}>
            {current.count}
          </span>
        </h1>

        {/* Decision: same lime roulette, one line */}
        <div className="zine-roulette flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            disabled={!m.pickedPlace}
            onClick={() => m.pickedPlace && m.openPlace(m.pickedPlace.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="text-[12px] font-semibold" style={{ color: "var(--highlight-muted)" }}>
              {pickLabel(m.section)}
            </div>
            <div className="font-display truncate text-[18px] leading-snug font-bold">
              {m.pickedPlace?.name ?? (isRepeat ? "Nada marcado todavía" : "No quedan pendientes")}
            </div>
          </button>
          {m.canSpin && (
            <button
              type="button"
              onClick={m.spin}
              className="pressable inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold"
              style={{ backgroundColor: "#0F291E", color: "#FFFFFF" }}
            >
              <Dices className="h-4 w-4" />
              Otro
            </button>
          )}
        </div>

        {/* Filters: one scrollable row */}
        <div className="scroll-x -mx-4 flex items-center gap-1.5 px-4 pt-4 pb-3 text-[12px]">
          {!isRepeat && (
            <>
              {modes.map((mode) => {
                const active = m.mode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => m.setMode(mode.key)}
                    className="pressable tabular shrink-0 rounded-xl border-2 px-3 py-1.5 font-bold whitespace-nowrap"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: active ? "var(--fg)" : "var(--surface)",
                      color: active ? "var(--bg)" : "var(--fg)",
                    }}
                  >
                    {mode.label} ({mode.count})
                  </button>
                );
              })}
              <span className="mx-1 h-5 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--border-soft)" }} />
            </>
          )}
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

        {/* List: one card, compact rows */}
        {m.visiblePlaces.length > 0 ? (
          <ol className="zine-card m-0 list-none overflow-hidden p-0" aria-label="Lugares">
            {m.visiblePlaces.map((place, i) => {
              const pending = isPendingPlace(place);
              const highlighted = (isRepeat || m.mode === "pending") && m.pickedPlace?.id === place.id;
              const score = m.mode === "gap" && !isRepeat ? computeGap(place.ratings) : computeAverage(place.ratings);
              const meta = [
                place.meals.map((x) => MEAL_LABELS[x]).join(", "),
                visitsLabel(place),
                place.address,
              ].filter(Boolean);
              return (
                <li
                  key={place.id}
                  style={{ borderTop: i > 0 ? "1.5px solid var(--border-soft)" : undefined }}
                >
                  <button
                    type="button"
                    onClick={() => m.openPlace(place.id)}
                    className="row-hover grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5 text-left"
                    style={highlighted ? { backgroundColor: "var(--card-pick-bg)" } : undefined}
                  >
                    <span className="font-display tabular pt-0.5 text-[15px] font-bold" style={{ color: "var(--fg-muted)" }}>
                      {pending ? "" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-[17px] leading-snug font-bold">{place.name}</span>
                        {place.repeatMarked && !isRepeat && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold"
                            style={{ backgroundColor: "var(--highlight-bg)", color: "var(--highlight-fg)" }}
                          >
                            <Repeat className="h-3 w-3" />
                            A repetir
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
                        {meta.join(" · ")}
                      </span>
                      {place.repeatMarked && place.nextOrder.trim() && (
                        <span className="mt-1 block text-[12.5px]">
                          <span className="font-bold">Próxima vez: </span>
                          {place.nextOrder}
                        </span>
                      )}
                      <UserScores place={place} className="mt-1 text-[12px] font-bold" />
                    </span>
                    {score !== null ? (
                      <span className="score-badge text-[17px]">
                        {m.mode === "gap" && !isRepeat ? `${formatScore(score)} diff` : formatScore(score)}
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-xl border-2 px-2.5 py-1 text-[12px] font-bold"
                        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
                      >
                        Puntuar
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="zine-card p-6 text-center text-[14px]" style={{ color: "var(--fg-muted)" }}>
            {isRepeat ? "Marcá un lugar como A repetir desde su ficha." : "Nada con este filtro."}
          </div>
        )}
      </div>

      {/* Mobile: floating add + bottom tabs */}
      <button
        type="button"
        onClick={m.openAdd}
        aria-label="Sumar lugar"
        className="fab pressable fixed right-4 z-40 inline-flex size-14 items-center justify-center rounded-2xl"
        style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 px-2 pt-1.5"
        role="tablist"
        aria-label="Apartado"
        style={{
          backgroundColor: "var(--surface)",
          borderTop: "2px solid var(--border)",
          paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {sections.map((s) => {
          const active = s.key === m.section;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => m.setSection(s.key)}
              className="pressable flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold"
              style={{ color: active ? "var(--fg)" : "var(--fg-muted)" }}
            >
              <span
                className="inline-flex h-7 w-12 items-center justify-center rounded-full"
                style={active ? { backgroundColor: "var(--badge-bg)", color: "var(--badge-fg)" } : undefined}
              >
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <span>
                {s.label} <span className="tabular opacity-60">{s.count}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
