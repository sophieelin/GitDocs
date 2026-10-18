import { onMounted, onUnmounted } from "vue";

/**
 * Runs `load` when the component opens, and again every time the tab is
 * opened again (it regains focus or becomes visible). Another user's change,
 * such as a reviewer approving a proposal, then shows up without a manual
 * page refresh.
 *
 * Call it from a component's `setup`. Focus and visibility often fire
 * together, so a load that is still running is not started a second time.
 */
export function useRefreshOnFocus(load: () => Promise<unknown>): void {
  let running: Promise<unknown> | undefined;

  function refresh(): void {
    running ??= load().finally(() => {
      running = undefined;
    });
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "visible") refresh();
  }

  onMounted(() => {
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onUnmounted(() => {
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });
}
