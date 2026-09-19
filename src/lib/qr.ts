// Tiny QR code generator, public domain.
// Adapted from Project Nayuki's reference implementation — no external deps.
// Returns an SVG string for a Version 1-10 (21..57 modules) QR encoding.
//
// Scope: encodes a short payload (URL or string up to ~120 chars at L) suitable
// for a reservation code. NOT meant for arbitrary data; not optimized.

/** Build an SVG string for a QR code encoding `text`. */
export const qrSvg = (text: string, opts?: { size?: number; margin?: number }): string => {
  const size = opts?.size ?? 180;
  const margin = opts?.margin ?? 2;
  const modules = encodeQR(text);
  const total = modules.length + margin * 2;

  const parts: string[] = [];
  for (let y = 0; y < modules.length; y++) {
    const row = modules[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x]) {
        parts.push(`M${x + margin},${y + margin}h1v1h-1z`);
      }
    }
  }
  const path = parts.join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" aria-label="Código QR de la reserva"><rect width="${total}" height="${total}" fill="#faf4ea"/><path d="${path}" fill="#1f1812"/></svg>`;
};

// ── Minimal QR encoder (Version 1-10, byte mode, error correction L) ────

const ECC_CODEWORDS_PER_BLOCK: Record<number, [number, number, number, number]> = {
  // version -> [totalBlocks, dataCodewordsGroup1, dataCodewordsGroup2, ecCodewordsPerBlock]
  1: [1, 19, 0, 7],
  2: [1, 34, 0, 10],
  3: [1, 55, 0, 15],
  4: [1, 80, 0, 20],
  5: [1, 108, 0, 26],
  6: [2, 68, 0, 18],
  7: [2, 78, 0, 20],
  8: [2, 97, 0, 24],
  9: [2, 116, 0, 30],
  10: [2, 68, 18, 18],
};

const ALIGNMENT_PATTERN_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const chooseVersion = (len: number): number => {
  // Version 1 holds 17 data codewords at L = ~14 chars of byte data.
  // Use the per-version dataCodewordsGroup1+2 totals below.
  const dataCapacity: Record<number, number> = {
    1: 19, 2: 34, 3: 55, 4: 80, 5: 108,
    6: 136, 7: 156, 8: 194, 9: 232, 10: 274,
  };
  for (let v = 1; v <= 10; v++) {
    if (dataCapacity[v] >= len + 2) return v;
  }
  // Fall back to v10 — caller should keep payloads short.
  return 10;
};

const encodeQR = (text: string): boolean[][] => {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const totalModules = 17 + version * 4;

  // Build data codewords: mode byte + length + payload + terminator + padding.
  const dataCodewords = encodeData(bytes, version);

  // Build error-correction codewords.
  const [totalBlocks, g1, g2, ecPerBlock] = ECC_CODEWORDS_PER_BLOCK[version];
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let dataIdx = 0;
  for (let b = 0; b < totalBlocks; b++) {
    const blockLen = b < g2 ? g1 : (g2 > 0 ? g2 : g1);
    const block = dataCodewords.slice(dataIdx, dataIdx + blockLen);
    dataIdx += blockLen;
    blocks.push(block);
    ecBlocks.push(reedSolomon(block, ecPerBlock));
  }

  // Interleave codewords.
  const interleaved = interleave(blocks, ecBlocks, ecPerBlock);

  // Convert to bit stream.
  const bits: number[] = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  // Add remainder bits.
  const remainderBits = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0][version];
  for (let i = 0; i < remainderBits; i++) bits.push(0);

  // Place modules.
  const modules: (boolean | null)[][] = makeMatrix(totalModules);
  placeFinderPatterns(modules);
  placeAlignmentPatterns(modules, version);
  placeTimingPatterns(modules);
  reserveFormatAreas(modules);

  let bitIdx = 0;
  for (let col = totalModules - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let row = 0; row < totalModules; row++) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (modules[row][x] !== null) continue;
        const bit =
          bitIdx < bits.length ? bits[bitIdx] : 0;
        bitIdx++;
        modules[row][x] = bit === 1;
      }
    }
  }

  // Mask 0 + format info (we use the simplest fixed mask 0: (row+col) % 2 == 0).
  const mask = (row: number, col: number): boolean => (row + col) % 2 === 0;
  for (let r = 0; r < totalModules; r++) {
    for (let c = 0; c < totalModules; c++) {
      const prev = modules[r][c];
      if (prev === null) modules[r][c] = false;
      const next = (prev ?? true) !== mask(r, c);
      modules[r][c] = next;
    }
  }
  placeFormatInfo(modules, 0);
  return modules as boolean[][];
};

const encodeData = (bytes: Uint8Array, version: number): number[] => {
  const [, g1, g2] = ECC_CODEWORDS_PER_BLOCK[version];
  const dataLen = (g1 > 0 ? g1 : 0) + (g2 > 0 ? g2 : 0);
  const dataCC = dataLen;
  const capacityBits = dataCC * 8;

  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // byte mode
  const lenBits = version < 10 ? 8 : 16;
  pushBits(bits, bytes.length, lenBits);
  for (const b of bytes) pushBits(bits, b, 8);
  pushBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bits.length < capacityBits) {
    pushBits(bits, padBytes[pi++ % 2], 8);
  }
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    out.push(v);
  }
  return out;
};

const pushBits = (arr: number[], v: number, n: number): void => {
  for (let i = n - 1; i >= 0; i--) arr.push((v >> i) & 1);
};

// ── Reed-Solomon over GF(256) ──────────────────────────────────────────

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
};

const reedSolomon = (data: number[], ecLen: number): number[] => {
  const gen = buildGenerator(ecLen);
  const buf = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      buf[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return buf.slice(data.length);
};

const buildGenerator = (degree: number): number[] => {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = next;
  }
  return g.slice(1);
};

const interleave = (
  blocks: number[][],
  ecBlocks: number[][],
  ecLen: number,
): number[] => {
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) if (i < b.length) out.push(b[i]);
  }
  return out;
};

// ── Module placement ───────────────────────────────────────────────────

const makeMatrix = (n: number): (boolean | null)[][] => {
  const out: (boolean | null)[][] = [];
  for (let r = 0; r < n; r++) {
    const row: (boolean | null)[] = [];
    for (let c = 0; c < n; c++) row.push(null);
    out.push(row);
  }
  return out;
};

const placeFinder = (m: (boolean | null)[][], r: number, c: number): void => {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const y = r + dy;
      const x = c + dx;
      if (y < 0 || x < 0 || y >= m.length || x >= m.length) continue;
      const inFinder =
        dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6 &&
        (dy === 0 || dy === 6 || dx === 0 || dx === 6 ||
          (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));
      m[y][x] = inFinder;
    }
  }
};

const placeFinderPatterns = (m: (boolean | null)[][]): void => {
  placeFinder(m, 0, 0);
  placeFinder(m, 0, m.length - 7);
  placeFinder(m, m.length - 7, 0);
};

const placeAlignmentPatterns = (
  m: (boolean | null)[][],
  version: number,
): void => {
  const positions = ALIGNMENT_PATTERN_POSITIONS[version] ?? [];
  for (const r of positions) {
    for (const c of positions) {
      // Skip if it overlaps a finder pattern.
      if ((r === 6 && c === 6) ||
          (r === 6 && c === m.length - 7) ||
          (r === m.length - 7 && c === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const y = r + dy;
          const x = c + dx;
          if (y < 0 || x < 0 || y >= m.length || x >= m.length) continue;
          const v = Math.max(Math.abs(dy), Math.abs(dx)) !== 1;
          m[y][x] = v;
        }
      }
    }
  }
};

const placeTimingPatterns = (m: (boolean | null)[][]): void => {
  const n = m.length;
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }
};

const reserveFormatAreas = (m: (boolean | null)[][]): void => {
  const n = m.length;
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = false;
    if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = false;
  }
  if (m[n - 8][8] === null) m[n - 8][8] = true; // dark module
};

const placeFormatInfo = (m: (boolean | null)[][], _mask: number): void => {
  // Mask 0 format bits: 111011111000100
  const bits = "111011111000100";
  const n = m.length;
  for (let i = 0; i < 15; i++) {
    const bit = bits[i] === "1";
    // Top-left vertical
    if (i < 6) m[8][i] = bit;
    else if (i < 8) m[8][i + 1] = bit;
    else m[8][n - 15 + i] = bit;
    // Left + top horizontal
    if (i < 8) m[n - 1 - i][8] = bit;
    else m[14 - i][8] = bit;
  }
};