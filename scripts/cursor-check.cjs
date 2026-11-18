// Self-check for the cursor overlay mapping in electron/main.cjs.
// Run: node scripts/cursor-check.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf-8');
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const { parseTrackerLine, cursorCommands } = new Function(
  cut('function parseTrackerLine', '// Per-chunk wiring') +
  cut('// Tracked cursor samples', '// Draw the PC cursor') +
  '; return { parseTrackerLine, cursorCommands };'
)();

// Emulator window client area 399x886 on screen -> 1080x2400 video, 100% scaling.
const chunk = { t0: 1000, dpi: 96, samples: [] };
parseTrackerLine('dpi 96', chunk);
parseTrackerLine('900 10 10 399 886', chunk);   // before recording started
parseTrackerLine('950 199 443 399 886', chunk); // latest before start -> becomes t=0
parseTrackerLine('1500 -5 20 399 886', chunk);  // left of the window -> hidden
parseTrackerLine('2000 hidden', chunk);         // window minimized -> hidden

const cmds = cursorCommands(chunk, { w: 1080, h: 2400 });
const k = (1080 / 399) / 4;
assert.deepStrictEqual(cmds, [
  `0.000 overlay@c x ${Math.round((199 * 1080) / 399 - 4 * k)}, overlay@c y ${Math.round((443 * 2400) / 886 - 4 * k)};`,
  '0.500 overlay@c x -9999, overlay@c y -9999;',
  '1.000 overlay@c x -9999, overlay@c y -9999;'
]);
console.log('cursor mapping OK');
