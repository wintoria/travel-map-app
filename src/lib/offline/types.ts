// Shared types for the offline data mirror and mutation queue (src/lib/offline/*).

export type QueuedEntity = "place" | "trip" | "category";
export type QueuedOpKind = "create" | "update" | "delete";

export interface QueuedOperation {
  seq?: number; // autoIncrement key, assigned by IndexedDB on insert
  entity: QueuedEntity;
  kind: QueuedOpKind;
  targetId: string; // the row's real id — client-generated up front, stable from creation onward
  payload: Record<string, unknown>;
  fileRef?: string; // present only when a deferred attachment upload is queued alongside
  createdAt: number;
}

export interface PendingFile {
  fileRef: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: number;
}
