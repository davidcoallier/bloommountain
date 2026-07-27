/** Bloomberg-ish palette: amber headings on black, green/red deltas. */
export const theme = {
  amber: "#ffb000",
  text: "#d6d6d6",
  dim: "#6e7681",
  up: "#00e676",
  down: "#ff5252",
  border: "#30363d",
  borderFocus: "#ffb000",
  blue: "#58a6ff",
  bg: "#000000",
} as const;

export function deltaColor(n: number | null | undefined): string {
  if (n == null || n === 0) return theme.dim;
  return n > 0 ? theme.up : theme.down;
}
