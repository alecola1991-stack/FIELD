import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGEND_MATCHES, resolveLegendMatch } from '../src/config/legends.js';
import { BOT_LEVELS } from '../src/config/settings.js';
import { getTeamById } from '../src/config/teams.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { Ball } from '../src/game/Ball.js';

test('six historical matchups contain existing teams and let either side be chosen', () => {
  assert.equal(LEGEND_MATCHES.length, 6);
  for (const match of LEGEND_MATCHES) {
    assert.equal(new Set(match.teams).size, 2);
    assert.ok(match.teams.every(id => getTeamById(id)));
    for (const id of match.teams) {
      const choice = resolveLegendMatch(match.id, id, 7);
      assert.equal(choice.playerTeam.id, id);
      assert.ok(match.teams.includes(choice.opponentTeam.id));
      assert.notEqual(choice.playerTeam.id, choice.opponentTeam.id);
      assert.equal(choice.difficulty, 'legend');
    }
  }
});

test('Legends is locked below level seven and rejects teams outside the selected match', () => {
  const match = LEGEND_MATCHES[0];
  assert.throws(() => resolveLegendMatch(match.id, match.teams[0], 6), /nivel 7/);
  assert.throws(() => resolveLegendMatch(match.id, match.teams[0], undefined), /nivel 7/);
  assert.throws(() => resolveLegendMatch(match.id, 'premier-arsenal', 7), /dos equipos/);
});

test('Legends forces its higher AI level even when preferences or match options say easy', () => {
  const game = Object.create(Game.prototype);
  game.settings = { name: 'PLAYER', number: 10, teamId: 'laliga-barcelona', difficulty: 'easy' };
  game.state = new GameState(); game.botAI = new BotAI('easy');
  game.input = { down: new Set(), pressed: new Set() }; game.ball = new Ball(0, 0); game.hooks = {}; game.raf = 1;
  game.start('legends', 'easy', { opponentTeam: getTeamById('laliga-real-madrid') });
  assert.equal(game.botAI.difficulty, 'legend');
  assert.equal(game.settings.difficulty, 'easy');
  game.updateSettings({ ...game.settings, difficulty: 'normal' });
  assert.equal(game.botAI.difficulty, 'legend');
  assert.equal(game.goalTarget, 5);
  assert.ok(BOT_LEVELS.legend.speed > BOT_LEVELS.hard.speed);
  assert.ok(BOT_LEVELS.legend.reaction < BOT_LEVELS.hard.reaction);
  assert.ok(BOT_LEVELS.legend.accuracy > BOT_LEVELS.hard.accuracy);
});
