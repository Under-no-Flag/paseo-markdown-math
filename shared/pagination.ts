export const NATIVE_PAGE_HEIGHT = 3000;

// Prefer a block boundary in the latter half of the page, so normal formulas,
// figures and paragraphs remain together. Oversized blocks still split at the cap.
export function pageStarts(height: number, blockStarts: number[]): number[] {
  const boundaries = [...new Set(blockStarts.map(Math.floor))].filter(y => y > 0 && y < height).sort((a, b) => a - b);
  const starts = [0];
  let cursor = 0;
  while (starts[starts.length - 1] + NATIVE_PAGE_HEIGHT < height) {
    const start = starts[starts.length - 1];
    const limit = start + NATIVE_PAGE_HEIGHT;
    let boundary = limit;
    while (cursor < boundaries.length && boundaries[cursor] <= limit) {
      if (boundaries[cursor] >= start + NATIVE_PAGE_HEIGHT / 2) boundary = boundaries[cursor];
      cursor++;
    }
    starts.push(boundary);
  }
  return starts;
}
