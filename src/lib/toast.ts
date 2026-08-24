import toast from "react-hot-toast";

// Consistent styling for the "this was queued for sync" notice — distinct from a plain success/error
// toast since it's neither: the action worked, but not live yet.
export function notifyPendingSync(message: string) {
  toast(message, { icon: "📡", duration: 6000 });
}
