import test from 'node:test';
import assert from 'node:assert/strict';
import { BotAI } from '../src/game/BotAI.js';

test('five-star opponents react and move faster than one-star opponents', () => {
  const low = new BotAI('normal'), high = new BotAI('normal');
  low.setTeamStrength(1); high.setTeamStrength(5);
  const bot = { x: 760, y: 300, radius: 18, maxSpeed: 280, shotCooldown: 0 };
  const player = { x: 300, y: 300, radius: 18 };
  const ball = { x: 520, y: 300, vx: 0, vy: 0, radius: 10 };
  const lowMove = low.update({ ...bot }, ball, player, 0.01);
  const highMove = high.update({ ...bot }, ball, player, 0.01);
  assert.ok(high.thinkTimer < low.thinkTimer);
  assert.ok(highMove.speedMultiplier > lowMove.speedMultiplier);
});
