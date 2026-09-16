/**
 * Panel geometry in one place. `applyLayoutVariables` publishes these as CSS variables so the map
 * overlays position against the same numbers the map uses for its viewport padding.
 */
export const LAYOUT = {
  gap: 16,
  panelWidth: 366,
  detailWidth: 326,
  /** Height of the mobile detail sheet, as a share of the viewport. */
  sheetHeight: 0.33,
};
/** Map width taken by the explorer panel, and by the detail panel when it opens beside it. */
export const PANEL_INSET = LAYOUT.gap * 2 + LAYOUT.panelWidth;
export const DETAIL_INSET = PANEL_INSET + LAYOUT.detailWidth + LAYOUT.gap;

export function applyLayoutVariables(root: HTMLElement) {
  root.style.setProperty("--panel-gap", `${LAYOUT.gap}px`);
  root.style.setProperty("--panel-w", `${LAYOUT.panelWidth}px`);
  root.style.setProperty("--detail-w", `${LAYOUT.detailWidth}px`);
  root.style.setProperty("--detail-left", `${PANEL_INSET}px`);
  root.style.setProperty("--map-inset", `${PANEL_INSET}px`);
  root.style.setProperty("--sheet-h", `${LAYOUT.sheetHeight * 100}dvh`);
}
