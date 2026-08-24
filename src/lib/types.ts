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
  // Timestamp of the last edit (client-set, not a DB trigger) — used for last-write-wins conflict
  // resolution when two devices edit the same row while both were offline. See lib/api/places.ts.
  updated_at: string;
  // Set only on an optimistic, offline-cached row that hasn't been synced to Supabase yet.
  _pendingSync?: boolean;
}

export interface Trip {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  _pendingSync?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  updated_at: string;
  _pendingSync?: boolean;
}

export interface PlaceCategory {
  place_id: string;
  category_id: string;
}
