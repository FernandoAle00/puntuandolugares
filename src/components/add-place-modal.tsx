"use client";

import { IceCreamCone, Minus, Plus, ShoppingBag, Utensils, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { MealType, ServiceType } from "@/db/schema";
import {
  getTodayIsoDate,
  MEAL_LABELS,
  MEALS,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type PlaceWithRatings,
} from "@/lib/domain";

interface AddPlaceModalProps {
  open: boolean;
  groupId: string | null;
  groupName: string;
  defaultServiceType: ServiceType;
  onClose: () => void;
  onCreated: (place: PlaceWithRatings) => void;
}

export function AddPlaceModal({
  open,
  groupId,
  groupName,
  defaultServiceType,
  onClose,
  onCreated,
}: AddPlaceModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>(defaultServiceType);
  const [meals, setMeals] = useState<MealType[]>(["cena"]);
  const [rateNow, setRateNow] = useState(false);
  const [dish, setDish] = useState("");
  const [visitedAt, setVisitedAt] = useState(() => getTodayIsoDate());
  const [score, setScore] = useState(8);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setServiceType(defaultServiceType);
      setMeals(defaultServiceType === "ice_cream" ? ["postre"] : ["cena"]);
      setVisitedAt(getTodayIsoDate());
    }
  }, [open, defaultServiceType]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !groupId) return null;

  function handleServiceTypeChange(next: ServiceType) {
    setServiceType(next);
    if (next === "ice_cream" && meals.length === 1 && meals[0] === "cena") {
      setMeals(["postre"]);
    } else if (next !== "ice_cream" && meals.length === 1 && meals[0] === "postre") {
      setMeals(["cena"]);
    }
  }

  function toggleMeal(m: MealType) {
    setMeals((prev) => {
      if (prev.includes(m)) {
        return prev.length > 1 ? prev.filter((x) => x !== m) : prev;
      }
      return [...prev, m];
    });
  }

  function stepScore(delta: number) {
    setScore((prev) => Math.min(10, Math.max(1, Math.round((prev + delta) * 10) / 10)));
  }

  function handleScoreInput(raw: string) {
    const normalized = raw.replace(",", ".");
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed)) {
      setScore(Math.min(10, Math.max(1, Math.round(parsed * 10) / 10)));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          name,
          address,
          serviceType,
          meals,
          ...(rateNow ? { initialRating: { dish, score, note, visitedAt } } : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo guardar el lugar");
        setSaving(false);
        return;
      }

      onCreated(data.place);
      setName("");
      setAddress("");
      setServiceType(defaultServiceType);
      setMeals(defaultServiceType === "ice_cream" ? ["postre"] : ["cena"]);
      setRateNow(false);
      setDish("");
      setVisitedAt(getTodayIsoDate());
      setScore(8);
      setNote("");
      setSaving(false);
      onClose();
    } catch {
      setError("Error de conexión al guardar");
      setSaving(false);
    }
  }

  const namePlaceholder =
    serviceType === "ice_cream"
      ? "Ej. Heladería Italia, Rapanui..."
      : serviceType === "delivery"
        ? "Ej. Kuro Sushi, Empanadas del Sur..."
        : "Ej. Troppo Napoletano";

  const dishPlaceholder =
    serviceType === "ice_cream"
      ? "Ej. Dulce de leche granizado, pistacho..."
      : "Ej. Milanesa napolitana, tabla 1...";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "var(--backdrop)",
        paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Sumar un lugar"
        className="zine-sheet max-h-[85dvh] w-full max-w-[480px] overflow-y-auto px-5 py-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display m-0 text-[22px] font-bold">Sumar lugar</h2>
            <div className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              En {groupName}
            </div>
          </div>
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

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              Apartado
            </span>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Tipo de lugar">
              {SERVICE_TYPES.map((type) => {
                const active = serviceType === type;
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
                    aria-pressed={active}
                    onClick={() => handleServiceTypeChange(type)}
                    className="pressable inline-flex items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-[12px] font-bold whitespace-nowrap"
                    style={{
                      borderColor: active ? "var(--border)" : "var(--border-soft)",
                      backgroundColor: active ? "var(--highlight-bg)" : "var(--surface)",
                      color: active ? "var(--highlight-fg)" : "var(--fg)",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{SERVICE_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-place-name"
              className="text-[12px] font-semibold"
              style={{ color: "var(--fg-muted)" }}
            >
              Nombre
            </label>
            <input
              id="new-place-name"
              type="text"
              required
              autoFocus
              placeholder={namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="zine-input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-place-address"
              className="text-[12px] font-semibold"
              style={{ color: "var(--fg-muted)" }}
            >
              Dirección (opcional)
            </label>
            <input
              id="new-place-address"
              type="text"
              placeholder={
                serviceType === "delivery"
                  ? "Dirección, barrio o app (opcional)"
                  : "Calle y altura o zona"
              }
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="zine-input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              Momentos
            </span>
            <div className="flex flex-wrap gap-2">
              {MEALS.map((m) => {
                const active = meals.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleMeal(m)}
                    className="pressable rounded-full border-2 px-3 py-1.5 text-[13px] font-bold"
                    style={{
                      borderColor: active ? "var(--border)" : "var(--border-soft)",
                      backgroundColor: active ? "var(--highlight-bg)" : "var(--surface)",
                      color: active ? "var(--highlight-fg)" : "var(--fg)",
                    }}
                  >
                    {MEAL_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRateNow((v) => !v)}
            aria-pressed={rateNow}
            className="pressable flex items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-left text-[13px] font-bold"
            style={{
              borderColor: rateNow ? "var(--border)" : "var(--border-soft)",
              backgroundColor: rateNow ? "var(--surface-soft)" : "var(--bg)",
            }}
          >
            <span>
              {serviceType === "delivery"
                ? "Ya pedimos, cargar primera vez ahora"
                : "Ya fuimos, cargar primera visita ahora"}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: rateNow ? "var(--fg)" : "var(--pill-bg)",
                color: rateNow ? "var(--bg)" : "var(--fg-muted)",
              }}
            >
              {rateNow ? "Sí" : "Pendiente"}
            </span>
          </button>

          {rateNow && (
            <div
              className="flex flex-col gap-3 rounded-2xl border-2 p-3.5"
              style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg)" }}
            >
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="new-place-dish"
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Qué comiste
                </label>
                <input
                  id="new-place-dish"
                  type="text"
                  placeholder={dishPlaceholder}
                  value={dish}
                  onChange={(e) => setDish(e.target.value)}
                  className="zine-input"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="new-place-date"
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Fecha (opcional)
                </label>
                <input
                  id="new-place-date"
                  type="date"
                  value={visitedAt}
                  onChange={(e) => setVisitedAt(e.target.value)}
                  className="zine-input"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">Tu puntaje (1 a 10)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepScore(-0.1)}
                    aria-label="Restar 0,1"
                    className="pressable inline-flex h-8 w-8 items-center justify-center rounded-lg border-2"
                    style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--surface)" }}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.1}
                    inputMode="decimal"
                    aria-label="Puntaje numérico"
                    value={score}
                    onChange={(e) => handleScoreInput(e.target.value)}
                    className="font-display tabular w-16 rounded-lg border-2 py-1 text-center text-[18px] font-bold"
                    style={{
                      borderColor: "var(--border-soft)",
                      backgroundColor: "var(--surface)",
                      color: "var(--fg)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => stepScore(0.1)}
                    aria-label="Sumar 0,1"
                    className="pressable inline-flex h-8 w-8 items-center justify-center rounded-lg border-2"
                    style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--surface)" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.1}
                value={score}
                onChange={(e) => handleScoreInput(e.target.value)}
                className="w-full cursor-pointer"
                style={{ accentColor: "var(--accent-teal)" }}
              />

              <textarea
                rows={2}
                placeholder="Qué te pareció (opcional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="zine-input"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="m-0 rounded-xl px-3 py-2 text-[13px] font-semibold"
              style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="pressable mt-1 w-full rounded-xl px-4 py-3 text-[14px] font-bold disabled:opacity-60"
            style={{
              backgroundColor: "var(--fg)",
              color: "var(--bg)",
            }}
          >
            {saving ? "Guardando..." : "Guardar lugar"}
          </button>
        </div>
      </form>
    </div>
  );
}
