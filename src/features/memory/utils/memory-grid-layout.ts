export type MemoryGridLayout = {
  columns: number;
  rows: number;
};

export const MEMORY_GRID_TILE_COUNT = 12 as const;
export const MEMORY_GRID_GAP_PX = 8 as const;

export const DEFAULT_MEMORY_GRID_LAYOUT: MemoryGridLayout = { columns: 3, rows: 4 };

// Only column counts that divide 12 evenly are considered so the grid always
// holds exactly 12 tiles with no empty cells.
const LAYOUT_CANDIDATES = [2, 3, 4, 6] as const;

/**
 * Chooses a grid arrangement for the 12 tiles of a batch that maximises the
 * smallest tile side for the available container, so every tile stays visible
 * without page scrolling. The layout adapts to the viewport instead of being
 * frozen to one shape.
 */
export function computeMemoryGridLayout(
  width: number,
  height: number,
  gap: number = MEMORY_GRID_GAP_PX,
): MemoryGridLayout {
  let best: MemoryGridLayout | null = null;
  let bestMinSide = -1;

  for (const columns of LAYOUT_CANDIDATES) {
    const rows = MEMORY_GRID_TILE_COUNT / columns;
    const tileWidth = (width - (columns - 1) * gap) / columns;
    const tileHeight = (height - (rows - 1) * gap) / rows;
    if (tileWidth <= 0 || tileHeight <= 0) continue;
    const minSide = Math.min(tileWidth, tileHeight);
    if (minSide > bestMinSide) {
      bestMinSide = minSide;
      best = { columns, rows };
    }
  }

  return best ?? DEFAULT_MEMORY_GRID_LAYOUT;
}
