import test from 'node:test';
import assert from 'node:assert/strict';
import { ballStyleFor, BALL_YELLOW } from '../src/game/BallStyles.js';

test('the match ball depends on the competition', () => {
  assert.deepEqual(ballStyleFor('arcade', 'bot'), { type: 'plain', base: BALL_YELLOW });
  assert.equal(ballStyleFor('arcade', 'online').type, 'online');
  assert.equal(ballStyleFor('arcade', 'online').base, '#FFFFFF');
  assert.deepEqual(ballStyleFor('champions', 'tournament'), { type: 'stars', base: '#FFFFFF', color: '#1C4FB8' });
  assert.deepEqual(ballStyleFor('copa-libertadores', 'tournament').stripes, ['#111111', '#111111']);
  assert.equal(ballStyleFor('world-cup', 'tournament').stripes.length, 3);
  const spain = ballStyleFor('league-segunda-rfef-2', 'league'), brazil = ballStyleFor('league-brasileirao-c', 'league');
  assert.equal(spain.base, BALL_YELLOW); assert.equal(spain.stripes.length, 2); assert.notDeepEqual(spain.stripes, brazil.stripes);
});
