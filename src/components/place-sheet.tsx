"use client";

import {
  Camera,
  MapPin,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { AccentColor, MealType, ServiceType } from "@/db/schema";
import {
  buildGoogleMapsUrl,
  computeAverage,
  formatScore,
  MEAL_LABELS,
  MEALS,
  SERVICE_LABELS,
  SERVICE_TYPES,
  type PlacePhotoEntry,
  type PlaceWithRatings,
} from "@/lib/domain";

const QUICK_SCORES = [5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

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
  onClose: () => void;
  onUpdated: (place: PlaceWithRatings) => void;
  onDeleted: (placeId: string) => void;
}

export function PlaceSheet({
  place,
  currentUserId,
  currentUserName,
  currentUserAccent,
  onClose,
  onUpdated,
  onDeleted,
}: PlaceSheetProps) {
  const myExisting = place?.ratings.find((r) => r.userId === currentUserId);
  const otherRatings = place?.ratings.filter((r) => r.userId !== currentUserId) ?? [];

  const [score, setScore] = useState<number>(myExisting?.score ?? 8);
  const [note, setNote] = useState<string>(myExisting?.note ?? "");
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(place?.name ?? "");
  const [address, setAddress] = useState(place?.address ?? "");
  const [serviceType, setServiceType] = useState<ServiceType>(place?.serviceType ?? "dine_in");
  const [meals, setMeals] = useState<MealType[]>(place?.meals ?? ["cena"]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<PlacePhotoEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!place) return;
    const mine = place.ratings.find((r) => r.userId === currentUserId);
    setScore(mine?.score ?? 8);
    setNote(mine?.note ?? "");
    setName(place.name);
    setAddress(place.address);
    setServiceType(place.serviceType);
    setMeals(place.meals);
    setEditingMeta(false);
    setConfirmDelete(false);
    setPhotoCaption("");
    setLightboxPhoto(null);
    setError(null);
  }, [place, currentUserId]);

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

  function stepScore(delta: number) {
    setScore((prev) => Math.min(10, Math.max(1, Math.round((prev + delta) * 10) / 10)));
  }

  function handleScoreChange(raw: string) {
    const parsed = parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(parsed)) {
      setScore(Math.min(10, Math.max(1, Math.round(parsed * 10) / 10)));
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

  async function saveMyRating() {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}/rating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, note }),
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo guardar tu puntaje");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
      setBusy(false);
      onClose();
    } catch {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  async function removeMyRating() {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}/rating`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        place?: PlaceWithRatings;
        error?: string;
      } | null;

      if (!res.ok || !data?.place) {
        setError(data?.error || "No se pudo quitar tu puntaje");
        setBusy(false);
        return;
      }
      onUpdated(data.place);
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

  async function handleDelete() {
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

  async function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !place) return;
    setUploadingPhoto(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (photoCaption.trim()) {
        fd.append("caption", photoCaption.trim());
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
        setUploadingPhoto(false);
        return;
      }

      onUpdated(data.place);
      setPhotoCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadingPhoto(false);
    } catch {
      setError("Error al subir la foto");
      setUploadingPhoto(false);
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
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ backgroundColor: "var(--backdrop)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className="zine-sheet max-h-[90dvh] w-full max-w-[520px] overflow-y-auto px-5 pt-3 pb-6"
        style={{
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full sm:hidden"
          style={{ backgroundColor: "var(--border-soft)" }}
        />

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display m-0 text-[23px] leading-tight font-bold">
              {place.name}
            </h2>
            <div
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
              style={{ color: "var(--fg-muted)" }}
            >
              {place.serviceType === "delivery" && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: "var(--pill-bg)",
                    color: "var(--pill-fg)",
                  }}
                >
                  <ShoppingBag className="h-3 w-3" />
                  {SERVICE_LABELS.delivery}
                </span>
              )}
              <span>
                {place.meals.map((m) => MEAL_LABELS[m]).join(" / ")}
                {place.address ? ` en ${place.address}` : ""}
              </span>
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

        {/* Quick action bar: Google Maps + Edit place */}
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
            Abrir en Google Maps
          </a>

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
            {editingMeta ? "Cancelar edición" : "Editar datos"}
          </button>
        </div>

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
              <div
                className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-2 sm:grid-cols-2"
                role="group"
                aria-label="Tipo de lugar"
              >
                {SERVICE_TYPES.map((type) => {
                  const active = serviceType === type;
                  const Icon = type === "dine_in" ? Utensils : ShoppingBag;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setServiceType(type)}
                      className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-2.5 py-2 text-[12px] font-bold whitespace-nowrap"
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
                onClick={handleDelete}
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

        {/* Other people's ratings (read-only) */}
        {otherRatings.length > 0 && (
          <div
            className="mb-4 flex flex-col gap-2.5 rounded-2xl p-3.5"
            style={{ backgroundColor: "var(--surface-soft)" }}
          >
            {otherRatings.map((r) => {
              const color = accentCssVar(r.userAccent);
              return (
                <div key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span style={{ color }}>{r.userName}</span>
                    <span className="tabular" style={{ color }}>
                      {formatScore(r.score)} / 10
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--surface)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.score * 10}%`, backgroundColor: color }}
                    />
                  </div>
                  {r.note && <p className="mt-1 mb-0 text-[13px]">{r.note}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Current user's own rating editor (0.1 step precision) */}
        <div
          className="mb-4 flex flex-col gap-3 rounded-2xl border-2 p-4"
          style={{ borderColor: myColor, backgroundColor: "var(--bg)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold" style={{ color: myColor }}>
              Tu puntaje ({currentUserName})
            </span>
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
                aria-label="Tu puntaje numérico"
                value={score}
                onChange={(e) => handleScoreChange(e.target.value)}
                className="font-display tabular w-16 rounded-lg border-2 py-1 text-center text-[20px] font-bold"
                style={{
                  borderColor: myColor,
                  backgroundColor: "var(--surface)",
                  color: myColor,
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
            onChange={(e) => handleScoreChange(e.target.value)}
            aria-label="Selector deslizante de puntaje"
            className="w-full cursor-pointer"
            style={{ accentColor: myColor }}
          />

          <div className="tabular grid grid-cols-5 gap-1.5">
            {QUICK_SCORES.map((val) => {
              const selected = score === val;
              return (
                <button
                  key={val}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setScore(val)}
                  className="pressable rounded-xl border-2 py-1.5 text-[13px] font-bold"
                  style={{
                    borderColor: selected ? myColor : "var(--border-soft)",
                    backgroundColor: selected ? myColor : "var(--surface)",
                    color: selected ? "var(--accent-on-solid)" : "var(--fg)",
                  }}
                >
                  {formatScore(val)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="my-review-note" className="text-[12px] font-semibold" style={{ color: "var(--fg-muted)" }}>
              Tu reseña
            </label>
            <textarea
              id="my-review-note"
              rows={3}
              placeholder="Qué pidieron, qué estuvo bueno o qué evitar..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="zine-input"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="m-0 rounded-xl px-3 py-2 text-[13px] font-semibold"
              style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            {myExisting && (
              <button
                type="button"
                disabled={busy}
                onClick={removeMyRating}
                className="pressable rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold"
                style={{ borderColor: "var(--border-soft)", color: "var(--fg-muted)" }}
              >
                Quitar
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={saveMyRating}
              className="pressable flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold disabled:opacity-60"
              style={{ backgroundColor: "var(--fg)", color: "var(--bg)" }}
            >
              {busy ? "Guardando..." : "Guardar mi puntaje"}
            </button>
          </div>
        </div>

        {/* Food Photos Gallery & Upload */}
        <section
          className="flex flex-col gap-3 rounded-2xl border-2 p-4"
          style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg)" }}
          aria-label="Fotos de la comida"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold">
              Fotos de la comida ({place.photos.length})
            </span>
          </div>

          {place.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {place.photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border-2" style={{ borderColor: "var(--border-soft)" }}>
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Descripción opcional (ej. Tabla 1, café...)"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              className="zine-input flex-1"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handlePhotoSelected}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="pressable inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-[13px] font-bold whitespace-nowrap disabled:opacity-60"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface)",
              }}
            >
              <Camera className="h-4 w-4" />
              {uploadingPhoto ? "Subiendo..." : "Subir foto"}
            </button>
          </div>
        </section>
      </div>

      {/* Full-size Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.9)" }}
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            aria-label="Cerrar foto"
            className="pressable absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.16)", color: "#ffffff" }}
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
