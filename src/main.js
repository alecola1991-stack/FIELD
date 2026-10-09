import { UI } from './ui/UI.js';
import { Game } from './game/Game.js';
import { Sound } from './game/Sound.js';
import { AccountService } from './account/AccountService.js';
import { OnlineMatch } from './game/OnlineMatch.js';

const accountService = new AccountService();
let initialUser = null;
try { initialUser = await accountService.restoreSession(); } catch { /* The game remains available offline without an account. */ }
const ui = new UI(initialUser);
const sound = new Sound(() => ui.settings);
const onlineMatch = new OnlineMatch(accountService.getRealtimeClient());
const game = new Game(document.querySelector('#game-canvas'), ui.settings, sound, {
  onScore: (player, bot) => { ui.updateScore(player, bot); ui.saveCurrentCompetition(); },
  onTime: time => ui.updateTime(time),
  onCountdown: value => ui.showCountdown(value),
  onAutosave: () => ui.saveCurrentCompetition(),
  onPowerCooldown: seconds => ui.updatePowerCooldown(seconds),
  onGoal: side => { ui.goal(); ui.recordGoal(side); },
  onMatchEnd: result => ui.handleMatchEnd(result),
  getRemoteInput: () => onlineMatch.getRemoteInput(),
  onOnlineInput: input => onlineMatch.sendInput(input),
  onOnlineSnapshot: snapshot => onlineMatch.sendSnapshot(snapshot),
});
ui.attach(game, sound, accountService, onlineMatch);
