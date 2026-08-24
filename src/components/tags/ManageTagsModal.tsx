"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getContrastColor, effectiveTagColor, autoColorForEmoji, DEFAULT_MARKER_EMOJI } from "@/lib/color";
import { fetchCategories as loadCategories, createCategory, updateCategory, deleteCategory, sortCategories } from "@/lib/api/categories";
import { isOffline, PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import { AppEvent, emit } from "@/lib/events";
import IconPicker from "./IconPicker";
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
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[420px] max-h-[80vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🏷️ Zarządzaj tagami
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {showNewForm ? "✕ Anuluj" : "+ Nowy tag"}
            </button>
            <button onClick={handleClose} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        {/* New-tag form */}
        {showNewForm && (
          <div className="bg-gray-50 p-3 border-b flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-2">
            <IconPicker value={newIcon} onChange={setNewIcon} />
            <input
              type="text"
              placeholder="Nazwa tagu"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[120px] p-1.5 border border-gray-300 rounded-md text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setNewIsMain(!newIsMain)}
              title="Główny tag — jego emoji pojawi się na markerze mapy"
              className={`w-8 h-8 shrink-0 rounded-md border text-lg flex items-center justify-center cursor-pointer transition-colors ${newIsMain ? "bg-yellow-400 border-yellow-500" : "bg-white border-gray-300 grayscale opacity-50 hover:opacity-100"}`}
            >
              ⭐
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="bg-gray-800 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-900 cursor-pointer"
            >
              Zapisz
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Ładowanie tagów...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Brak utworzonych tagów.</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;
                const effectiveColor = effectiveTagColor(cat.color);

                return (
                  <div key={cat.id} className="p-2 border border-gray-100 rounded-lg bg-gray-50/50 flex flex-col gap-2 hover:bg-gray-50 transition-colors">
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
                            className="flex-1 min-w-0 p-1.5 border rounded-md text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setEditIsMain(!editIsMain)}
                            title="Główny tag — jego emoji pojawi się na markerze mapy"
                            className={`w-8 h-8 shrink-0 rounded-md border text-lg flex items-center justify-center cursor-pointer transition-colors ${editIsMain ? "bg-yellow-400 border-yellow-500" : "bg-white border-gray-300 grayscale opacity-50 hover:opacity-100"}`}
                          >
                            ⭐
                          </button>
                        </div>
                        {/* Buttons row */}
                        <div className="flex gap-2 w-full mt-1">
                          <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors cursor-pointer">
                            Anuluj
                          </button>
                          <button onClick={() => handleUpdate(cat.id)} className="flex-1 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors cursor-pointer">
                            Zapisz
                          </button>
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
                          {cat.is_main && <span title="Główny tag">⭐</span>}
                          <span>{cat.icon}</span>
                          <span className="truncate max-w-[150px]">{cat.name}</span>
                        </span>
                        
                        {/* Inline Delete Confirmation or Standard Action Buttons */}
                        {deletingId === cat.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-md shrink-0 border border-red-100">
                            <span className="text-xs text-red-800 font-medium px-1 mr-1">Usunąć?</span>
                            <button onClick={() => confirmDelete(cat.id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded shadow-sm hover:bg-red-700 transition-colors font-bold cursor-pointer">
                              Tak
                            </button>
                            <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 bg-white text-gray-700 border border-red-200 rounded shadow-sm hover:bg-gray-50 transition-colors cursor-pointer">
                              Nie
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => startEdit(cat)} className="text-sm px-2 py-1 text-gray-600 hover:text-blue-600 bg-white border rounded shadow-sm hover:bg-gray-50 transition-colors cursor-pointer">
                              Edytuj
                            </button>
                            {/* Instead of system alert, we trigger the inline confirmation UI */}
                            <button onClick={() => setDeletingId(cat.id)} className="text-sm px-2 py-1 text-red-600 hover:text-red-700 bg-white border rounded shadow-sm hover:bg-red-50 transition-colors cursor-pointer">
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
      </div>
    </div>
  );
}