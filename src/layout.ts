/**
 * Panel geometry in one place. `applyLayoutVariables` publishes these as CSS variables so the map
 * overlays position against the same numbers the map uses for its viewport padding.
 */
export const LAYOUT = {
  gap: 16,
  panelWidth: 366,
  detailWidth: 326,
  /** The local government summary and zone notice, stacked beside the panels. */
  cardWidth: 320,
  /** Height of the mobile detail sheet, as a share of the viewport. */
  sheetHeight: 0.33,
  /** Space kept clear along the right edge for the camera controls. */
  controlsClearance: 72,
  /** The least width of map left open when the cards would otherwise crowd it out. */
  minOpenMap: 240,
};
/** Map width taken by the explorer panel, and by the detail panel when it opens beside it. */
export const PANEL_INSET = LAYOUT.gap * 2 + LAYOUT.panelWidth;
export const DETAIL_INSET = PANEL_INSET + LAYOUT.detailWidth + LAYOUT.gap;

/**
 * How far the panels and cards reach into the map from the left on a wide screen, which becomes
 * the viewport padding the camera centres against. The cards sit just right of the open panels,
 * but on a screen too narrow for that they stop short of the camera controls and overlap the detail
 * panel instead. The `.map-cards` rule places them the same way.
 */
export function coveredLeft(width: number, hasDetail: boolean, hasCards: boolean) {
  const panels = hasDetail ? DETAIL_INSET : PANEL_INSET;
  if (!hasCards) return panels;
  const room = width - PANEL_INSET - LAYOUT.cardWidth - LAYOUT.controlsClearance;
  const shift = hasDetail ? Math.min(Math.max(room, 0), LAYOUT.detailWidth + LAYOUT.gap) : 0;
  const cards = PANEL_INSET + shift + LAYOUT.cardWidth + LAYOUT.gap;
  return Math.max(panels, Math.min(cards, width - LAYOUT.minOpenMap));
}

export function applyLayoutVariables(root: HTMLElement) {
  root.style.setProperty("--panel-gap", `${LAYOUT.gap}px`);
  root.style.setProperty("--panel-w", `${LAYOUT.panelWidth}px`);
  root.style.setProperty("--detail-w", `${LAYOUT.detailWidth}px`);
  root.style.setProperty("--card-w", `${LAYOUT.cardWidth}px`);
  root.style.setProperty("--controls-clearance", `${LAYOUT.controlsClearance}px`);
  root.style.setProperty("--detail-left", `${PANEL_INSET}px`);
  root.style.setProperty("--map-inset", `${PANEL_INSET}px`);
  root.style.setProperty("--sheet-h", `${LAYOUT.sheetHeight * 100}dvh`);
}
