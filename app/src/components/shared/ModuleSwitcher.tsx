/**
 * 56-02 (D-01, D-03): the shared top-bar module switcher — Brush | Water color | Krita.
 * One component, one active-module signal, mounted in both Toolbar and PhysicsPaintTopBar.
 * Krita is display-only and inert (D-03).
 */
export function ModuleSwitcher() {
  return <div class="module-switcher" role="group" aria-label="Module" />;
}
