/**
 * Braille-dot canvas for smooth terminal charts.
 *
 * Each terminal cell carries a 2×4 dot grid (U+2800 block), giving 8× the
 * resolution of box-drawing charts. Colors apply per cell (last writer wins);
 * markers (▲/▼) replace the cell entirely.
 */

const RESET = "\x1b[0m";

// braille dot bit for pixel (x % 2, y % 4)
const DOT_BITS = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
];

export class BrailleCanvas {
  private readonly pw: number;
  private readonly ph: number;
  private readonly bits: Uint8Array;
  private readonly color: (string | null)[];
  private readonly markers = new Map<number, { ch: string; ansi: string }>();

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.pw = cols * 2;
    this.ph = rows * 4;
    this.bits = new Uint8Array(cols * rows);
    this.color = new Array(cols * rows).fill(null);
  }

  get pixelWidth(): number {
    return this.pw;
  }

  get pixelHeight(): number {
    return this.ph;
  }

  setPixel(px: number, py: number, ansi: string): void {
    if (px < 0 || py < 0 || px >= this.pw || py >= this.ph) return;
    const cell = (py >> 2) * this.cols + (px >> 1);
    this.bits[cell] |= DOT_BITS[px & 1][py & 3];
    this.color[cell] = ansi;
  }

  /** Bresenham line in pixel space. */
  line(x0: number, y0: number, x1: number, y1: number, ansi: string): void {
    let [x, y] = [Math.round(x0), Math.round(y0)];
    const [ex, ey] = [Math.round(x1), Math.round(y1)];
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.setPixel(x, y, ansi);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Place a marker character at a cell (overrides dots there). */
  setMarker(cellX: number, cellY: number, ch: string, ansi: string): void {
    if (cellX < 0 || cellY < 0 || cellX >= this.cols || cellY >= this.rows) return;
    this.markers.set(cellY * this.cols + cellX, { ch, ansi });
  }

  /** Render to one string per row, ANSI-colored, runs grouped. */
  render(): string[] {
    const out: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let row = "";
      let cur: string | null = null;
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        const marker = this.markers.get(idx);
        let ch: string;
        let ansi: string | null;
        if (marker) {
          ch = marker.ch;
          ansi = marker.ansi;
        } else if (this.bits[idx]) {
          ch = String.fromCharCode(0x2800 + this.bits[idx]);
          ansi = this.color[idx];
        } else {
          ch = " ";
          ansi = null;
        }
        if (ansi !== cur) {
          if (cur !== null) row += RESET;
          if (ansi !== null) row += ansi;
          cur = ansi;
        }
        row += ch;
      }
      if (cur !== null) row += RESET;
      out.push(row);
    }
    return out;
  }
}
