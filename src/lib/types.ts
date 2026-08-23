// Shared domain types, derived from the actual Supabase table columns used across the app.

export interface Place {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
  address: string | null;
  duration: string | null;
  visited: boolean | null;
  trip_id: string | null;
  google_maps_url: string | null;
  additional_link: string | null;
  attached_file: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface PlaceCategory {
  place_id: string;
  category_id: string;
}
