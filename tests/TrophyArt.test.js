import test from 'node:test';
import assert from 'node:assert/strict';
import { TROPHY_ART, TROPHY_IDS, trophySvg } from '../src/ui/TrophyArt.js';

test('one trophy per competition, each copy with its own gradient ids', () => {
  for (const id of ['champions', 'copa-libertadores', 'club-world-cup', 'world-cup', 'euro', 'copa-america', 'league']) assert.ok(TROPHY_IDS.includes(id), id);
  const a = TROPHY_ART.champions, b = TROPHY_ART.champions;
  const ids = svg => [...svg.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids(a).length > 0); assert.equal(ids(a).filter(id => ids(b).includes(id)).length, 0);
  // Every url(#…) points at a gradient defined in the same SVG.
  for (const id of TROPHY_IDS) { const svg = trophySvg(id), own = new Set(ids(svg)); for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(own.has(ref), `${id}: ${ref}`); }
});
