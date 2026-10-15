// ============================================================
//  AquarelleParamsPanel — the aquarelle module-only param
//  surface (AQUA-04 / D-04/05/06/08).
//
//  8 globals (size maps to the shared Size slider — D-05, no
//  local size control) + a collapsible "Brush response" with
//  8 ×multipliers (0.5–2.0, default 1.0) showing the computed
//  effective value (global × multiplier).
//
//  RED stub: renders an empty shell so the contract pins fail
//  until the panel body lands.
// ============================================================

export function AquarelleParamsPanel() {
  return <div data-testid="aquarelle-params-panel" />;
}
