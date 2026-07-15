export const CELL_WIDTH = 30;
export const ROW_HEIGHT = 40;
export const CHANNEL_COUNT = 15;
export const TOTAL_COLUMNS = 60;

export const CELL_WIDTHS = [15, 20, 30, 45, 60, 90, 120, 180, 240];
export const DEFAULT_ZOOM_INDEX = 2;

export interface GridPosition {
  col: number;
  row: number;
}

export function snapToGrid(
  px: number,
  py: number,
  svgRect: DOMRect,
  cellWidth: number = CELL_WIDTH,
  rowHeight: number = ROW_HEIGHT,
): GridPosition {
  const relX = px - svgRect.left;
  const relY = py - svgRect.top;
  return {
    col: Math.max(0, Math.floor(relX / cellWidth)),
    row: Math.max(0, Math.min(CHANNEL_COUNT - 1, Math.floor(relY / rowHeight))),
  };
}

export function segmentRect(start: number, channel: number, duration: number, cellWidth: number = CELL_WIDTH) {
  return {
    x: start * cellWidth,
    y: channel * ROW_HEIGHT,
    width: duration * cellWidth,
    height: ROW_HEIGHT - 4,
  };
}
