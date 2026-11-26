"use client";

import { Trash2 } from "lucide-react";
import { CategoryScorePicker } from "@/components/category-score-picker";
import type { ServiceType } from "@/db/schema";
import { computeBreakdownAverage, formatScore, type ScoreBreakdown } from "@/lib/domain";

interface VisitEntryEditorProps {
  visitId: string;
  /** Name of the member whose entry is being edited. */
  title: string;
  dishLabel: string;
  dishPlaceholder: string;
  color: string;
  serviceType: ServiceType;
  legacyHint: number | null;
  dish: string;
  onDishChange: (dish: string) => void;
  scores: ScoreBreakdown;
  onScoresChange: (scores: ScoreBreakdown) => void;
  note: string;
  onNoteChange: (note: string) => void;
  canDelete: boolean;
  busy: boolean;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Inline editor for one member's entry on a visit (PlaceSheet).
 * The action bar sticks to the bottom of the sheet so Save stays reachable while scrolling.
 */
export function VisitEntryEditor({
  visitId,
  title,
  dishLabel,
  dishPlaceholder,
  color,
  serviceType,
  legacyHint,
  dish,
  onDishChange,
  scores,
  onScoresChange,
  note,
  onNoteChange,
  canDelete,
  busy,
  onDelete,
  onCancel,
  onSave,
}: VisitEntryEditorProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border-2 p-4"
      style={{ borderColor: color, backgroundColor: "var(--surface)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold" style={{ color }}>
          {title}
        </span>
        <span className="flex items-center gap-2">
          {legacyHint !== null && (
            <span className="tabular text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              Antes {formatScore(legacyHint)}
            </span>
          )}
          <span className="score-badge text-[20px]">{formatScore(computeBreakdownAverage(scores))}</span>
        </span>
      </div>

      <CategoryScorePicker
        scores={scores}
        color={color}
        serviceType={serviceType}
        showAverage={false}
        onChange={onScoresChange}
      />

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-bold" style={{ color: "var(--fg-muted)" }}>
          {dishLabel}
        </span>
        <input
          id={`dish-${visitId}`}
          type="text"
          placeholder={dishPlaceholder}
          value={dish}
          onChange={(e) => onDishChange(e.target.value)}
          className="zine-input"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-bold" style={{ color: "var(--fg-muted)" }}>
          Comentario
        </span>
        <textarea
          rows={2}
          placeholder="Opcional…"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          className="zine-input"
        />
      </label>

      <div
        className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-center gap-2 rounded-b-2xl px-4 py-3"
        style={{ backgroundColor: "var(--surface)", borderTop: "1.5px solid var(--border-soft)" }}
      >
        {canDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label="Quitar puntaje"
            title="Quitar"
            className="pressable inline-flex size-11 shrink-0 items-center justify-center rounded-xl border-2"
            style={{ borderColor: "var(--border-soft)", color: "var(--danger)" }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="pressable h-11 rounded-xl px-4 text-[14px] font-bold"
          style={{ color: "var(--fg-muted)" }}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="pressable h-11 flex-1 rounded-xl text-[15px] font-bold disabled:opacity-60"
          style={{ backgroundColor: "var(--badge-bg)", color: "var(--badge-fg)" }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
