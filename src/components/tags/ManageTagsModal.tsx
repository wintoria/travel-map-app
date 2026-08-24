"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tag, Star, X } from "lucide-react";
import { getContrastColor, effectiveTagColor, autoColorForEmoji, DEFAULT_MARKER_EMOJI } from "@/lib/color";
import { fetchCategories as loadCategories, createCategory, updateCategory, deleteCategory, sortCategories } from "@/lib/api/categories";
import { isOffline, PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import { AppEvent, emit } from "@/lib/events";
import IconPicker from "./IconPicker";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { Category } from "@/lib/types";

export default function ManageTagsModal() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editIsMain, setEditIsMain] = useState(false);
  // State for tracking which tag is pending deletion
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // States for the new-tag form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(DEFAULT_MARKER_EMOJI);
  const [newIsMain, setNewIsMain] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    setCategories(sortCategories(await loadCategories()));
    setIsLoading(false);
  };

  useEffect(() => {
    // Async fetch-on-mount: setState runs after await, so cascading-render rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, []);

  const confirmDelete = async (id: string) => {
    // Perform the actual deletion after confirmation
    const { error } = await deleteCategory(id);
    setDeletingId(null);

    if (error) {
      console.error("Delete category error:", error);
      toast.error("Nie udało się usunąć tagu.");
      return;
    }
    setCategories(prev => prev.filter(cat => cat.id !== id));
    if (isOffline()) notifyPendingSync(PENDING_SYNC_MESSAGE);
    emit(AppEvent.categoriesUpdated);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || DEFAULT_MARKER_EMOJI);
    setEditIsMain(cat.is_main);
  };

  const handleUpdate = async (id: string) => {
    try {
      const updated = await updateCategory(id, { name: editName.trim(), icon: editIcon, color: autoColorForEmoji(editIcon), is_main: editIsMain });
      setCategories(prev => sortCategories(prev.map(c => c.id === id ? updated : c)));
      setEditingId(null);
      if (updated._pendingSync) notifyPendingSync(PENDING_SYNC_MESSAGE);
      emit(AppEvent.categoriesUpdated);
    } catch (error) {
      console.error("Update category error:", error);
      toast.error("Nie udało się zaktualizować tagu.");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const category = await createCategory({ name: newName.trim(), icon: newIcon, color: autoColorForEmoji(newIcon), is_main: newIsMain });
      setCategories(prev => sortCategories([...prev, category]));
      setShowNewForm(false);
      setNewName("");
      setNewIcon(DEFAULT_MARKER_EMOJI);
      setNewIsMain(false);
      if (category._pendingSync) notifyPendingSync(PENDING_SYNC_MESSAGE);
      emit(AppEvent.categoriesUpdated);
    } catch (error) {
      console.error("Create category error:", error);
      toast.error("Nie udało się utworzyć tagu.");
    }
  };

  const handleClose = () => {
    // Navigate back to the main map view
    router.push("/?view=map");
  };

  return (
    <Modal
      onClose={handleClose}
      maxWidth="max-w-[420px]"
      title={
        <span className="flex items-center gap-2">
          <Tag size={18} />
          Zarządzaj tagami
        </span>
      }
      headerExtra={
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-base-300 text-base-content/70 hover:bg-base-300/50 transition-colors cursor-pointer flex items-center gap-1"
        >
          {showNewForm ? <><X size={14} /> Anuluj</> : "+ Nowy tag"}
        </button>
      }
    >
      {/* New-tag form */}
      {showNewForm && (
        <div className="bg-base-100/50 p-3 border-b border-base-300 flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-2">
          <IconPicker value={newIcon} onChange={setNewIcon} />
          <input
            type="text"
            placeholder="Nazwa tagu"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[120px] p-1.5 bg-base-100 border border-base-300 text-base-content rounded-md text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setNewIsMain(!newIsMain)}
            title="Główny tag — jego emoji pojawi się na markerze mapy"
            className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${newIsMain ? "bg-warning/20 border-warning" : "bg-base-200 border-base-300 opacity-60 hover:opacity-100"}`}
          >
            <Star size={16} fill={newIsMain ? "currentColor" : "none"} className={newIsMain ? "text-warning" : "text-muted"} />
          </button>
          <Button type="button" onClick={handleCreate} variant="primary">
            Zapisz
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="p-4 overflow-y-auto flex-1">
        {isLoading ? (
          <div className="text-center py-8 text-muted">Ładowanie tagów...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted">Brak utworzonych tagów.</div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;
              const effectiveColor = effectiveTagColor(cat.color);

              return (
                <div key={cat.id} className="p-2 border border-base-300 rounded-lg bg-base-100/50 flex flex-col gap-2 hover:bg-base-100 transition-colors">
                  {isEditing ? (
                    // Edit Mode
                    <div className="flex flex-col gap-2">
                      {/* Inputs row */}
                      <div className="flex gap-2 items-center w-full">
                        <IconPicker value={editIcon} onChange={setEditIcon} />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-0 p-1.5 bg-base-100 border border-base-300 text-base-content rounded-md text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditIsMain(!editIsMain)}
                          title="Główny tag — jego emoji pojawi się na markerze mapy"
                          className={`w-8 h-8 shrink-0 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${editIsMain ? "bg-warning/20 border-warning" : "bg-base-200 border-base-300 opacity-60 hover:opacity-100"}`}
                        >
                          <Star size={16} fill={editIsMain ? "currentColor" : "none"} className={editIsMain ? "text-warning" : "text-muted"} />
                        </button>
                      </div>
                      {/* Buttons row */}
                      <div className="flex gap-2 w-full mt-1">
                        <Button onClick={() => setEditingId(null)} variant="secondary" fullWidth>
                          Anuluj
                        </Button>
                        <Button onClick={() => handleUpdate(cat.id)} variant="primary" fullWidth>
                          Zapisz
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={{
                          backgroundColor: effectiveColor,
                          color: getContrastColor(effectiveColor, 140),
                          borderColor: effectiveColor
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm"
                      >
                        {cat.is_main && (
                          <span title="Główny tag">
                            <Star size={14} fill="currentColor" />
                          </span>
                        )}
                        <span>{cat.icon}</span>
                        <span className="truncate max-w-[150px]">{cat.name}</span>
                      </span>

                      {/* Inline Delete Confirmation or Standard Action Buttons */}
                      {deletingId === cat.id ? (
                        <div className="flex items-center gap-1 bg-error/15 p-1 rounded-md shrink-0 border border-error/30">
                          <span className="text-xs text-error font-medium px-1 mr-1">Usunąć?</span>
                          <Button onClick={() => confirmDelete(cat.id)} variant="danger-solid" className="text-xs px-2 py-1 h-auto min-h-0">
                            Tak
                          </Button>
                          <Button onClick={() => setDeletingId(null)} variant="secondary" className="text-xs px-2 py-1 h-auto min-h-0">
                            Nie
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => startEdit(cat)} className="text-sm px-2 py-1 text-base-content/70 hover:text-primary bg-base-200 border border-base-300 rounded hover:bg-base-300 transition-colors cursor-pointer">
                            Edytuj
                          </button>
                          {/* Instead of system alert, we trigger the inline confirmation UI */}
                          <button onClick={() => setDeletingId(cat.id)} className="text-sm px-2 py-1 text-base-content/70 hover:text-error bg-base-200 border border-base-300 rounded hover:bg-error/10 transition-colors cursor-pointer">
                            Usuń
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}