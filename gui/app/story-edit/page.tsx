"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Play,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://macys-api-n6f3.onrender.com";
// Auth is now handled by cookie session, not query param.

type Slide = {
  id: number;
  type: "image" | "divider";
  image?: string;
  label?: string;
  title?: string;
  subtitle?: string;
  notes: string;
};

// --- Sortable slide card ---

function SortableSlideCard({
  slide,
  onEdit,
  onDelete,
}: {
  slide: Slide;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const thumb =
    slide.type === "image" && slide.image
      ? slide.image
      : null;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: "manipulation" }}
      {...attributes}
      {...listeners}
      className="group relative cursor-grab overflow-hidden rounded-lg border border-charcoal/10 bg-white shadow-sm active:cursor-grabbing"
    >
      {/* Drag handle hint (visual only, entire card is draggable) */}
      <div className="absolute left-1 top-1 z-10 rounded p-1 text-charcoal/30 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Action buttons */}
      <div className="absolute right-1 top-1 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded bg-white/90 p-1.5 text-charcoal/50 shadow-sm hover:text-teal-600"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded bg-white/90 p-1.5 text-charcoal/50 shadow-sm hover:text-soft_red"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Slide number */}
      <div className="absolute left-2 bottom-2 z-10 rounded bg-black/40 px-1.5 py-0.5 text-xs font-bold text-white">
        {slide.id}
      </div>

      {/* Thumbnail */}
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={`Slide ${slide.id}`}
          className="aspect-video w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[#0B7B8A] px-3">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A843]">
              {slide.label}
            </p>
            <p className="mt-1 text-sm font-bold text-[#F8F4EC]">{slide.title}</p>
          </div>
        </div>
      )}

      {/* Notes preview */}
      <div className="px-3 py-2">
        <p className="truncate text-[11px] text-charcoal/60">
          {slide.notes || "(no notes)"}
        </p>
      </div>
    </div>
  );
}

// --- Edit modal ---

function EditModal({
  slide,
  onClose,
  onSave,
}: {
  slide: Slide;
  onClose: () => void;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(slide.notes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <h3 className="font-serif text-lg font-semibold text-charcoal">
            Edit Slide {slide.id}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-charcoal/40 hover:text-charcoal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          {slide.type === "image" && slide.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.image}
              alt={`Slide ${slide.id}`}
              className="mb-4 w-full rounded-md"
            />
          )}
          {slide.type === "divider" && (
            <div className="mb-4 flex aspect-video items-center justify-center rounded-md bg-[#0B7B8A]">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-widest text-[#D4A843]">{slide.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#F8F4EC]">{slide.title}</p>
                <p className="mt-1 text-sm text-[#F8F4EC]/70">{slide.subtitle}</p>
              </div>
            </div>
          )}
          <label className="block">
            <span className="text-xs font-medium text-charcoal/60">Speaker Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-charcoal/10 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal hover:bg-cream">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(notes)}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Add slide modal ---

function AddModal({
  totalSlides,
  onClose,
  onAdd,
}: {
  totalSlides: number;
  onClose: () => void;
  onAdd: (data: FormData) => void;
}) {
  const [notes, setNotes] = useState("");
  const [position, setPosition] = useState(totalSlides);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleSubmit() {
    if (submitting || !file) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("notes", notes);
    fd.append("position", String(position));
    fd.append("slide_type", "image");
    onAdd(fd);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-3">
          <h3 className="font-serif text-lg font-semibold text-charcoal">Add New Slide</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-charcoal/40 hover:text-charcoal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {/* Image upload */}
          <div
            className="flex aspect-video cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-charcoal/20 bg-cream/50 hover:border-teal-600"
            onClick={() => document.getElementById("slide-upload")?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="h-full w-full rounded-md object-contain" />
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-charcoal/30" />
                <p className="mt-2 text-xs text-charcoal/50">Drag image here or click to browse</p>
              </div>
            )}
            <input
              id="slide-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          <label className="block">
            <span className="text-xs font-medium text-charcoal/60">Speaker Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-charcoal/60">Insert at position</span>
            <input
              type="number"
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value, 10) || 0)}
              min={0}
              max={totalSlides}
              className="mt-1 w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-charcoal/10 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-charcoal/15 bg-white px-4 py-2 text-sm font-medium text-charcoal hover:bg-cream">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Adding..." : "Add Slide"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Toast ---

function Toast({ message, type }: { message: string; type: "info" | "error" | "success" }) {
  const cls = type === "error" ? "border-soft_red/40 text-soft_red" : type === "success" ? "border-sage/40 text-sage" : "border-teal-600/40 text-teal-600";
  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-lg ${cls}`}>
      {message}
    </div>
  );
}

// --- Main page ---

export default function StoryEditPageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>}>
      <StoryEditPage />
    </Suspense>
  );
}

function StoryEditPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "info" | "error" | "success" } | null>(null);
  const [editSlide, setEditSlide] = useState<Slide | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lastCommit, setLastCommit] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  );

  function authHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("editor_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Check auth on mount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const token = localStorage.getItem("editor_token");
    if (!token) {
      router.push("/story-edit/login");
      return;
    }
    fetch(`${API_BASE}/api/auth/check`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setAuthed(true);
        } else {
          localStorage.removeItem("editor_token");
          router.push("/story-edit/login");
        }
      })
      .catch(() => router.push("/story-edit/login"));
  }, [router]);

  function showToast(message: string, type: "info" | "error" | "success" = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleCommitResult(github: Record<string, string> | null | undefined) {
    if (github && github.sha) {
      setLastCommit(github.sha.slice(0, 7));
      showToast("Saved and committed to GitHub", "success");
    } else if (github && github.error) {
      showToast(`GitHub: ${github.error}`, "error");
    } else {
      showToast("Saved locally", "info");
    }
  }

  // Load slides
  const fetchSlides = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/slides`, { cache: "no-store" });
      const data = await r.json();
      setSlides(data.slides || []);
    } catch (e) {
      showToast(`Load failed: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchSlides();
  }, [authed, fetchSlides]);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </main>
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    // Use arrayMove to reorder without changing ids (keeps dnd-kit stable)
    const reordered = arrayMove(slides, oldIdx, newIdx);
    setSlides(reordered);

    // Send the current id order to the backend; it will renumber on save
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/slides/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ order: reordered.map((s) => s.id) }),
      });
      const data = await r.json();
      handleCommitResult(data.github);
      // Refresh with server renumbered ids
      await fetchSlides();
    } catch (e) {
      showToast(`Reorder failed: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(notes: string) {
    if (!editSlide) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/slides/${editSlide.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ notes }),
      });
      const data = await r.json();
      setSlides((prev) => prev.map((s) => (s.id === editSlide.id ? { ...s, notes } : s)));
      setEditSlide(null);
      handleCommitResult(data.github);
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slideId: number) {
    if (!confirm(`Delete slide ${slideId}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/slides/${slideId}`, { method: "DELETE", headers: authHeaders() });
      const data = await r.json();
      setSlides((prev) => {
        const filtered = prev.filter((s) => s.id !== slideId);
        filtered.forEach((s, i) => { s.id = i + 1; });
        return filtered;
      });
      handleCommitResult(data.github);
    } catch (e) {
      showToast(`Delete failed: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(formData: FormData) {
    if (saving) return; // prevent double fire
    setAddOpen(false); // close modal immediately
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/slides/add`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await r.json();
      await fetchSlides();
      handleCommitResult(data.github);
    } catch (e) {
      showToast(`Add failed: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 border-b border-charcoal/10 bg-white/95 px-6 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-semibold text-charcoal">Slide Editor</h1>
            <p className="text-[11px] text-charcoal/50">
              Drag to reorder. Click to edit. {slides.length} slides.
              {lastCommit && (
                <span className="ml-2 font-mono text-teal-600">
                  Last commit: {lastCommit}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-charcoal/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              <ImagePlus className="h-4 w-4" />
              Add Slide
            </button>
            <Link
              href="/story"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-cream"
            >
              <Play className="h-3.5 w-3.5" />
              View Story
            </Link>
            <Link
              href="/"
              className="text-sm text-charcoal/50 hover:text-charcoal"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("editor_token");
                router.push("/story");
              }}
              className="rounded-md border border-charcoal/15 bg-white px-3 py-1.5 text-xs font-medium text-charcoal/60 hover:text-soft_red"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {slides.map((slide) => (
                <SortableSlideCard
                  key={slide.id}
                  slide={slide}
                  onEdit={() => setEditSlide(slide)}
                  onDelete={() => handleDelete(slide.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Modals */}
      {editSlide && (
        <EditModal
          slide={editSlide}
          onClose={() => setEditSlide(null)}
          onSave={handleEditSave}
        />
      )}
      {addOpen && (
        <AddModal
          totalSlides={slides.length}
          onClose={() => setAddOpen(false)}
          onAdd={handleAdd}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </main>
  );
}
