"use client";

import { Minus, Plus } from "lucide-react";
import {
  computeBreakdownAverage,
  formatScore,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_LABELS,
  type ScoreBreakdown,
  type ScoreCategory,
} from "@/lib/domain";

interface CategoryScorePickerProps {
  scores: ScoreBreakdown;
  color: string;
  legacyHint?: number | null;
  onChange: (next: ScoreBreakdown) => void;
}

function clampScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value * 10) / 10));
}

/**
 * Compact 4-category rating picker (Atención, Comida, Lugar, Precio) with live computed average.
 */
export function CategoryScorePicker({
  scores,
  color,
  legacyHint,
  onChange,
}: CategoryScorePickerProps) {
  const average = computeBreakdownAverage(scores);

  function setCategory(category: ScoreCategory, value: number) {
    onChange({ ...scores, [category]: clampScore(value) });
  }

  function handleNumericInput(category: ScoreCategory, raw: string) {
    const parsed = parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(parsed)) {
      setCategory(category, parsed);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color }}>
            Puntaje promedio
          </span>
          {legacyHint !== null && legacyHint !== undefined && (
            <span
              className="tabular rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: "var(--pill-bg)", color: "var(--fg-muted)" }}
            >
              Antes: {formatScore(legacyHint)}
            </span>
          )}
        </div>
        <span className="font-display tabular text-[19px] font-bold" style={{ color }}>
          {formatScore(average)} / 10
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {SCORE_CATEGORIES.map((category) => {
          const val = scores[category];
          const label = SCORE_CATEGORY_LABELS[category];
          return (
            <div
              key={category}
              className="flex flex-col gap-1.5 rounded-xl border px-3 py-2"
              style={{
                borderColor: "var(--border-soft)",
                backgroundColor: "var(--surface)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold">{label}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCategory(category, val - 0.1)}
                    aria-label={`Restar 0,1 en ${label}`}
                    className="pressable inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: "var(--border-soft)",
                      backgroundColor: "var(--bg)",
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.1}
                    inputMode="decimal"
                    aria-label={`Puntaje de ${label}`}
                    value={val}
                    onChange={(e) => handleNumericInput(category, e.target.value)}
                    className="font-display tabular w-14 rounded-lg border py-0.5 text-center text-[15px] font-bold"
                    style={{
                      borderColor: color,
                      backgroundColor: "var(--bg)",
                      color,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setCategory(category, val + 0.1)}
                    aria-label={`Sumar 0,1 en ${label}`}
                    className="pressable inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: "var(--border-soft)",
                      backgroundColor: "var(--bg)",
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={10}
                step={0.1}
                value={val}
                onChange={(e) => handleNumericInput(category, e.target.value)}
                aria-label={`Deslizador de ${label}`}
                className="w-full cursor-pointer"
                style={{ accentColor: color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact 4-column breakdown strip displaying Atención, Comida, Lugar, and Precio.
 */
export function ScoreBreakdownGrid({
  scores,
  compact = false,
}: {
  scores: ScoreBreakdown;
  compact?: boolean;
}) {
  return (
    <div className="tabular grid grid-cols-4 gap-1.5">
      {SCORE_CATEGORIES.map((category) => (
        <div
          key={category}
          className={`flex flex-col rounded-lg px-2 ${compact ? "py-1" : "py-1.5"}`}
          style={{ backgroundColor: "var(--surface-soft)" }}
        >
          <span
            className="truncate text-[10.5px] leading-tight font-semibold"
            style={{ color: "var(--fg-muted)" }}
          >
            {SCORE_CATEGORY_LABELS[category]}
          </span>
          <span className="font-display text-[13px] leading-tight font-bold">
            {formatScore(scores[category])}
          </span>
        </div>
      ))}
    </div>
  );
}
