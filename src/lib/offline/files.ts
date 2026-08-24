// Deferred attachment uploads: a File picked while offline is stashed in IndexedDB and only
// uploaded to Supabase Storage once the mutation queue replays it (see queue.ts).
import { getDB } from "./db";
import { uploadAttachment } from "@/lib/api/storage";

export async function storePendingFile(file: File): Promise<string> {
  const fileRef = crypto.randomUUID();
  const db = await getDB();
  await db.put("pendingFiles", {
    fileRef,
    blob: file,
    name: file.name,
    type: file.type,
    createdAt: Date.now(),
  });
  return fileRef;
}

export async function getPendingFile(fileRef: string) {
  const db = await getDB();
  return db.get("pendingFiles", fileRef);
}

export async function deletePendingFile(fileRef: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingFiles", fileRef);
}

// Local-only preview so the optimistic cached place can show the attachment before it's synced.
// Session-scoped: URL.createObjectURL doesn't survive a reload, which is an accepted limitation.
export async function previewUrlForPendingFile(fileRef: string): Promise<string | null> {
  const pending = await getPendingFile(fileRef);
  if (!pending) return null;
  return URL.createObjectURL(pending.blob);
}

// Reconstructs the File from its stored blob and uploads it, returning the public URL.
// Called only from queue.ts during replay, once connectivity is confirmed.
export async function uploadPendingFile(fileRef: string): Promise<string> {
  const pending = await getPendingFile(fileRef);
  if (!pending) throw new Error(`Pending file ${fileRef} not found`);

  const file = new File([pending.blob], pending.name, { type: pending.type });
  const url = await uploadAttachment(file);
  await deletePendingFile(fileRef);
  return url;
}
