"use client";

import {
  Calendar,
  Camera,
  IceCreamCone,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CategoryScorePicker, ScoreBreakdownGrid } from "@/components/category-score-picker";
import { VisitEntryEditor } from "@/components/visit-entry-editor";
import type { AccentColor, MealType, PhotoKind, ServiceType } from "@/db/schema";
import {
  buildGoogleMapsUrl,
  computeAverage,
  computePlaceBreakdown,
  DEFAULT_SCORE_BREAKDOWN,
  formatScore,
  formatVisitDate,
  getTodayIsoDate,
  MEAL_LABELS,
  MEALS,
  SERVICE_FULL_LABELS,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type GroupMemberSummary,
  type PlacePhotoEntry,
  type PlaceVisit,
  type PlaceWithRatings,
  type ScoreBreakdown,
  type VisitEntryItem,
} from "@/lib/domain";

const NEXT_ORDER_PHOTO_KEY = "__next_order__";

export function accentCssVar(accent: AccentColor): string {
  switch (accent) {
    case "orange":
      return "var(--accent-orange)";
    case "cobalt":
      return "var(--accent-cobalt)";
    case "berry":
      return "var(--accent-berry)";
    default:
      return "var(--accent-teal)";
  }
}

interface PlaceSheetProps {
  place: PlaceWithRatings | null;
  currentUserId: string;
  currentUserName: string;
  currentUserAccent: AccentColor;
  groupMembers: readonly GroupMemberSummary[];
  onClose: () => void;
  onUpdated: (place: PlaceWithRatings) => void;
  onDeleted: (placeId: string) => void;
}

export function PlaceSheet({
  place,
  currentUserId,
  currentUserName,
  currentUserAccent,
  groupMembers,
  onClose,
  onUpdated,
  onDeleted,
}: PlaceSheetProps) {

  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(place?.name ?? "");
  const [address, setAddress] = useState(place?.address ?? "");
  const [serviceType, setServiceType] = useState<ServiceType>(place?.serviceType ?? "dine_in");
  const [meals, setMeals] = useState<MealType[]>(place?.meals ?? ["cena"]);
  const [nextOrder, setNextOrder] = useState(place?.nextOrder ?? "");
  const [nextOrderSaved, setNextOrderSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // New visit composer state
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [newVisitDate, setNewVisitDate] = useState(() => getTodayIsoDate());
  const [newVisitDish, setNewVisitDish] = useState("");
  const [newVisitScores, setNewVisitScores] = useState<ScoreBreakdown>({
    ...DEFAULT_SCORE_BREAKDOWN,
  });
  const [newVisitNote, setNewVisitNote] = useState("");

  // Per-visit entry editor state (supports editing any member of the group)
  const [editingTarget, setEditingTarget] = useState<{
    visitId: string;
    userId: string;
    userName: string;
    userAccent: AccentColor;
  } | null>(null);
  const [entryDish, setEntryDish] = useState("");
  const [entryScores, setEntryScores] = useState<ScoreBreakdown>({
    ...DEFAULT_SCORE_BREAKDOWN,
  });
  const [entryLegacyHint, setEntryLegacyHint] = useState<number | null>(null);
  const [entryNote, setEntryNote] = useState("");

  // Per-visit date editor & delete confirmation
  const [editingDateVisitId, setEditingDateVisitId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");
  const [confirmDeleteVisitId, setConfirmDeleteVisitId] = useState<string | null>(null);

  // Photo upload per visit and for next-order reference photos
  const [photoCaptions, setPhotoCaptions] = useState<Record<string, string>>({});
  const [uploadingPhotoKey, setUploadingPhotoKey] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PlacePhotoEntry | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const uploadingPhotoRef = useRef(false);

  useEffect(() => {
    if (!place) return;
    setName(place.name);
    setAddress(place.address);
    setServiceType(place.serviceType);
    setMeals(place.meals);
    setNextOrder(place.nextOrder);
    setNextOrderSaved(false);
    setEditingMeta(false);
    setConfirmDelete(false);
    setNewVisitOpen(place.visits.length === 0);
    setNewVisitDate(getTodayIsoDate());
    setNewVisitDish("");
    setNewVisitScores({ ...DEFAULT_SCORE_BREAKDOWN });
    setNewVisitNote("");
    setEditingTarget(null);
    setEntryLegacyHint(null);
    setEditingDateVisitId(null);
    setConfirmDeleteVisitId(null);
    setPhotoCaptions({});
    setLightboxPhoto(null);
    setError(null);
  }, [place?.id]);

  useEffect(() => {
    if (!place) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightboxPhoto) setLightboxPhoto(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [place, lightboxPhoto, onClose]);

  if (!place) return null;

  const avg = computeAverage(place.ratings);
  const myColor = accentCssVar(currentUserAccent);
  const isDelivery = place.serviceType === "delivery";
  const visitNoun = isDelivery ? "pedido" : "visita";
  const visitNounPlural = isDelivery ? "pedidos" : "visitas";
  const visitLabelCap = isDelivery ? "Pedido" : "Visita";
  const dishPlaceholder =
    place.serviceType === "ice_cream"
      ? "Ej. Dulce de leche granizado, pistacho..."
      : "Ej. Milanesa napolitana, tabla 1...";
  const nextOrderPhotos = place.photos.filter((p) => p.kind === "next_order");
  const unlinkedPhotos = place.photos.filter((p) => !p.visitId && p.kind !== "next_order");
  const pastDishes = Array.from(
    new Set(
      place.visits
        .flatMap((v) => v.entries.map((e) => e.dish.trim()))
        .filter((d) => d.length > 0),
    ),
  );

  function handleSelectPastDish(dish: string) {
    setNextOrderSaved(false);
    setNextOrder((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return dish;
      if (trimmed.toLowerCase() === dish.toLowerCase()) return "";
      const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      const existsIdx = parts.findIndex((p) => p.toLowerCase() === dish.toLowerCase());
      if (existsIdx >= 0) {
        parts.splice(existsIdx, 1);
        return parts.join(", ");
      }
      return [...parts, dish].join(", ");
    });
  }

  async function handleToggleRepeat() {
    if (!place) return;
    setBusy(true);
    setError(null);
    setNextOrderSaved(false);
    try {
      const nextMarked = !place.repeatMarked;
      const res = await fetch(`/api/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repeatMarked: nextMarked }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo actualizar A repetir");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setNextOrder(data.place.nextOrder);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handleSaveNextOrder() {
    if (!place) return;
    setBusy(true);
    setError(null);
    setNextOrderSaved(false);
    try {
      const res = await fetch(`/api/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repeatMarked: true, nextOrder }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo guardar qué pedir la próxima");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setNextOrder(data.place.nextOrder);
      setNextOrderSaved(true);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
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

  function startEditingEntry(
    visit: PlaceVisit,
    target: { userId: string; userName: string; userAccent: AccentColor },
  ) {
    const existing = visit.entries.find((e) => e.userId === target.userId);
    setEditingTarget({
      visitId: visit.id,
      userId: target.userId,
      userName: target.userName,
      userAccent: target.userAccent,
    });
    setEntryDish(existing?.dish ?? "");
    setEntryScores(
      existing?.scores ? { ...existing.scores } : { ...DEFAULT_SCORE_BREAKDOWN },
    );
    setEntryLegacyHint(existing && !existing.scores ? existing.legacyScore : null);
    setEntryNote(existing?.note ?? "");
    setError(null);
  }

  async function handleCreateVisit() {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitedAt: newVisitDate,
          dish: newVisitDish,
          scores: newVisitScores,
          note: newVisitNote,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo guardar la visita");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setNewVisitOpen(false);
      setNewVisitDate(getTodayIsoDate());
      setNewVisitDish("");
      setNewVisitScores({ ...DEFAULT_SCORE_BREAKDOWN });
      setNewVisitNote("");
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handleSaveEntry() {
    if (!place || !editingTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}/visits/${editingTarget.visitId}/entry`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingTarget.userId,
          dish: entryDish,
          scores: entryScores,
          note: entryNote,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo guardar la comida");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setEditingTarget(null);
      setEntryLegacyHint(null);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handleDeleteEntry() {
    if (!place || !editingTarget) return;
    setBusy(true);
    setError(null);
    try {
      const url = `/api/places/${place.id}/visits/${editingTarget.visitId}/entry?userId=${encodeURIComponent(editingTarget.userId)}`;
      const res = await fetch(url, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo quitar el puntaje");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setEditingTarget(null);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handleSaveVisitDate(visitId: string) {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}/visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitedAt: editDateValue }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo actualizar la fecha");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setEditingDateVisitId(null);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handleDeleteVisit(visitId: string) {
    if (!place) return;
    if (confirmDeleteVisitId !== visitId) {
      setConfirmDeleteVisitId(visitId);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}/visits/${visitId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo eliminar la visita");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setConfirmDeleteVisitId(null);
      if (editingTarget?.visitId === visitId) setEditingTarget(null);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function saveMeta() {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, serviceType, meals }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo actualizar el lugar");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setEditingMeta(false);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handleDeletePlace() {
    if (!place) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/places/${place.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("No se pudo eliminar el lugar");
        setBusy(false);
        return;
      }
      onDeleted(place.id);
      setBusy(false);
      onClose();
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function handlePhotoSelected(
    options: { visitId: string | null; kind: PhotoKind },
    e: ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file || !place || uploadingPhotoRef.current) return;
    const key =
      options.kind === "next_order"
        ? NEXT_ORDER_PHOTO_KEY
        : (options.visitId ?? "__general__");
    uploadingPhotoRef.current = true;
    setUploadingPhotoKey(key);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", options.kind);
      if (options.visitId) {
        fd.append("visitId", options.visitId);
      }
      const caption = (photoCaptions[key] ?? "").trim();
      if (caption) {
        fd.append("caption", caption);
      }

      const res = await fetch(`/api/places/${place.id}/photos`, {
        method: "POST",
        body: fd,
      });

      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo subir la foto");
        return;
      }

      onUpdated(data.place);
      setPhotoCaptions((prev) => ({ ...prev, [key]: "" }));
    } catch {
      setError("Error al subir la foto");
    } finally {
      uploadingPhotoRef.current = false;
      setUploadingPhotoKey(null);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo borrar la foto");
        setBusy(false);
        return;
      }

      onUpdated(data.place);
      if (lightboxPhoto?.id === photoId) setLightboxPhoto(null);
      setBusy(false);
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

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
      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className="zine-sheet max-h-[85dvh] w-full max-w-[520px] overflow-y-auto px-5 py-5"
      >
        {/* Header */}
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display m-0 text-[22px] leading-tight font-bold">
              {place.name}
            </h2>
            <div
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {place.serviceType !== "dine_in" && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: "var(--pill-bg)",
                    color: "var(--pill-fg)",
                  }}
                >
                  {place.serviceType === "delivery" ? (
                    <ShoppingBag className="h-3 w-3" />
                  ) : (
                    <IceCreamCone className="h-3 w-3" />
                  )}
                  {SERVICE_FULL_LABELS[place.serviceType]}
                </span>
              )}
              <span>
                {place.meals.map((m) => MEAL_LABELS[m]).join(" / ")}
                {place.address ? ` en ${place.address}` : ""}
              </span>
              {place.visits.length > 0 && (
                <span className="tabular font-bold" style={{ color: "var(--fg)" }}>
                  {place.visits.length}{" "}
                  {place.visits.length === 1 ? visitNoun : visitNounPlural}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {avg !== null && (
              <span
                className="font-display tabular rounded-xl px-2.5 py-1 text-[18px] font-bold"
                style={{
                  backgroundColor: "var(--badge-bg)",
                  color: "var(--badge-fg)",
                }}
              >
                {formatScore(avg)}
              </span>
            )}
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
        </div>

        {/* Quick action bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <a
            href={buildGoogleMapsUrl(place)}
            target="_blank"
            rel="noreferrer"
            className="pressable inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--highlight-bg)",
              color: "var(--highlight-fg)",
            }}
          >
            <MapPin className="h-3.5 w-3.5" />
            Google Maps
          </a>

          <button
            type="button"
            disabled={busy}
            aria-pressed={place.repeatMarked}
            onClick={handleToggleRepeat}
            className="pressable inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-bold disabled:opacity-60"
            style={{
              borderColor: place.repeatMarked ? "var(--border)" : "var(--border-soft)",
              backgroundColor: place.repeatMarked ? "var(--badge-bg)" : "transparent",
              color: place.repeatMarked ? "var(--badge-fg)" : "var(--fg)",
            }}
          >
            <Repeat className="h-3.5 w-3.5" />
            A repetir
          </button>

          <button
            type="button"
            onClick={() => setEditingMeta((v) => !v)}
            className="pressable inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-bold"
            style={{
              borderColor: editingMeta ? "var(--border)" : "var(--border-soft)",
              backgroundColor: editingMeta ? "var(--surface-soft)" : "transparent",
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editingMeta ? "Cancelar" : "Editar datos"}
          </button>

          {place.visits.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setNewVisitOpen((v) => !v);
                setError(null);
              }}
              className="pressable ml-auto inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
              style={{
                backgroundColor: "var(--fg)",
                color: "var(--bg)",
              }}
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              {newVisitOpen
                ? "Cerrar"
                : isDelivery
                  ? "Nuevo pedido"
                  : "Nueva visita"}
            </button>
          )}
        </div>

        {/* Next-order selector when marked as A repetir */}
        {place.repeatMarked && (
          <section
            className="mb-4 flex flex-col gap-2.5 rounded-2xl border-2 p-3.5"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            aria-label="Qué pedir la próxima vez"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
                <Repeat className="h-3.5 w-3.5" />
                Para pedir la próxima vez
              </span>
              {nextOrderSaved && (
                <span className="text-[11.5px] font-bold" style={{ color: "var(--accent-teal)" }}>
                  Guardado
                </span>
              )}
            </div>

            {pastDishes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pastDishes.map((dish) => {
                  const selected = nextOrder
                    .split(",")
                    .map((s) => s.trim().toLowerCase())
                    .includes(dish.toLowerCase());
                  return (
                    <button
                      key={dish}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectPastDish(dish)}
                      className="pressable rounded-full border-2 px-2.5 py-1 text-[12px] font-bold"
                      style={{
                        borderColor: selected ? "var(--border)" : "var(--border-soft)",
                        backgroundColor: selected ? "var(--highlight-bg)" : "var(--surface)",
                        color: selected ? "var(--highlight-fg)" : "var(--fg)",
                      }}
                    >
                      {dish}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex min-w-0 items-center gap-2">
              <input
                type="text"
                placeholder={
                  place.serviceType === "ice_cream"
                    ? "Ej. Probar pistacho, sambayón..."
                    : "Qué del menú querés pedir la próxima..."
                }
                value={nextOrder}
                onChange={(e) => {
                  setNextOrder(e.target.value);
                  setNextOrderSaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveNextOrder();
                  }
                }}
                className="zine-input min-w-0 flex-1"
              />
              <button
                type="button"
                disabled={busy || nextOrder.trim() === place.nextOrder}
                onClick={handleSaveNextOrder}
                className="pressable shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-bold disabled:opacity-50"
                style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
              >
                Guardar
              </button>
            </div>

            {nextOrderPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {nextOrderPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border-2"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="h-full w-full"
                      aria-label={photo.caption || `Foto para la próxima vez en ${place.name}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || `Foto para la próxima vez en ${place.name}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <span
                          className="absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-left text-[10.5px] leading-tight font-semibold text-white"
                          style={{ backgroundColor: "rgba(0, 0, 0, 0.68)" }}
                        >
                          {photo.caption}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeletePhoto(photo.id)}
                      aria-label="Borrar foto de próxima vez"
                      className="pressable absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(0,0,0,0.68)", color: "#ffffff" }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex min-w-0 items-center gap-2">
              <input
                type="text"
                placeholder="Plato de la foto (opcional)"
                value={photoCaptions[NEXT_ORDER_PHOTO_KEY] ?? ""}
                onChange={(e) =>
                  setPhotoCaptions((prev) => ({
                    ...prev,
                    [NEXT_ORDER_PHOTO_KEY]: e.target.value,
                  }))
                }
                className="zine-input min-w-0 flex-1"
              />
              <input
                ref={(el) => {
                  fileInputsRef.current[NEXT_ORDER_PHOTO_KEY] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => handlePhotoSelected({ visitId: null, kind: "next_order" }, e)}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingPhotoKey !== null}
                onClick={() => fileInputsRef.current[NEXT_ORDER_PHOTO_KEY]?.click()}
                className="pressable inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-[12px] font-bold whitespace-nowrap disabled:opacity-60"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--surface)",
                }}
              >
                <Camera className="h-3.5 w-3.5" />
                {uploadingPhotoKey === NEXT_ORDER_PHOTO_KEY ? "Subiendo..." : "Subir foto"}
              </button>
            </div>
          </section>
        )}

        {/* Optional place metadata editor */}
        {editingMeta && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-2xl border-2 p-3.5"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="zine-input"
              />
            </div>

            <div className="flex flex-col gap-1">
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
                      onClick={() => setServiceType(type)}
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

            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                Dirección
              </label>
              <input
                type="text"
                placeholder={
                  serviceType === "delivery"
                    ? "Dirección, barrio o app (opcional)"
                    : "Calle y altura"
                }
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="zine-input"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {MEALS.map((m) => {
                const active = meals.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleMeal(m)}
                    className="pressable rounded-full border-2 px-3 py-1 text-[12px] font-bold"
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

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleDeletePlace}
                className="pressable inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold"
                style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete ? "Confirmar borrado" : "Eliminar lugar"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={saveMeta}
                className="pressable rounded-xl px-4 py-2 text-[13px] font-bold"
                style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
              >
                Guardar datos
              </button>
            </div>
          </div>
        )}

        {/* Overall derived averages per person + 4-category breakdown */}
        {place.ratings.length > 0 && (() => {
          const placeBreakdown = computePlaceBreakdown(place.ratings);
          return (
            <div
              className="mb-4 flex flex-col gap-3 rounded-2xl p-3.5"
              style={{ backgroundColor: "var(--surface-soft)" }}
            >
              <div className="flex flex-col gap-2">
                {place.ratings.map((r) => {
                  const color = accentCssVar(r.userAccent);
                  return (
                    <div
                      key={r.userId}
                      className="tabular grid grid-cols-[64px_1fr_42px] items-center gap-2 text-[13px] font-bold"
                    >
                      <span className="truncate" style={{ color }}>
                        {r.userName}
                      </span>
                      <div
                        className="h-2 overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--surface)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${r.score * 10}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-right" style={{ color }}>
                        {formatScore(r.score)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {placeBreakdown && (
                <div
                  className="rounded-xl p-2"
                  style={{ backgroundColor: "var(--surface)" }}
                >
                  <ScoreBreakdownGrid
                    scores={placeBreakdown}
                    serviceType={place.serviceType}
                    compact
                  />
                </div>
              )}
            </div>
          );
        })()}

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-xl px-3 py-2 text-[13px] font-semibold"
            style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {error}
          </p>
        )}

        {/* New Visit Composer */}
        {newVisitOpen && (
          <section
            className="mb-4 flex flex-col gap-3 rounded-2xl border-2 p-4"
            style={{ borderColor: myColor, backgroundColor: "var(--bg)" }}
            aria-label={isDelivery ? "Registrar pedido" : "Registrar visita"}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[16px] font-bold">
                {place.visits.length === 0
                  ? isDelivery
                    ? "Primer pedido"
                    : "Primera visita"
                  : isDelivery
                    ? `Nuevo pedido (#${place.visits.length + 1})`
                    : `Nueva visita (#${place.visits.length + 1})`}
              </span>
              <span className="text-[12px] font-bold" style={{ color: myColor }}>
                {currentUserName}
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <label
                  htmlFor="new-visit-dish"
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Qué comiste
                </label>
                <input
                  id="new-visit-dish"
                  type="text"
                  placeholder={dishPlaceholder}
                  value={newVisitDish}
                  onChange={(e) => setNewVisitDish(e.target.value)}
                  className="zine-input"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <label
                  htmlFor="new-visit-date"
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Fecha
                </label>
                <input
                  id="new-visit-date"
                  type="date"
                  value={newVisitDate}
                  onChange={(e) => setNewVisitDate(e.target.value)}
                  className="zine-input"
                />
              </div>
            </div>

            <CategoryScorePicker
              scores={newVisitScores}
              color={myColor}
              serviceType={place.serviceType}
              onChange={setNewVisitScores}
            />

            <textarea
              rows={2}
              placeholder="Comentario opcional de esta vez..."
              value={newVisitNote}
              onChange={(e) => setNewVisitNote(e.target.value)}
              className="zine-input"
            />

            <div className="flex items-center gap-2">
              {place.visits.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setNewVisitOpen(false)}
                  className="pressable rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold"
                  style={{ borderColor: "var(--border-soft)", color: "var(--fg-muted)" }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleCreateVisit}
                className="pressable flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold disabled:opacity-60"
                style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
              >
                {busy
                  ? "Guardando..."
                  : isDelivery
                    ? "Guardar pedido"
                    : "Guardar visita"}
              </button>
            </div>
          </section>
        )}

        {/* Visits History */}
        {place.visits.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Historial de visitas">
            {place.visits.map((visit, idx) => {
              const visitNumber = place.visits.length - idx;
              const dateLabel = formatVisitDate(visit.visitedAt);
              const scoredEntries = visit.entries.filter(
                (e): e is VisitEntryItem & { score: number } => e.score !== null,
              );
              const visitAvg = computeAverage(scoredEntries);
              const entryUserIds = new Set(visit.entries.map((e) => e.userId));
              const availableMembers =
                groupMembers.length > 0
                  ? groupMembers
                  : [
                      {
                        id: currentUserId,
                        name: currentUserName,
                        email: "",
                        accentColor: currentUserAccent,
                        role: "owner" as const,
                      },
                    ];
              const missingMembers = availableMembers.filter((m) => !entryUserIds.has(m.id));
              const isEditingThis = editingTarget?.visitId === visit.id;
              const editingHasExisting = isEditingThis
                ? entryUserIds.has(editingTarget.userId)
                : false;
              const editingColor = isEditingThis
                ? accentCssVar(editingTarget.userAccent)
                : myColor;
              const isEditingDate = editingDateVisitId === visit.id;
              const isUploadingHere = uploadingPhotoKey === visit.id;
              const captionVal = photoCaptions[visit.id] ?? "";

              return (
                <article
                  key={visit.id}
                  className="flex flex-col gap-3 rounded-2xl border-2 p-3.5"
                  style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg)" }}
                >
                  {/* Visit header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-display text-[15px] font-bold">
                        {visitLabelCap} #{visitNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingDate) {
                            setEditingDateVisitId(null);
                          } else {
                            setEditingDateVisitId(visit.id);
                            setEditDateValue(visit.visitedAt);
                          }
                        }}
                        className="pressable inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[12px] font-semibold"
                        style={{
                          backgroundColor: isEditingDate ? "var(--surface-soft)" : "transparent",
                          color: "var(--fg-muted)",
                        }}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>{dateLabel || "Agregar fecha"}</span>
                      </button>
                      {visitAvg !== null && scoredEntries.length > 1 && (
                        <span
                          className="tabular rounded-lg px-2 py-0.5 text-[12px] font-bold"
                          style={{
                            backgroundColor: "var(--pill-bg)",
                            color: "var(--pill-fg)",
                          }}
                        >
                          Prom. {formatScore(visitAvg)}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteVisit(visit.id)}
                        aria-label="Eliminar visita"
                        title={
                          confirmDeleteVisitId === visit.id
                            ? "Confirmar borrado"
                            : "Eliminar visita"
                        }
                        className="pressable inline-flex h-7 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-bold"
                        style={
                          confirmDeleteVisitId === visit.id
                            ? { backgroundColor: "var(--danger-soft)", color: "var(--danger)" }
                            : { color: "var(--fg-muted)" }
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {confirmDeleteVisitId === visit.id && <span>Borrar</span>}
                      </button>
                    </div>
                  </div>

                  {/* Optional date editor */}
                  {isEditingDate && (
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        type="date"
                        value={editDateValue}
                        onChange={(e) => setEditDateValue(e.target.value)}
                        className="zine-input min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveVisitDate(visit.id)}
                        className="pressable shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold"
                        style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
                      >
                        OK
                      </button>
                    </div>
                  )}

                  {/* Entries for this visit */}
                  {visit.entries.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {visit.entries.map((entry) => {
                        const color = accentCssVar(entry.userAccent);
                        const isBeingEdited =
                          isEditingThis && editingTarget?.userId === entry.userId;
                        // The editor below replaces this card while it is open
                        if (isBeingEdited) return null;
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-col gap-1.5 rounded-xl px-3 py-2.5"
                            style={{
                              backgroundColor: "var(--surface)",
                              outline: isBeingEdited ? `2px solid ${color}` : undefined,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 text-[13px] font-bold">
                              <span style={{ color }}>{entry.userName}</span>
                              <div className="flex items-center gap-2">
                                {entry.score !== null ? (
                                  <>
                                    <span className="tabular" style={{ color }}>
                                      {formatScore(entry.score)} / 10
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditingEntry(visit, {
                                          userId: entry.userId,
                                          userName: entry.userName,
                                          userAccent: entry.userAccent,
                                        })
                                      }
                                      aria-label={`Editar comida de ${entry.userName}`}
                                      title={`Editar comida de ${entry.userName}`}
                                      className="pressable inline-flex h-6 w-6 items-center justify-center rounded-md"
                                      style={{
                                        backgroundColor: "var(--pill-bg)",
                                        color: "var(--fg-muted)",
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {entry.legacyScore !== null && (
                                      <span
                                        className="tabular text-[11px] font-semibold"
                                        style={{ color: "var(--fg-muted)" }}
                                      >
                                        Antes: {formatScore(entry.legacyScore)}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditingEntry(visit, {
                                          userId: entry.userId,
                                          userName: entry.userName,
                                          userAccent: entry.userAccent,
                                        })
                                      }
                                      className="pressable rounded-full border-2 px-2.5 py-0.5 text-[11.5px] font-bold"
                                      style={{
                                        borderColor: color,
                                        color,
                                        backgroundColor: "var(--bg)",
                                      }}
                                    >
                                      Puntuar
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {entry.scores && (
                              <ScoreBreakdownGrid
                                scores={entry.scores}
                                serviceType={place.serviceType}
                                compact
                              />
                            )}

                            {entry.dish && (
                              <div className="text-[13px] font-semibold">{entry.dish}</div>
                            )}
                            {entry.note && (
                              <p
                                className="m-0 text-[12.5px]"
                                style={{ color: "var(--fg-muted)" }}
                              >
                                {entry.note}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isEditingThis && editingTarget && (
                    <VisitEntryEditor
                      visitId={visit.id}
                      title={editingTarget.userName}
                      dishLabel={
                        editingTarget.userId === currentUserId
                          ? "Qué comiste"
                          : `Qué comió ${editingTarget.userName}`
                      }
                      dishPlaceholder={dishPlaceholder}
                      color={editingColor}
                      serviceType={place.serviceType}
                      legacyHint={entryLegacyHint}
                      dish={entryDish}
                      onDishChange={setEntryDish}
                      scores={entryScores}
                      onScoresChange={setEntryScores}
                      note={entryNote}
                      onNoteChange={setEntryNote}
                      canDelete={editingHasExisting}
                      busy={busy}
                      onDelete={handleDeleteEntry}
                      onCancel={() => {
                        setEditingTarget(null);
                        setEntryLegacyHint(null);
                      }}
                      onSave={handleSaveEntry}
                    />
                  )}

                  {/* Quick buttons to add missing group members' entries on this visit */}
                  {!isEditingThis && missingMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {missingMembers.map((member) => {
                        const memberColor = accentCssVar(member.accentColor);
                        const isMe = member.id === currentUserId;
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() =>
                              startEditingEntry(visit, {
                                userId: member.id,
                                userName: member.name,
                                userAccent: member.accentColor,
                              })
                            }
                            className="pressable rounded-full border-2 px-3 py-1 text-[12px] font-bold"
                            style={{
                              borderColor: isMe ? memberColor : "var(--border-soft)",
                              backgroundColor: "var(--surface)",
                              color: isMe ? memberColor : "var(--fg)",
                            }}
                          >
                            {isMe ? "+ Sumar lo que comí" : `+ Sumar de ${member.name}`}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Visit Photos */}
                  <div
                    className="flex flex-col gap-2 border-t pt-2.5"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    {visit.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {visit.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="group relative aspect-square overflow-hidden rounded-xl border-2"
                            style={{ borderColor: "var(--border-soft)" }}
                          >
                            <button
                              type="button"
                              onClick={() => setLightboxPhoto(photo)}
                              className="h-full w-full"
                              aria-label={photo.caption || `Foto de ${place.name}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={photo.caption || `Foto de ${place.name}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeletePhoto(photo.id)}
                              aria-label="Borrar foto"
                              className="pressable absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full"
                              style={{ backgroundColor: "rgba(0,0,0,0.68)", color: "#ffffff" }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Plato de la foto (opcional)"
                        value={captionVal}
                        onChange={(e) =>
                          setPhotoCaptions((prev) => ({
                            ...prev,
                            [visit.id]: e.target.value,
                          }))
                        }
                        className="zine-input flex-1"
                      />
                      <input
                        ref={(el) => {
                          fileInputsRef.current[visit.id] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        onChange={(e) => handlePhotoSelected({ visitId: visit.id, kind: "general" }, e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingPhotoKey !== null}
                        onClick={() => fileInputsRef.current[visit.id]?.click()}
                        className="pressable inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-[12px] font-bold whitespace-nowrap disabled:opacity-60"
                        style={{
                          borderColor: "var(--border)",
                          backgroundColor: "var(--surface)",
                        }}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {isUploadingHere ? "Subiendo..." : "Foto"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Unlinked legacy photos (if any exist) */}
        {unlinkedPhotos.length > 0 && (
          <section
            className="mt-4 flex flex-col gap-2.5 rounded-2xl border-2 p-3.5"
            style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg)" }}
            aria-label="Otras fotos"
          >
            <span className="text-[13px] font-bold">
              Otras fotos ({unlinkedPhotos.length})
            </span>
            <div className="grid grid-cols-3 gap-2">
              {unlinkedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border-2"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto(photo)}
                    className="h-full w-full"
                    aria-label={photo.caption || `Foto de ${place.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption || `Foto de ${place.name}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDeletePhoto(photo.id)}
                    aria-label="Borrar foto"
                    className="pressable absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(0,0,0,0.68)", color: "#ffffff" }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Full-size Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
          }}
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto.url}
            alt={lightboxPhoto.caption || place.name}
            className="max-h-[80dvh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {(lightboxPhoto.caption || lightboxPhoto.uploadedBy) && (
            <div className="mt-3 text-center text-[14px] text-white">
              {lightboxPhoto.caption && <span>{lightboxPhoto.caption}</span>}
              {lightboxPhoto.uploadedBy && (
                <span className="ml-2 opacity-70">({lightboxPhoto.uploadedBy})</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
