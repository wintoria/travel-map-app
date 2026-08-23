import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";

// All categories (tags) ordered by name.
export async function fetchCategories(): Promise<Category[]> {
  const { data } = await supabase.from("categories").select("*").order("name");
  return (data as Category[]) || [];
}
