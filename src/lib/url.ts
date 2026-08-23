import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Helpers over the app's URL-as-state pattern: modals and filters live in query params.
// These wrap the existing `new URLSearchParams(window.location.search)` + scroll:false push idiom.

export function currentParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function pushParams(router: AppRouterInstance, params: URLSearchParams) {
  router.push(`?${params.toString()}`, { scroll: false });
}

// Open a modal, optionally attaching extra params (e.g. { placeId }, { tripId }).
export function openModal(
  router: AppRouterInstance,
  modal: string,
  extra?: Record<string, string>
) {
  const params = currentParams();
  params.set("modal", modal);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
  }
  pushParams(router, params);
}

// Close the active modal, deleting `modal` plus any additional keys (e.g. placeId, tripId).
export function closeModal(router: AppRouterInstance, keys: string[] = []) {
  const params = currentParams();
  params.delete("modal");
  for (const key of keys) params.delete(key);
  pushParams(router, params);
}
