export const CELL_WIDTH = 30;
export const ROW_HEIGHT = 40;
export const CHANNEL_COUNT = 15;
export const TOTAL_COLUMNS = 60;

export interface GridPosition {
  col: number;
  row: number;
}

export function snapToGrid(px: number, py: number, svgRect: DOMRect): GridPosition {
  const relX = px - svgRect.left;
  const relY = py - svgRect.top;
  return {
    col: Math.max(0, Math.floor(relX / CELL_WIDTH)),
    row: Math.max(0, Math.min(CHANNEL_COUNT - 1, Math.floor(relY / ROW_HEIGHT))),
  };
}

export function segmentRect(start: number, channel: number, duration: number) {
  return {
    x: start * CELL_WIDTH,
    y: channel * ROW_HEIGHT,
    width: duration * CELL_WIDTH,
    height: ROW_HEIGHT - 4,
  };
}
