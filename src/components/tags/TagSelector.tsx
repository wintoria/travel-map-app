"use client";
import { useState, useEffect } from "react";
import { getBrightness, effectiveTagColor } from "@/lib/color";
import { fetchCategories, createCategory } from "@/lib/api/categories";
import toast from "react-hot-toast";
import type { Category } from "@/lib/types";

export default function TagSelector({ initialSelected = [] }: { initialSelected?: string[] }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [showNewForm, setShowNewForm] = useState(false);

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📌");
  const [newColor, setNewColor] = useState("#93C5FD");

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
    );
  };

  const handleCreateCategory = async () => {
    if (!newName.trim()) return;

    try {
      const category = await createCategory({ name: newName.trim(), icon: newIcon, color: newColor });
      setCategories(prev => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedIds(prev => [...prev, category.id]);
      setShowNewForm(false);
      setNewName("");
    } catch (error) {
      console.error("Create category error:", error);
      toast.error("Nie udało się utworzyć tagu.");
    }
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name="category_ids" value={JSON.stringify(selectedIds)} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50 transition-colors shrink-0 cursor-pointer"
        >
          {showNewForm ? "✕ Anuluj" : "+ Nowy tag"}
        </button>

        {categories.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          
          // Replace pure white hex or string "white" with light gray
          const rawColor = cat.color || '#ffffff';
          const isWhite = rawColor.toLowerCase().includes('ffffff') || rawColor.trim().toLowerCase() === 'white';
          const effectiveColor = effectiveTagColor(rawColor);

          const brightness = getBrightness(effectiveColor);
          
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              title={cat.name}
              style={{ 
                backgroundColor: isSelected ? effectiveColor : '#ffffff',
                // Force dark text if color is white, else calculate based on brightness
                color: isWhite 
                  ? '#111827' 
                  : (isSelected ? (brightness > 180 ? '#111827' : '#ffffff') : '#111827'),
                borderColor: effectiveColor
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all flex items-center gap-1.5 max-w-full cursor-pointer hover:opacity-80 ${isSelected ? 'border-solid shadow-sm' : 'border-dashed'}`}
            >
              <span className="shrink-0">{cat.icon}</span>
              <span className="truncate max-w-[120px]">{cat.name}</span>
            </button>
          );
        })}
      </div>

      {showNewForm && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-2">
          <input 
            type="text" 
            placeholder="Ikona" 
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            className="w-12 p-1.5 text-center border border-gray-300 rounded-md text-sm outline-none" 
          />
          <input 
            type="text" 
            placeholder="Nazwa tagu" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[120px] p-1.5 border border-gray-300 rounded-md text-sm outline-none" 
          />
          <input 
            type="color" 
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 p-0 border-0 rounded-md cursor-pointer shrink-0" 
          />
          <button 
            type="button" 
            onClick={handleCreateCategory}
            className="bg-gray-800 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-900 cursor-pointer"
          >
            Zapisz
          </button>
        </div>
      )}
    </div>
  );
}