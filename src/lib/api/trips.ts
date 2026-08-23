import { supabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";

// Full trip rows ordered by creation (sidebar tree, dropdowns).
export async function fetchTrips(): Promise<Trip[]> {
  const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: true });
  return (data as Trip[]) || [];
}

// Lightweight id/name/icon rows for dropdowns and grouping headers.
export async function fetchTripsBasic(): Promise<Pick<Trip, "id" | "name" | "icon" | "parent_id">[]> {
  const { data } = await supabase.from("trips").select("id, name, icon, parent_id");
  return data || [];
}
