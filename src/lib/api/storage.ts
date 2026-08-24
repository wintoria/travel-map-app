import { supabase } from "@/lib/supabase";

// Uploads a file to the `attachments` bucket under a sanitized, de-duplicated name and returns its
// public URL. Throws on failure (network or storage error) — callers decide how to handle that.
export async function uploadAttachment(file: File): Promise<string> {
  const originalName = file.name;
  const lastDotIndex = originalName.lastIndexOf(".");

  const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
  const fileExt = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : "";
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, "_");
  const randomStr = Math.random().toString(36).substring(2, 7);
  const fileName = `${safeBaseName}-${randomStr}${fileExt}`;

  const { error: uploadError } = await supabase.storage.from("attachments").upload(fileName, file);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("attachments").getPublicUrl(fileName);

  return publicUrl;
}
