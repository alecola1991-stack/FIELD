import test from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, rankFor, rankProgress, rankJourney } from '../src/config/ranks.js';
import { rankIconSvg } from '../src/ui/RankIcon.js';

test('ELO tiers: Amateur from the start, then Profesional 550, Experto 600, Campeón 750, Leyenda 800', () => {
  const at = elo => rankFor(elo).name;
  assert.deepEqual([420, 500, 549, 550, 599, 600, 749, 750, 799, 800, 1200].map(at),
    ['Amateur', 'Amateur', 'Amateur', 'Profesional', 'Profesional', 'Experto', 'Experto', 'Campeón', 'Campeón', 'Leyenda', 'Leyenda']);
  assert.equal(rankFor(undefined).name, 'Amateur');
});

test('the progress bar runs from the tier floor to the next tier', () => {
  assert.equal(rankProgress(500).ratio, 0); assert.equal(rankProgress(525).ratio, .5); assert.equal(rankProgress(470).ratio, 0, 'below 500 the bar stays empty');
  assert.deepEqual([rankProgress(675).ratio, rankProgress(675).to, rankProgress(675).next.name], [.5, 750, 'Campeón']);
  assert.deepEqual([rankProgress(900).ratio, rankProgress(900).next], [1, null], 'Leyenda shows a full bar');
});

test('the animation journey fills, switches tier and continues; or empties and drops', () => {
  const ids = steps => steps.map(step => `${step.rank.id}:${step.from.toFixed(2)}→${step.to.toFixed(2)}${step.change ? `:${step.change}` : ''}`);
  assert.deepEqual(ids(rankJourney(516, 532)), ['amateur:0.32→0.64']);
  assert.deepEqual(ids(rankJourney(545, 561)), ['amateur:0.90→1.00:up', 'profesional:0.00→0.22']);
  assert.deepEqual(ids(rankJourney(561, 545)), ['profesional:0.22→0.00:down', 'amateur:1.00→0.90']);
  assert.deepEqual(ids(rankJourney(540, 610)), ['amateur:0.80→1.00:up', 'profesional:0.00→1.00:up', 'experto:0.00→0.07']);
  assert.deepEqual(ids(rankJourney(790, 806)), ['campeon:0.80→1.00:up', 'leyenda:0.00→1.00']);
});

test('each tier has its own badge', () => {
  const svgs = RANKS.map(rank => rankIconSvg(rank, 20));
  assert.equal(new Set(svgs).size, RANKS.length);
  for (const [index, svg] of svgs.entries()) assert.match(svg, new RegExp(`rank-${RANKS[index].id}`));
  assert.match(rankIconSvg(805), /rank-leyenda/);
});
