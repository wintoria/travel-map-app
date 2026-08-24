import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import { isNetworkError } from "@/lib/offline/network";
import { cacheCategories, getCachedCategories, upsertCachedCategory, removeCachedCategoryCascade } from "@/lib/offline/cache";
import { enqueueOperation } from "@/lib/offline/queue";

// All categories (tags) ordered by name.
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) {
    if (!isNetworkError(error)) return [];
    return getCachedCategories();
  }
  const categories = (data as Category[]) || [];
  void cacheCategories(categories);
  return categories;
}

// A single canonical row straight from the server — used to reconcile the local cache after a
// queued write loses a last-write-wins conflict (see queue.ts).
export async function fetchCategoryRemoteById(id: string): Promise<Category | null> {
  const { data } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
  return (data as Category | null) ?? null;
}

async function reconcileSupersededCategory(id: string): Promise<void> {
  const current = await fetchCategoryRemoteById(id);
  if (current) {
    await upsertCachedCategory(current);
  } else {
    await removeCachedCategoryCascade(id);
  }
}

export interface CategoryInput {
  name: string;
  icon: string | null;
  color: string | null;
}

// Idempotent: upserts by the caller-supplied id, so a duplicate replay (tab crash, two tabs syncing
// at once) overwrites the same row instead of inserting a second one.
export async function createCategoryRemote(id: string, input: CategoryInput, editedAt: string): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .upsert({ id, ...input, updated_at: editedAt }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const id = crypto.randomUUID();
  const editedAt = new Date().toISOString();
  try {
    const category = await createCategoryRemote(id, input, editedAt);
    void upsertCachedCategory(category);
    return category;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const optimisticCategory: Category = { id, updated_at: editedAt, ...input, _pendingSync: true };
    await upsertCachedCategory(optimisticCategory);
    await enqueueOperation({ entity: "category", kind: "create", targetId: id, payload: { ...input, editedAt } });
    return optimisticCategory;
  }
}

// Conditional update: returns null when a newer edit (from another device) already won.
export async function updateCategoryRemote(id: string, input: CategoryInput, editedAt: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .update({ ...input, updated_at: editedAt })
    .eq("id", id)
    .lt("updated_at", editedAt)
    .select();
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as Category) : null;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const editedAt = new Date().toISOString();
  try {
    const category = await updateCategoryRemote(realId, input, editedAt);
    if (!category) {
      // Someone else's newer edit already won — keep their version in the cache, but tell the
      // caller this edit did NOT apply (don't let the UI close/report success as if it had).
      await reconcileSupersededCategory(realId);
      throw new Error("Ten tag został w międzyczasie zmieniony na innym urządzeniu — Twoja zmiana nie została zapisana.");
    }
    void upsertCachedCategory(category);
    return category;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const optimisticCategory: Category = { id: realId, updated_at: editedAt, ...input, _pendingSync: true };
    await upsertCachedCategory(optimisticCategory);
    await enqueueOperation({ entity: "category", kind: "update", targetId: realId, payload: { ...input, editedAt } });
    return optimisticCategory;
  }
}

// Returns false when the delete was skipped because a newer edit exists server-side.
export async function deleteCategoryRemote(id: string, deletedAt: string): Promise<boolean> {
  const { data, error } = await supabase.from("categories").delete().eq("id", id).lt("updated_at", deletedAt).select();
  if (error) throw error;
  return !!(data && data.length > 0);
}

export async function deleteCategory(id: string): Promise<{ error: unknown }> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const deletedAt = new Date().toISOString();
  try {
    const deleted = await deleteCategoryRemote(realId, deletedAt);
    if (deleted) {
      void removeCachedCategoryCascade(realId);
      return { error: null };
    }
    // Superseded: someone edited this tag after our delete fired — keep their newer version and
    // tell the caller the delete did NOT happen.
    await reconcileSupersededCategory(realId);
    return { error: new Error("Category was edited elsewhere after this delete — kept the newer version.") };
  } catch (err) {
    if (!isNetworkError(err)) return { error: err };

    await removeCachedCategoryCascade(realId);
    await enqueueOperation({ entity: "category", kind: "delete", targetId: realId, payload: { deletedAt } });
    return { error: null };
  }
}
