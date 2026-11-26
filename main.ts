// THE WORLD TODAY — the world news of Wednesday, November 25, 2026 as one 1024x1024 front page.
// Node 22, standard library only, no network. build.mjs renders the page from news.json ahead of time and the
// result is committed as entry.png; this program writes those exact bytes to /output/entry.png, so every run
// produces the same image.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const png = readFileSync(new URL('./entry.png', import.meta.url));

// Refuse to hand over an image the gate would refuse: a whole PNG, 1024x1024 at most, 1 MiB at most.
const SIGNATURE = '89504e470d0a1a0a';
if (png.subarray(0, 8).toString('hex') !== SIGNATURE) throw new Error('entry.png is not a PNG');
if (png.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error('entry.png has no leading IHDR chunk');
if (png.subarray(-8, -4).toString('latin1') !== 'IEND') throw new Error('entry.png is cut short (no IEND chunk)');
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 1024 || height !== 1024) throw new Error(`entry.png is ${width}x${height}, not 1024x1024`);
if (png.length > 1024 * 1024) throw new Error(`entry.png is ${png.length} bytes, over 1 MiB`);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png, { mode: 0o644 });
