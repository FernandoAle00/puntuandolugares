"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { ServiceType } from "@/db/schema";
import {
  computeBreakdownAverage,
  formatScore,
  getScoreCategories,
  getScoreCategoryLabel,
  type ScoreBreakdown,
  type ScoreCategory,
} from "@/lib/domain";

interface CategoryScorePickerProps {
  scores: ScoreBreakdown;
  color: string;
  serviceType?: ServiceType;
  legacyHint?: number | null;
  /** Hide the "Puntaje" header when the caller already shows the average. */
  showAverage?: boolean;
  onChange: (next: ScoreBreakdown) => void;
}

const QUICK_SCORES = [6, 7, 8, 9, 10] as const;

function clampScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value * 10) / 10));
}

/**
 * Tap-based 4-category rating picker: choose a category, tap a whole number (6 to 10),
 * then fine-tune by 0,1. Avoids sliders, which fight with scrolling inside sheets on mobile.
 * Labels adapt for delivery vs dine-in.
 */
export function CategoryScorePicker({
  scores,
  color,
  serviceType = "dine_in",
  legacyHint,
  showAverage = true,
  onChange,
}: CategoryScorePickerProps) {
  const categories = getScoreCategories(serviceType);
  const [active, setActive] = useState<ScoreCategory>(categories[0]!);
  const value = scores[active];
  const hint =
    serviceType === "delivery" && active === "place" ? "Temperatura, armado y packaging" : undefined;

  function set(next: number) {
    onChange({ ...scores, [active]: clampScore(next) });
  }

  return (
    <div className="flex flex-col gap-3">
      {showAverage && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold" style={{ color }}>
            Puntaje
          </span>
          <span className="flex items-center gap-2">
            {legacyHint !== null && legacyHint !== undefined && (
              <span className="tabular text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                Antes {formatScore(legacyHint)}
              </span>
            )}
            <span className="score-badge text-[18px]">
              {formatScore(computeBreakdownAverage(scores))}
            </span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Categoría">
        {categories.map((category) => {
          const on = category === active;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(category)}
              className="pressable flex min-w-0 flex-col items-center rounded-xl border-2 px-1 py-2"
              style={{
                borderColor: on ? color : "var(--border-soft)",
                backgroundColor: on ? "var(--bg)" : "transparent",
              }}
            >
              <span
                className="w-full truncate text-center text-[11px] font-bold"
                style={{ color: "var(--fg-muted)" }}
              >
                {getScoreCategoryLabel(category, serviceType, { compact: true })}
              </span>
              <span
                className="font-display tabular text-[18px] font-bold"
                style={{ color: on ? color : "var(--fg)" }}
              >
                {formatScore(scores[category])}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-xl p-3" style={{ backgroundColor: "var(--bg)" }}>
        <span className="text-[13px] font-bold">
          {getScoreCategoryLabel(active, serviceType)}
          {hint && (
            <span className="ml-1.5 font-semibold" style={{ color: "var(--fg-muted)" }}>
              {hint}
            </span>
          )}
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_SCORES.map((n) => {
            const on = Math.floor(value) === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => set(n)}
                aria-pressed={on}
                className="pressable font-display tabular h-11 rounded-xl border-2 text-[17px] font-bold"
                style={{
                  borderColor: on ? "var(--border)" : "var(--border-soft)",
                  backgroundColor: on ? "var(--badge-bg)" : "var(--surface)",
                  color: on ? "var(--badge-fg)" : "var(--fg)",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => set(value >= 6 ? 5 : Math.floor(value) - 1)}
            className="pressable rounded-lg px-2 py-1 text-[12px] font-bold"
            style={{ color: "var(--fg-muted)" }}
          >
            Menos de 6
          </button>
          <div className="flex items-center gap-2">
            <StepButton label={`Restar 0,1 en ${getScoreCategoryLabel(active, serviceType)}`} onClick={() => set(value - 0.1)}>
              <Minus className="h-3.5 w-3.5" />
            </StepButton>
            <span
              className="font-display tabular w-12 text-center text-[24px] font-bold"
              style={{ color }}
              aria-live="polite"
            >
              {formatScore(value)}
            </span>
            <StepButton label={`Sumar 0,1 en ${getScoreCategoryLabel(active, serviceType)}`} onClick={() => set(value + 0.1)}>
              <Plus className="h-3.5 w-3.5" />
            </StepButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pressable inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--surface)" }}
    >
      {children}
    </button>
  );
}

/**
 * Compact 4-column breakdown strip adapting labels for delivery vs dine-in places.
 */
export function ScoreBreakdownGrid({
  scores,
  serviceType = "dine_in",
  compact = false,
}: {
  scores: ScoreBreakdown;
  serviceType?: ServiceType;
  compact?: boolean;
}) {
  const categories = getScoreCategories(serviceType);
  return (
    <div className="tabular grid grid-cols-4 gap-1.5">
      {categories.map((category) => (
        <div
          key={category}
          className={`flex flex-col rounded-lg px-2 ${compact ? "py-1" : "py-1.5"}`}
          style={{ backgroundColor: "var(--surface-soft)" }}
        >
          <span
            className="truncate text-[10.5px] leading-tight font-semibold"
            style={{ color: "var(--fg-muted)" }}
          >
            {getScoreCategoryLabel(category, serviceType, { compact: true })}
          </span>
          <span className="font-display text-[13px] leading-tight font-bold">
            {formatScore(scores[category])}
          </span>
        </div>
      ))}
    </div>
  );
}
