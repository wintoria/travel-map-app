// Single source of truth for the cross-component window events used as a lightweight pub/sub.

export const AppEvent = {
  placesUpdated: "places-updated",
  tripsUpdated: "trips-updated",
  filtersChanged: "filters-changed",
  searchChanged: "search-changed",
} as const;

export type AppEventName = (typeof AppEvent)[keyof typeof AppEvent];

// Dispatch an app event. Pass `detail` to send a CustomEvent payload (read by map/list listeners).
export function emit(name: AppEventName, detail?: unknown) {
  window.dispatchEvent(
    detail === undefined ? new Event(name) : new CustomEvent(name, { detail })
  );
}
