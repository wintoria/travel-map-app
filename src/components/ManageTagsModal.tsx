"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Contrast calculator for tag rendering
const getContrastColor = (hexColor: string) => {
  if (!hexColor) return '#000000';
  let color = hexColor.trim().toLowerCase();
  const namedColors: Record<string, string> = {
    white: 'ffffff', black: '000000', red: 'ff0000', green: '008000', blue: '0000ff', 
    yellow: 'ffff00', orange: 'ffa500', purple: '800080', gray: '808080', brown: 'a52a2a'
  };
  color = namedColors[color] || color.replace(/[^0-9a-f]/g, '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  if (color.length !== 6) return '#000000'; 
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  return ((r * 299 + g * 587 + b * 114) / 1000) > 140 ? '#000000' : '#ffffff';
};

export default function ManageTagsModal() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  // State for tracking which tag is pending deletion
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("categories").select("*").order("name");
    if (data) setCategories(data);
    setIsLoading(false);
  };

  const confirmDelete = async (id: string) => {
    // Perform the actual deletion after confirmation
    await supabase.from("categories").delete().eq("id", id);
    setCategories(prev => prev.filter(cat => cat.id !== id));
    setDeletingId(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten tag? Zostanie on usunięty ze wszystkich miejsc.")) return;
    
    await supabase.from("categories").delete().eq("id", id);
    setCategories(prev => prev.filter(cat => cat.id !== id));
    router.refresh();
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || "");
    
    // Safely handle legacy color names for the color picker input
    let safeColor = cat.color || "#3b82f6";
    if (safeColor.trim().toLowerCase() === "white") safeColor = "#ffffff";
    if (safeColor.trim().toLowerCase() === "black") safeColor = "#000000";
    setEditColor(safeColor);
  };

  const handleUpdate = async (id: string) => {
    const { data, error } = await supabase
      .from("categories")
      .update({ name: editName.trim(), icon: editIcon, color: editColor })
      .eq("id", id)
      .select()
      .single();

    if (data && !error) {
      setCategories(prev => prev.map(c => c.id === id ? data : c));
      setEditingId(null);
      router.refresh();
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
          <button onClick={handleClose} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
            ✕
          </button>
        </div>

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
                const rawColor = cat.color || '#ffffff';
                const isWhite = rawColor.toLowerCase().includes('ffffff') || rawColor.trim().toLowerCase() === 'white';
                const effectiveColor = isWhite ? '#e5e7eb' : rawColor;

                return (
                  <div key={cat.id} className="p-2 border border-gray-100 rounded-lg bg-gray-50/50 flex flex-col gap-2 hover:bg-gray-50 transition-colors">
                    {isEditing ? (
                      // Edit Mode
                      <div className="flex flex-col gap-2">
                        {/* Inputs row */}
                        <div className="flex gap-2 items-center w-full">
                          <input 
                            type="text" 
                            value={editIcon} 
                            onChange={(e) => setEditIcon(e.target.value)} 
                            className="w-12 p-1.5 text-center border rounded-md text-sm outline-none shrink-0" 
                            placeholder="Ikona"
                          />
                          <input 
                            type="text" 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)} 
                            className="flex-1 min-w-0 p-1.5 border rounded-md text-sm outline-none" 
                          />
                          <input 
                            type="color" 
                            value={editColor} 
                            onChange={(e) => setEditColor(e.target.value)} 
                            className="w-8 h-8 p-0 border-0 rounded-md cursor-pointer shrink-0" 
                          />
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
                            color: getContrastColor(effectiveColor),
                            borderColor: effectiveColor
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm"
                        >
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