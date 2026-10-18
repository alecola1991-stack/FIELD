import { readAuthRedirectError, cleanAuthUrl } from '../account/AuthErrors.js';
import { rankBadge, rankIconSvg } from './RankIcon.js';
import { ProfileSocial } from './ProfileSocial.js';
import { rankFor, rankJourney, rankProgress, rankIndex, RANKS } from '../config/ranks.js';
import { selectionFor, cycleTeamSelection, teamAbbreviation } from './TeamSelection.js';
import { GamepadController } from '../game/GamepadController.js';
import { OnlineHub } from './OnlineHub.js';
import { MODIFIER_OPTIONS, DEFAULT_MODIFIERS, normalizeModifiers, modifiersAreDefault, formatModifier } from '../config/modifiers.js';
import { loadSettings, saveSettings, setSettingsScope, DIFFICULTIES, difficultyLabel, difficultyForStars, starXpMultiplier } from '../config/settings.js';
import { Progression } from '../game/Progression.js';
import { CareerProfile } from '../game/CareerProfile.js';
import { TROPHY_CATALOG, formatPlayTime } from '../game/Achievements.js';
import { TEAM_LEAGUES, NATIONAL_GROUPS, TEAM_GROUPS, TEAM_CLUB_GROUPS, TEAM_COUNTRIES, PROFILE_TEAMS, TEAMS, getTeamById, getKitBackground, dorsalStyle } from '../config/teams.js';
import { CUP_COMPETITIONS, createChampionsDraw, createInternationalDraw, createLibertadoresDraw, createClubWorldCupDraw, isLibertadoresEligibleTeam, isClubWorldCupEligibleTeam, createLeagueSchedule, createLeagueStandings, updateLeagueStandings, sortLeagueStandings, pickChampionsOpponent, createBracket, playBracketRound, simulateRemainingBracket, bracketOpponent, bracketChampion } from '../game/Competitions.js';
import { MenuBackdrop } from './MenuBackdrop.js';
import { Confetti } from './Confetti.js';
import { clearCompetitionSave, loadCompetitionSave, setCompetitionSaveScope, storeCompetitionSave } from '../game/CompetitionSave.js';
import { MISSION_TIERS } from '../game/Missions.js';
import { Ads } from './Ads.js';
import { TROPHY_ART } from './TrophyArt.js';
import { CareerScreen } from './CareerScreen.js';
import { ProgressScreen, isProgressTrophy } from './ProgressScreen.js';
import { computeProgress, progressId, CAREER_MILESTONES } from '../game/GameProgress.js';
import { setCareerScope, loadCareer, saveCareer, nextCareerMatch, recordCareerMatch, careerLeagueOf, loadCareerBest, CAREER_GOAL_TARGET, CAREER_SEASONS, COMPETITION_NAMES } from '../game/CareerMode.js';
import { LEGEND_MATCHES, LEGENDS_UNLOCK_LEVEL, resolveLegendMatch } from '../config/legends.js';

const ROUND_NAMES = ['OCTAVOS DE FINAL', 'CUARTOS DE FINAL', 'SEMIFINAL', 'FINAL'];
const ROUND_NAMES_32 = ['DIECISÉISAVOS DE FINAL', ...ROUND_NAMES];
const roundName = (size, round) => (size === 32 ? ROUND_NAMES_32 : ROUND_NAMES)[Math.max(0, Math.min(size === 32 ? 4 : 3, round - 1))];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// Result screen text once the two league key matches are played.
function leagueResultText(state) {
  const wins = state.plan.stages.find(stage => stage.id === 'league').matches.filter(item => item.result?.won).length;
  const last = state.phase === 'summary' ? state.history.at(-1) : null;
  if (last) return {
    champion: { title: '¡Campeones de liga!', copy: `+100 puntos${last.promoted ? ' y ascenso (+50)' : ''}.` },
    'runner-up': { title: last.promoted ? '¡Ascenso!' : 'Subcampeones', copy: last.promoted ? 'Segundo puesto: subes de división (+50).' : 'Segundo puesto en la liga.' },
    'playoff-won': { title: last.promoted ? '¡Promoción ganada!' : 'Tercer puesto', copy: last.promoted ? 'Subes de división tras la promoción (+50).' : 'Buena temporada.' },
    'playoff-lost': { title: 'Promoción perdida', copy: 'Te quedas a las puertas del ascenso.' },
    mid: { title: 'Mitad de tabla', copy: 'Una victoria, pero la diferencia de goles no alcanza.' },
    low: { title: 'Temporada difícil', copy: 'Sin victorias en los partidos clave. Sigues en la misma división.' },
  }[last.outcome] || { title: 'Fin de la liga', copy: '' };
  return wins === 2 ? { title: '¡Liga ganada!', copy: 'Campeón: el título se suma al final de la temporada.' } : { title: 'Liga terminada', copy: 'Ahora tocan las copas de la temporada.' };
}

export class UI {
  constructor(initialUser = null) {
    this.pendingGuestMigration = initialUser ? readGuestProfile() : null;
    this.user = initialUser; this.accountService = null; this.accountMode = 'login'; this.accountSyncTimer = 0; this.lastAccountSync = 0; this.accountSyncBusy = false;
    const storageScope = initialUser?.id || 'guest'; setSettingsScope(storageScope); setCompetitionSaveScope(storageScope); setCareerScope(storageScope);
    this.settings = loadSettings(); this.progression = new Progression(storageScope); this.career = new CareerProfile(storageScope); this.game = null; this.sound = null;
    if (this.career.stats.matches === 0 && this.career.stats.wins === 0 && this.progression.wins > 0) this.career.ensureProgressionWins(this.progression.wins);
    this.tournament = null; this.league = null; this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.pendingLeagueId = ''; this.selectedCompetition = 'champions'; this.competitionIndex = 0; this.selectedTeamId = ''; this.teamCursor = new Map();
    this.currentMatchMode = null; this.currentMatchOptions = null; this.autoMatchmaking = false; this.confetti = new Confetti();
    this.activeLeague = TEAM_LEAGUES[0].id;
    this.activeCountry = TEAM_COUNTRIES[0].id;
    this.quickChoices = { player: '', rival: 'laliga-real-madrid' }; this.quickDifficulty = this.settings.difficulty;
    this.legendIndex = 0; this.legendTeamId = '';
    this.screens = {
      home: document.querySelector('#home-screen'), play: document.querySelector('#play-screen'), customize: document.querySelector('#customize-screen'),
      settings: document.querySelector('#settings-screen'), account: document.querySelector('#account-screen'), online: document.querySelector('#online-screen'), leaderboard: document.querySelector('#leaderboard-screen'), competitions: document.querySelector('#competition-screen'), tournament: document.querySelector('#tournament-screen'),
      league: document.querySelector('#league-screen'), game: document.querySelector('#game-screen'), profile: document.querySelector('#profile-screen'),
      missions: document.querySelector('#missions-screen'), career: document.querySelector('#career-screen'), progress: document.querySelector('#progress-screen'),
      modifiers: document.querySelector('#modifiers-screen'), quick: document.querySelector('#quick-screen'), legends: document.querySelector('#legends-screen'),
    };
    this.cacheElements(); this.menuBackdrop = new MenuBackdrop(this.menu_backdrop); this.populateTeamPicker(); this.populateLeagueCompetitions(); this.fillInputs(); this.bind(); this.careerScreen = new CareerScreen(this); this.careerScreen.renderHomeStatus(); this.progressScreen = new ProgressScreen(this); this.backfillProgress(); this.progressScreen.renderHome(); this.renderDifficultyMode(); this.renderGameplay();
    document.querySelectorAll('[data-gameplay]').forEach(button => button.addEventListener('click', () => { this.sound?.play('click'); this.setGameplay(button.dataset.gameplay); })); this.renderSoloFormat(); this.updateLeaguePreview(); this.renderProgress(); this.show('home'); this.refreshContinueButton();
  }

  cacheElements() {
    const ids = [
      'player-name','player-number','preview-name','preview-number','preview-ball','preview-team','saved-note','save-player',
      'difficulty','play-difficulty','settings-difficulty','sound-enabled','volume','volume-value','score','timer','hud-player-name','hud-opponent-name','player-dot','opponent-dot',
      'goal-banner','countdown-banner','pause-overlay','result-overlay','rank-overlay','result-eyebrow','result-title','result-copy','result-xp','result-level','result-xp-fill',
      'result-next','result-finish','result-rematch-status','result-scoreboard','result-home-crest','result-home-team','result-home-player','result-home-goals','result-away-crest','result-away-team','result-away-player','result-away-goals','result-score','result-duration','result-timeline','tournament-bracket-panel','tournament-bracket-title','tournament-bracket','result-rematch','result-online-status','result-stats','result-stat-duration','result-stat-goals','result-stat-shots','result-trophy','result-season-summary','league-standings-panel','league-standings-title','league-standings-body','connection-banner','replay-banner','replay-status','replay-skip','leaderboard-message','leaderboard-list','leaderboard-refresh','training-tools','trajectory-toggle','mode-label','game-canvas','level-value','xp-label','wins-label','xp-fill','missions-list',
      'team-position','league-competition','league-competition-summary','country-tabs','countries-prev','countries-next','country-position','league-tabs','team-grid','teams-prev','teams-next','chosen-team-label','tournament-roster',
      'competition-trophy','competition-eyebrow','competition-title','competition-description','competition-dots','competition-select','competition-prev','competition-next',
      'competition-picker-card',
      'tournament-header-tag','tournament-eyebrow','tournament-title','tournament-description','tournament-emblem','tournament-team-count',
      'account-status','account-status-dot','account-message','account-form','account-name','account-name-wrap','account-email','account-password','account-submit','account-form-title','account-dashboard','account-auth-panel','account-email-label','account-sync-state','account-level','account-wins','account-matches','account-goals','account-conceded','account-seasons','account-trophy-count','account-trophies',
      'profile-eyebrow','profile-title','profile-copy','home-club-colors','home-club-name','play-continue-wrap',
      'menu-backdrop','modifier-controls','modifiers-back','modifiers-done','modifiers-reset','modifiers-note','modifier-summary',
      'match-intro','online-player-details','online-opponent-details','quick-pickers','quick-difficulty','quick-start','legends-mode-card','legends-mode-tag','legends-lock','legend-prev','legend-next','legend-title','legend-edition','legend-position','legend-history','legend-teams','legend-start',
      'continue-competition','continue-detail','league-goal-target','trajectory-enabled','shot-preview-enabled','shot-power-time',
      
      'online-room-input','online-room-panel','online-status','online-room-code-wrap','online-room-code',
      'online-find-match','online-cancel',
      'career-avatar','career-team-label','career-name','career-subtitle','career-level','career-xp','career-xp-fill','career-matches','career-wins','career-winrate','career-goals','career-best','career-time','career-seasons','trophy-summary','trophy-percent','trophy-progress-fill','trophy-grid','trophy-detail','trophy-toast','trophy-toast-name',
    ];
    for (const id of ids) this[id.replaceAll('-', '_')] = document.getElementById(id);
  }

  attach(game, sound, accountService = null, onlineMatch = null) {
    this.game = game; this.game.input.enabled = this.currentView === 'game' && !game.state.paused; this.sound = sound; this.accountService = accountService;
    this.onlineMatch = onlineMatch;
    this.hub = new OnlineHub(this);
    this.social = new ProfileSocial(this);
    this.controller = new GamepadController(this);
    this.sound.setScene?.(this.currentView === 'game' ? 'game' : 'menu');
    if (onlineMatch) onlineMatch.setHandlers({
      onStatus: (status, detail) => this.updateOnlineStatus(status, detail),
      onMatchStart: info => this.startOnlineMatch(info),
      onInput: input => game.setRemoteInput(input),
      onSnapshot: snapshot => game.applyOnlineSnapshot(snapshot),
      onPeerLeft: () => this.handleOnlinePeerLeft(),
      onPeerReconnecting: seconds => this.showConnectionStatus(seconds),
      onPeerReconnected: () => this.hideConnectionStatus(),
      onRematchRequested: () => this.showRematchRequest(),
      onReplaySkip: seat => game.setRemoteReplaySkip(seat),
      getResume: () => this.onlineResume(),
    });
    // Guests: warn when the host stops sending the match (bad connection or app in the background).
    this.hostStallTimer = setInterval(() => this.checkHostStall(), 1000);
    if (this.user && accountService) this.activateAccount(this.user).catch(error => this.setAccountMessage(error.message, true));
    else this.renderAccount();
    // Back from Google with an error (cancelled, expired…): explain it on the account screen.
    const redirectError = readAuthRedirectError(window.location);
    if (redirectError) {
      try { history.replaceState(null, '', cleanAuthUrl(window.location)); } catch { /* keep the address as is */ }
      if (!this.user) { this.show('account'); this.setAccountMessage(redirectError.message, true); }
    }
  }

  populateTeamPicker() {
    this.country_tabs.replaceChildren(...TEAM_COUNTRIES.map(country => {
      const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'country-tab';
      tab.dataset.country = country.id; tab.textContent = country.label;
      tab.setAttribute('aria-pressed', 'false'); return tab;
    }));
    this.renderTeamNavigation();
    this.renderTeamCarousel();
    this.renderCompetitionPicker();
  }

  getAllowedTeamGroups() {
    if (this.pendingMode === 'legend-profile') return TEAM_GROUPS.filter(group => group.id === getTeamById(this.legendTeamId)?.league);
    if (this.pendingLeagueId === 'south-america-clubs') return TEAM_GROUPS.filter(group => ['argentina', 'brasileirao'].includes(group.id));
    if (this.pendingLeagueId === 'club-world-cup-clubs') return TEAM_CLUB_GROUPS.filter(group => PROFILE_TEAMS.some(team => team.league === group.id && isClubWorldCupEligibleTeam(team.id)));
    if (this.pendingLeagueId) return TEAM_GROUPS.filter(group => group.id === this.pendingLeagueId);
    if (this.pendingTeamType === 'club') return TEAM_CLUB_GROUPS;
    if (this.pendingTeamType === 'national') return NATIONAL_GROUPS;
    return TEAM_GROUPS;
  }

  getProfileTeams(leagueId = this.activeLeague) {
    const teams = PROFILE_TEAMS.filter(team => team.league === leagueId);
    if (this.pendingMode === 'legend-profile') return teams.filter(team => team.id === this.legendTeamId);
    if (this.pendingMode !== 'tournament') return teams;
    if (this.pendingCompetition === 'copa-libertadores') return teams.filter(team => isLibertadoresEligibleTeam(team.id));
    if (this.pendingCompetition === 'club-world-cup') return teams.filter(team => isClubWorldCupEligibleTeam(team.id));
    return teams;
  }

  renderTeamNavigation() {
    const allowedIds = new Set(this.getAllowedTeamGroups().map(group => group.id));
    const countries = TEAM_COUNTRIES.filter(country => country.groups.some(groupId => allowedIds.has(groupId)));
    if (!countries.some(country => country.id === this.activeCountry)) this.activeCountry = countries[0]?.id || '';
    const countryIndex = countries.findIndex(country => country.id === this.activeCountry);
    this.country_position.textContent = `${countryIndex + 1} / ${countries.length}`;
    this.countries_prev.disabled = this.countries_next.disabled = countries.length < 2;
    for (const tab of this.country_tabs.querySelectorAll('[data-country]')) {
      const country = TEAM_COUNTRIES.find(item => item.id === tab.dataset.country);
      const visible = country?.groups.some(groupId => allowedIds.has(groupId));
      tab.hidden = !visible || tab.dataset.country !== this.activeCountry;
      const active = tab.dataset.country === this.activeCountry;
      tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active));
    }
    const country = TEAM_COUNTRIES.find(item => item.id === this.activeCountry) || TEAM_COUNTRIES[0];
    const groups = TEAM_GROUPS.filter(group => country.groups.includes(group.id) && allowedIds.has(group.id));
    if (!groups.some(group => group.id === this.activeLeague)) this.activeLeague = groups[0]?.id || '';
    document.getElementById('leagues-prev').disabled = document.getElementById('leagues-next').disabled = groups.length < 2;
    this.league_tabs.replaceChildren(...groups.map(group => {
      const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'league-tab';
      tab.dataset.league = group.id; tab.textContent = group.label.split(' · ')[0];
      tab.hidden = group.id !== this.activeLeague; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false'); return tab;
    }));
    for (const tab of this.league_tabs.querySelectorAll('[data-league]')) {
      const active = tab.dataset.league === this.activeLeague;
      tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active));
    }
  }

  moveLeague(direction) {
    const country = TEAM_COUNTRIES.find(item => item.id === this.activeCountry);
    const groups = this.getAllowedTeamGroups().filter(group => country?.groups.includes(group.id));
    if (!groups.length) return;
    const index = groups.findIndex(group => group.id === this.activeLeague);
    this.activeLeague = groups[(index + direction + groups.length) % groups.length].id;
    this.renderTeamNavigation(); this.renderTeamCarousel(); this.sound?.play('click');
  }

  moveCountry(direction) {
    const allowedIds = new Set(this.getAllowedTeamGroups().map(group => group.id));
    const countries = TEAM_COUNTRIES.filter(country => country.groups.some(groupId => allowedIds.has(groupId)));
    if (!countries.length) return;
    const index = countries.findIndex(country => country.id === this.activeCountry);
    this.selectTeamCountry(countries[(index + direction + countries.length) % countries.length].id);
  }

  selectTeamCountry(countryId) {
    const country = TEAM_COUNTRIES.find(item => item.id === countryId);
    if (!country || !country.groups.some(id => this.getAllowedTeamGroups().some(group => group.id === id))) return;
    this.activeCountry = country.id;
    const allowedIds = new Set(this.getAllowedTeamGroups().map(group => group.id));
    if (!country.groups.includes(this.activeLeague) || !allowedIds.has(this.activeLeague)) {
      this.activeLeague = country.groups.find(id => allowedIds.has(id)) || '';
    }
    this.renderTeamNavigation(); this.renderTeamCarousel(); this.sound?.play('click');
  }

  populateLeagueCompetitions() {
    this.league_competition.replaceChildren();
    for (const league of TEAM_LEAGUES) {
      const option = document.createElement('option'); option.value = league.id;
      option.textContent = league.label.split(' · ')[0]; this.league_competition.append(option);
    }
    if (!TEAM_LEAGUES.some(league => league.id === this.settings.leagueCompetition)) {
      this.settings.leagueCompetition = TEAM_LEAGUES[0].id;
    }
    this.league_competition.value = this.settings.leagueCompetition;
  }

  fillInputs() {
    this.settings.teamId = getTeamById(this.settings.teamId)?.id || '';
    this.selectedTeamId = this.settings.teamId;
    this.activeLeague = getTeamById(this.selectedTeamId)?.league || TEAM_LEAGUES[0].id;
    this.activeCountry = TEAM_COUNTRIES.find(country => country.groups.includes(this.activeLeague))?.id || TEAM_COUNTRIES[0].id;
    if (this.selectedTeamId) {
      const index = PROFILE_TEAMS.filter(team => team.league === this.activeLeague).findIndex(team => team.id === this.selectedTeamId);
      if (index >= 0) this.teamCursor.set(this.activeLeague, index);
    }
    this.player_name.value = this.settings.profileReady ? this.settings.name : '';
    this.player_number.value = this.settings.profileReady ? this.settings.number : '';
    this.difficulty.value = this.settings.difficulty; this.settings_difficulty.value = this.settings.difficulty;
    this.sound_enabled.checked = this.settings.sound; this.volume.value = this.settings.volume; this.volume_value.textContent = `${this.settings.volume}%`;
    this.play_difficulty.value = this.settings.difficulty;
    this.trajectory_enabled.checked = !!this.settings.trajectory;
    this.shot_preview_enabled.checked = !!this.settings.shotPreview;
    for(const [id,key,value] of [['music-enabled','musicEnabled',true],['ambience-enabled','ambienceEnabled',true],['controller-vibration','controllerVibration',true],['goal-replays-enabled','goalReplays',true],['vertical-field-enabled','verticalField',true]]) document.getElementById(id).checked=this.settings[key]??value;
    for(const [id,key,value] of [['music-volume','musicVolume',35],['ambience-volume','ambienceVolume',50],['effects-volume','effectsVolume',100]]) { document.getElementById(id).value=this.settings[key]??value;document.getElementById(id+'-value').textContent=(this.settings[key]??value)+'%'; }
    this.league_goal_target.value = String([2, 3, 5].includes(Number(this.settings.leagueGoalTarget)) ? this.settings.leagueGoalTarget : 2);
    this.renderTeamNavigation(); this.renderTeamCarousel(); this.updateProfilePreview(); this.updateHomeClub(); this.updateProfileValidity();
  }

  bind() {
    document.addEventListener('click', event => {
      const option = event.target.closest('[data-solo-format]');
      if (option) { this.sound?.play('click'); this.setSoloFormat(option.dataset.soloFormat); }
    });
    document.addEventListener('change', event => {
      const select = event.target.closest?.('[data-mate-difficulty]');
      if (select) { this.settings.mateDifficulty = select.value; this.persist(); this.renderSoloFormat(); }
    });
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      this.sound?.play('click');
      this.selectMode(button.dataset.action);
    }));
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      this.sound?.play('click');
      if (button.dataset.view === 'customize') { this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.pendingLeagueId = ''; this.openProfile(); }
      else if (button.dataset.view === 'online') this.openOnline();
      else this.show(button.dataset.view);
    }));
    document.getElementById('account-open').addEventListener('click', () => { this.renderAccount(); this.show('account'); });
    document.getElementById('profile-account-open').addEventListener('click', () => { this.renderAccount(); this.show('account'); });
    this.trophy_grid.addEventListener('click', event => {
      const button = event.target.closest('[data-trophy-id]'); if (!button) return;
      this.renderTrophyDetail(button.dataset.trophyId); this.sound?.play('select');
    });
    this.account_form.addEventListener('submit', event => { event.preventDefault(); this.submitAccount(); });
    document.getElementById('online-create-room').addEventListener('click', () => this.createOnlineRoom());
    document.getElementById('online-find-match').addEventListener('click', () => this.findOnlineMatch());
    document.getElementById('online-join-room').addEventListener('click', () => this.joinOnlineRoom());
    document.getElementById('online-cancel').addEventListener('click', () => this.cancelOnlineRoom());
    document.getElementById('online-copy-code').addEventListener('click', () => this.copyOnlineRoomCode());
    this.result_rematch.addEventListener('click', () => this.requestOnlineRematch());
    this.replay_skip.addEventListener('click', () => this.game?.skipReplay());
    this.leaderboard_refresh.addEventListener('click', () => this.loadLeaderboard());
    document.getElementById('account-google').addEventListener('click', () => this.submitGoogleAccount());
    document.getElementById('account-mode-toggle').addEventListener('click', () => this.toggleAccountMode());
    document.getElementById('account-sync-button').addEventListener('click', () => this.syncAccount(true));
    document.getElementById('account-logout').addEventListener('click', () => this.logOut());
    document.getElementById('profile-back').addEventListener('click', () => { this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.pendingLeagueId = ''; this.renderTeamNavigation(); this.show('home'); });
    this.country_tabs.addEventListener('click', event => {
      const tab = event.target.closest('[data-country]'); if (tab) this.selectTeamCountry(tab.dataset.country);
    });
    this.countries_prev.addEventListener('click', () => this.moveCountry(-1));
    this.countries_next.addEventListener('click', () => this.moveCountry(1));
    document.getElementById('leagues-prev').addEventListener('click', () => this.moveLeague(-1));
    document.getElementById('leagues-next').addEventListener('click', () => this.moveLeague(1));
    this.league_tabs.addEventListener('click', event => {
      const tab = event.target.closest('[data-league]'); if (!tab) return;
      this.activeLeague = tab.dataset.league;
      this.activeCountry = TEAM_COUNTRIES.find(country => country.groups.includes(this.activeLeague))?.id || this.activeCountry;
      this.renderTeamNavigation();
      const currentIndex = PROFILE_TEAMS.filter(team => team.league === this.activeLeague).findIndex(team => team.id === this.selectedTeamId);
      if (currentIndex >= 0) this.teamCursor.set(this.activeLeague, currentIndex);
      else if (!this.teamCursor.has(this.activeLeague)) this.teamCursor.set(this.activeLeague, 0);
      this.renderTeamCarousel(); this.sound?.play('click');
    });
    this.team_grid.addEventListener('click', event => {
      const card = event.target.closest('[data-team-id]'); if (card) this.selectTeam(card.dataset.teamId);
    });
    this.teams_prev.addEventListener('click', () => this.moveTeam(-1));
    this.teams_next.addEventListener('click', () => this.moveTeam(1));
    this.quick_pickers.addEventListener('click', event => {
      const button = event.target.closest('[data-quick-move]'); if (!button) return;
      this.moveQuickChoice(button.dataset.side, Number(button.dataset.quickMove), button.dataset.kind);
    });
    for (const button of [this.modifiers_back, this.modifiers_done]) button.addEventListener('click', () => this.closeModifiers());
    this.modifiers_reset.addEventListener('click', () => { if (this.modifierLocked) return; this.modifierValues = { ...DEFAULT_MODIFIERS }; this.saveModifiers(); this.renderModifiers(); });
    document.querySelectorAll('[data-modifier-preset]').forEach(button => button.addEventListener('click', () => { if (this.modifierLocked) return; this.modifierValues = { ...DEFAULT_MODIFIERS, ...(button.dataset.modifierPreset === 'fast' ? { playerSpeed: 1.4, shotPower: 1.2, powerCooldown: 10 } : { ballSize: 1.8, playerSize: .8, goalSize: 1.2 }) }; this.saveModifiers(); this.renderModifiers(); }));
    this.quick_difficulty.addEventListener('change', () => { this.quickDifficulty = this.quick_difficulty.value; });
    this.quick_start.addEventListener('click', () => this.beginQuickMatch());
    this.legend_prev.addEventListener('click', () => this.moveLegend(-1));
    this.legend_next.addEventListener('click', () => this.moveLegend(1));
    this.legend_teams.addEventListener('click', event => {
      const choice = event.target.closest('[data-legend-team]');
      if (choice && this.progression.level >= LEGENDS_UNLOCK_LEVEL) { this.legendTeamId = choice.dataset.legendTeam; this.renderLegends(); }
    });
    this.legend_start.addEventListener('click', () => this.beginLegendMatch());
    this.player_name.addEventListener('input', () => { this.updateProfilePreview(); this.updateProfileValidity(); });
    this.player_number.addEventListener('input', () => { this.updateProfilePreview(); this.updateProfileValidity(); });
    document.getElementById('save-player').addEventListener('click', () => this.savePlayer());
    for (const select of [this.difficulty, this.play_difficulty, this.settings_difficulty]) select.addEventListener('change', () => { this.settings.difficulty = select.value; this.updateDifficultyControls(); this.persist(); });
    this.shot_preview_enabled.addEventListener('change', () => { this.settings.shotPreview = this.shot_preview_enabled.checked; this.persist(); });
    this.trajectory_enabled.addEventListener('change', () => {
      this.settings.trajectory = this.trajectory_enabled.checked; this.trajectory_toggle.checked = this.settings.trajectory;
      this.persist();
    });
    for(const [id,key] of [['music-enabled','musicEnabled'],['ambience-enabled','ambienceEnabled'],['controller-vibration','controllerVibration'],['goal-replays-enabled','goalReplays'],['vertical-field-enabled','verticalField']]) document.getElementById(id).addEventListener('change',event=>{this.settings[key]=event.target.checked;this.persist();this.sound?.tick?.();});
    document.querySelector('.settings-tabs').addEventListener('click', event => {
      const tab = event.target.closest('[data-settings-tab]'); if (tab) { this.showSettingsTab(tab.dataset.settingsTab); this.sound?.play('click'); }
    });
    document.querySelector('.settings-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const tabs = [...document.querySelectorAll('[data-settings-tab]')], index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault(); const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      this.showSettingsTab(next.dataset.settingsTab); next.focus();
    });
    this.showSettingsTab('game');
    const fullscreen = document.getElementById('fullscreen-toggle');
    document.getElementById('fullscreen-line').hidden = !document.fullscreenEnabled;
    const syncFullscreen = () => { fullscreen.textContent = document.fullscreenElement ? 'Salir' : 'Activar'; };
    fullscreen.addEventListener('click', () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())?.catch?.(() => {}); });
    document.addEventListener('fullscreenchange', syncFullscreen); syncFullscreen();
    for(const [id,key] of [['music-volume','musicVolume'],['ambience-volume','ambienceVolume'],['effects-volume','effectsVolume']]) document.getElementById(id).addEventListener('input',event=>{this.settings[key]=Number(event.target.value);document.getElementById(id+'-value').textContent=event.target.value+'%';this.persist();this.sound?.tick?.();});
    document.getElementById('music-next').addEventListener('click',()=>{this.sound?.unlock?.();this.sound?.nextTrack?.();});
    document.getElementById('controller-remap').addEventListener('click',()=>this.controller?.startMapping());
    document.getElementById('controller-reset').addEventListener('click',()=>this.controller?.resetMapping());
    this.sound_enabled.addEventListener('change', () => { this.settings.sound = this.sound_enabled.checked; this.persist(); });
    this.volume.addEventListener('input', () => { this.settings.volume = Number(this.volume.value); this.volume_value.textContent = `${this.settings.volume}%`; this.persist(); });
    document.getElementById('league-country-tabs').addEventListener('click', event => {
      const tab = event.target.closest('[data-league-country]'); if (!tab) return;
      this.leaguePickerCountry = tab.dataset.leagueCountry; this.renderLeaguePicker(); this.sound?.play('click');
      if (window.matchMedia?.('(max-width: 900px)').matches) document.getElementById('league-picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('league-options').addEventListener('click', event => {
      const option = event.target.closest('[data-league-option]'); if (option) this.selectLeagueOption(option.dataset.leagueOption);
    });
    this.league_competition.addEventListener('change', () => {
      this.settings.leagueCompetition = this.league_competition.value; this.persist(); this.updateLeaguePreview();
    });
    this.league_goal_target.addEventListener('change', () => { this.settings.leagueGoalTarget = Number(this.league_goal_target.value) || 2; this.persist(); });
    this.continue_competition.addEventListener('click', () => this.resumeCompetition());
    document.getElementById('tournament-start').addEventListener('click', () => this.beginTournament());
    document.getElementById('league-start').addEventListener('click', () => this.beginLeague());
    this.competition_prev.addEventListener('click', () => this.moveCompetition(-1));
    this.competition_next.addEventListener('click', () => this.moveCompetition(1));
    this.competition_select.addEventListener('click', () => this.chooseCompetition());
    document.getElementById('competition-grid')?.addEventListener('click', event => {
      const tile = event.target.closest('[data-competition-index], [data-competition-team]'); if (!tile) return;
      this.sound?.play('click');
      if (tile.dataset.competitionTeam) { this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.pendingLeagueId = ''; this.openProfile(); return; }
      this.competitionIndex = Number(tile.dataset.competitionIndex); this.renderCompetitionPicker(); this.chooseCompetition();
    });
    document.getElementById('pause-button').addEventListener('click', () => this.pause(true));
    document.getElementById('resume-button').addEventListener('click', () => this.pause(false));
    document.getElementById('quit-button').addEventListener('click', () => this.saveAndQuit());
    this.result_next.addEventListener('click', () => this.advanceCompetition());
    this.result_finish.addEventListener('click', () => this.finishToMenu());
    document.getElementById('rank-continue').addEventListener('click', () => this.hideRankProgress());
    const ranksOverlay = document.getElementById('ranks-overlay'), closeRanks = () => ranksOverlay.classList.add('hidden');
    document.getElementById('ranks-close').addEventListener('click', closeRanks); document.getElementById('ranks-done').addEventListener('click', closeRanks);
    ranksOverlay.addEventListener('click', event => { if (event.target === ranksOverlay) closeRanks(); });
    ranksOverlay.addEventListener('keydown', event => { if (event.key === 'Escape') closeRanks(); });
    this.rank_overlay.addEventListener('keydown', event => { if (event.key === 'Escape') this.hideRankProgress(); });
    document.getElementById('reset-ball').addEventListener('click', () => this.game.resetBall());
    document.getElementById('reset-player').addEventListener('click', () => this.game.resetPlayer());
    this.trajectory_toggle.addEventListener('change', () => {
      this.settings.trajectory = this.trajectory_toggle.checked; this.trajectory_enabled.checked = this.settings.trajectory;
      this.game.trajectory = this.settings.trajectory; this.persist();
    });
    // Between competition matches, Space plays the next one (ignoring the shot key still pressed when the match ended).
    window.addEventListener('keydown', e => {
      if (e.code !== 'Space' || e.repeat || this.currentView !== 'game' || this.result_overlay.classList.contains('hidden')) return;
      if (this.result_next.classList.contains('hidden') || this.result_next.disabled || performance.now() - (this.resultShownAt || 0) < 800) return;
      if (e.target?.closest?.('input,textarea,select')) return;
      e.preventDefault(); this.result_next.click();
    });
    window.addEventListener('keydown', e => { if (e.code !== 'Escape') return; if (this.currentView === 'modifiers') { e.preventDefault(); this.closeModifiers(); } else if (this.currentView === 'game' && this.game?.state.running) { e.preventDefault(); this.pause(!this.game.state.paused); } });
    window.addEventListener('pagehide', () => { this.saveCurrentCompetition(); this.syncAccount(true); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { this.saveCurrentCompetition(); this.syncAccount(true); } });
  }

  showSettingsTab(name) {
    for (const tab of document.querySelectorAll('[data-settings-tab]')) {
      const active = tab.dataset.settingsTab === name;
      tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of document.querySelectorAll('[data-settings-panel]')) panel.hidden = panel.dataset.settingsPanel !== name;
  }

  toggleAccountMode() {
    this.accountMode = this.accountMode === 'login' ? 'signup' : 'login';
    const signup = this.accountMode === 'signup';
    this.account_name_wrap.classList.toggle('hidden', !signup);
    this.account_password.autocomplete = signup ? 'new-password' : 'current-password';
    this.account_form_title.textContent = signup ? 'Crear cuenta' : 'Inicia sesión';
    this.account_submit.innerHTML = signup ? 'Crear cuenta <span>↗</span>' : 'Entrar <span>↗</span>';
    document.getElementById('account-mode-toggle').textContent = signup ? 'Ya tengo cuenta · Iniciar sesión' : '¿Primera vez? Crear cuenta';
    this.setAccountMessage(signup ? 'Crea tu cuenta y entra directamente, sin confirmar el correo.' : 'El progreso local seguirá disponible sin cuenta.');
  }

  async submitGoogleAccount() {
    const button = document.getElementById('account-google');
    if (button.disabled) return;
    button.disabled = true; this.account_submit.disabled = true;
    this.setAccountMessage('Conectando con Google…');
    try {
      await this.accountService.signInWithGoogle();
    } catch (error) {
      this.setAccountMessage(error?.message || 'No se pudo conectar con Google. Inténtalo de nuevo.', true);
    } finally {
      button.disabled = false; this.account_submit.disabled = false;
    }
  }

  async submitAccount() {
    if (!this.accountService?.isConfigured) { this.setAccountMessage('Falta configurar Supabase para activar las cuentas. El progreso local sigue disponible.', true); return; }
    const email = this.account_email.value.trim(), password = this.account_password.value;
    // New accounts need 8 characters; signing in only needs the password the account already has.
    if (!this.account_email.checkValidity() || (this.accountMode === 'signup' && (!this.account_name.value.trim() || password.length < 8)) || !password) {
      this.setAccountMessage(this.accountMode === 'signup' ? 'Completa un correo válido, el nombre y una contraseña de 8 caracteres como mínimo.' : 'Escribe tu correo y tu contraseña.', true); return;
    }
    this.account_submit.disabled = true; this.setAccountMessage(this.accountMode === 'signup' ? 'Creando cuenta…' : 'Iniciando sesión…');
    try {
      const signingUp = this.accountMode === 'signup';
      const authResult = signingUp
        ? await this.accountService.signUp(email, password, this.account_name.value.trim())
        : await this.accountService.signIn(email, password);
      // A signup user alone is not proof of authentication: require its session.
      const user = (signingUp ? authResult?.session?.user : authResult?.user)
        || await this.accountService.currentUser();
      if (!user) {
        this.accountMode = 'signup'; this.toggleAccountMode();
        this.setAccountMessage('No se ha podido abrir la sesión. Intenta entrar con tu correo y contraseña.', true);
        return;
      }
      await this.activateAccount(user);
      this.setAccountMessage('Cuenta conectada. Tu progreso ya está sincronizado.', false, true);
      this.account_email.value = ''; this.account_password.value = ''; this.show(this.hub?.identity ? 'account' : 'online');
    } catch (error) {
      this.setAccountMessage(error?.message || 'No se pudo completar el acceso. Comprueba tus datos.', true);
    } finally { this.account_submit.disabled = false; }
  }

  currentCloudProfile() {
    const { cosmetics, ...settings } = this.settings;
    return { settings, progression: this.progression.toJSON(), career: this.career.toJSON(), competitionSave: loadCompetitionSave() };
  }

  async activateAccount(user) {
    if (!user?.id || !this.accountService) return;
    const priorScope = this.user?.id || 'guest';
    const guestProfile = priorScope === 'guest' ? this.currentCloudProfile() : this.pendingGuestMigration;
    this.pendingGuestMigration = null;
    if (priorScope !== user.id) {
      setSettingsScope(user.id); setCompetitionSaveScope(user.id); setCareerScope(user.id); this.careerScreen?.reload();
      this.progression.setScope(user.id); this.career.setScope(user.id); this.settings = loadSettings();
    }
    this.user = user;
    const localProfile = this.currentCloudProfile();
    const result = await this.accountService.fetchProfile();
    const cloud = result.profile;
    if (cloud) {
      this.progression.merge(cloud.progression || {}); this.career.merge(cloud.career || {});
      if (guestProfile) { this.progression.merge(guestProfile.progression || {}); this.career.merge(guestProfile.career || {}); }
      const remoteSettings = cloud.settings || guestProfile?.settings;
      if (remoteSettings) this.settings = { ...this.settings, ...remoteSettings };
      const savedMatch = cloud.competitionSave || localProfile.competitionSave || guestProfile?.competitionSave;
      if (savedMatch) storeCompetitionSave(savedMatch); else clearCompetitionSave();
    } else if (guestProfile) {
      this.progression.merge(guestProfile.progression || {}); this.career.merge(guestProfile.career || {});
      if (!this.settings.profileReady && guestProfile.settings?.profileReady) this.settings = { ...this.settings, ...guestProfile.settings };
      if (!localProfile.competitionSave && guestProfile.competitionSave) storeCompetitionSave(guestProfile.competitionSave);
    }
    delete this.settings.cosmetics;
    saveSettings(this.settings); this.game?.updateSettings(this.settings);
    this.fillInputs(); this.renderProgress(); this.renderAccount(); this.refreshContinueButton();
    await this.syncAccount(true);
    await this.hub?.activate();
  }

  async syncAccount(force = false) {
    if (!this.user || !this.accountService) return false;
    if (this.accountSyncBusy) { if (force) this.accountSyncTimer = window.setTimeout(() => this.syncAccount(true), 700); return false; }
    const wait = 12000 - (Date.now() - this.lastAccountSync);
    if (!force && wait > 0) {
      if (this.accountSyncTimer) clearTimeout(this.accountSyncTimer);
      this.accountSyncTimer = window.setTimeout(() => this.syncAccount(true), wait); return false;
    }
    if (this.accountSyncTimer) { clearTimeout(this.accountSyncTimer); this.accountSyncTimer = 0; }
    this.accountSyncBusy = true; this.account_sync_state.textContent = 'SINCRONIZANDO'; this.account_sync_state.classList.add('syncing');
    try {
      await this.accountService.saveProfile(this.currentCloudProfile()); this.lastAccountSync = Date.now();
      this.account_sync_state.textContent = 'GUARDADO EN LA NUBE'; this.account_sync_state.classList.remove('syncing');
      this.setAccountMessage('Progreso guardado en la nube.', false, true); return true;
    } catch (error) {
      this.account_sync_state.textContent = 'SIN CONEXIÓN'; this.account_sync_state.classList.remove('syncing');
      this.setAccountMessage(error?.message || 'Se conservará el guardado local y se volverá a intentar.', true); return false;
    } finally { this.accountSyncBusy = false; }
  }

  async logOut() {
    if (this.hub?.lobby) { await this.hub.action('leave'); if (this.hub.lobby) return; }
    await this.onlineMatch?.leave(false); this.game?.stop(); this.currentMatchMode = null;
    try { await this.accountService?.signOut(); } catch { /* Local scope still switches even if the network is unavailable. */ }
    if (this.accountSyncTimer) clearTimeout(this.accountSyncTimer);
    this.user = null; this.hub?.reset(); setSettingsScope('guest'); setCompetitionSaveScope('guest'); setCareerScope('guest'); this.careerScreen?.reload();
    this.progression.setScope('guest'); this.career.setScope('guest'); this.settings = loadSettings();
    this.game?.updateSettings(this.settings); this.fillInputs(); this.renderProgress(); this.renderAccount(); this.refreshContinueButton();
    this.setAccountMessage('Has cerrado sesión. Tu guardado local sigue disponible.', false, true);
  }

  renderAccount() {
    const signedIn = !!this.user;
    this.account_status.textContent = signedIn ? (this.user.email || 'Sesión iniciada') : 'Guardado local';
    this.account_status_dot.closest('.account-shortcut')?.classList.toggle('signed-in', signedIn);
    this.account_auth_panel.classList.toggle('hidden', signedIn); this.account_dashboard.classList.toggle('hidden', !signedIn);
    if (!signedIn) return;
    const { stats } = this.career;
    this.account_email_label.textContent = this.user.email || 'Cuenta Fútbol arcade';
    this.account_level.textContent = String(this.progression.level); this.account_wins.textContent = String(stats.wins);
    this.account_matches.textContent = String(stats.matches); this.account_goals.textContent = String(stats.goalsFor + stats.trainingGoals);
    this.account_conceded.textContent = String(stats.goalsAgainst); this.account_seasons.textContent = String(stats.leagueSeasons);
    const shownTrophies = this.career.trophies.filter(trophy => !isProgressTrophy(trophy.id));
    this.account_trophy_count.textContent = String(shownTrophies.length); this.account_trophies.replaceChildren();
    if (!shownTrophies.length) { const empty = document.createElement('span'); empty.className = 'empty-trophies'; empty.textContent = 'Tus copas aparecerán aquí al ganarlas.'; this.account_trophies.append(empty); }
    else for (const trophy of shownTrophies) { const chip = document.createElement('span'); chip.className = 'trophy-chip'; const cup = document.createElement('i'); const title = document.createElement('span'); title.textContent = trophy.name; chip.append(cup, title); this.account_trophies.append(chip); }
  }

  renderProfile() {
    const { stats } = this.career, team = getTeamById(this.settings.teamId);
    const name = this.settings.profileReady && this.settings.name ? this.settings.name.trim() : (this.user?.email?.split('@')[0] || 'Jugador');
    this.career_name.textContent = name;
    this.paintPlayerPreview(this.career_avatar, team, { name: name.slice(0, 10).toUpperCase(), number: this.settings.number });
    this.career_avatar.classList.toggle('gold-dorsal', this.goldUnlocked() && !!this.settings.goldKit);
    this.career_team_label.textContent = team ? `· ${team.name}` : '';
    this.career_subtitle.textContent = this.user ? 'Cuenta conectada · progreso sincronizado' : 'Progreso guardado en este dispositivo';
    this.career_level.textContent = String(this.progression.level);
    this.career_xp.textContent = this.progression.level >= Progression.maxLevel ? 'NIVEL MÁXIMO' : `${this.progression.xp} / ${this.progression.xpForNextLevel()} XP`;
    this.career_xp_fill.style.width = `${this.progression.progressRatio() * 100}%`;
    const ring = document.getElementById('career-level-ring'), circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = `${circumference}`; ring.style.strokeDashoffset = `${circumference * (1 - (this.progression.level >= Progression.maxLevel ? 1 : this.progression.progressRatio()))}`;
    this.career_matches.textContent = String(stats.matches); this.career_wins.textContent = String(stats.wins);
    this.career_winrate.textContent = `${stats.matches ? Math.round(stats.wins / stats.matches * 100) : 0} % de victorias`;
    this.career_goals.textContent = String(stats.goalsFor); this.career_best.textContent = String(stats.bestScore);
    this.career_time.textContent = formatPlayTime(stats.timePlayedSeconds); this.career_seasons.textContent = String(stats.leagueSeasons);
    // Visual summary: win-rate ring, averages and balance bars.
    const winRate = stats.matches ? stats.wins / stats.matches : 0, winRing = document.getElementById('career-winrate-ring'), small = 2 * Math.PI * 18;
    winRing.style.strokeDasharray = `${small}`; winRing.style.strokeDashoffset = `${small * (1 - winRate)}`;
    document.getElementById('career-goal-average').textContent = `${stats.matches ? (stats.goalsFor / stats.matches).toFixed(1).replace('.', ',') : '0'} por partido`;
    const losses = Math.max(0, stats.losses ?? stats.matches - stats.wins), split = (a, b) => (a + b ? a / (a + b) * 100 : 50);
    document.getElementById('balance-wins').textContent = String(stats.wins); document.getElementById('balance-losses').textContent = String(losses);
    document.getElementById('balance-for').textContent = String(stats.goalsFor); document.getElementById('balance-against').textContent = String(stats.goalsAgainst);
    document.getElementById('balance-wins-bar').style.width = `${split(stats.wins, losses)}%`; document.getElementById('balance-losses-bar').style.width = `${100 - split(stats.wins, losses)}%`;
    document.getElementById('balance-for-bar').style.width = `${split(stats.goalsFor, stats.goalsAgainst)}%`; document.getElementById('balance-against-bar').style.width = `${100 - split(stats.goalsFor, stats.goalsAgainst)}%`;
    this.renderProfileOnline();
    this.renderTrophyGrid();
  }

  // Online identity in the profile: @user with rank badge, and the Ranked card.
  renderProfileOnline() {
    const identity = this.hub?.identity, line = document.getElementById('career-online'), card = document.getElementById('profile-ranked');
    if (!line || !card) return;
    line.replaceChildren(); card.replaceChildren();
    const kicker = document.createElement('p'); kicker.className = 'card-kicker'; kicker.textContent = 'RANKED'; card.append(kicker);
    if (identity) {
      line.append(rankBadge(identity.elo, { size: 20 }), ` @${identity.username} · ${identity.elo} ELO`);
      const progress = rankProgress(identity.elo), losses = Math.max(0, (identity.played || 0) - (identity.wins || 0));
      const top = document.createElement('div'); top.className = 'profile-rank-top';
      const icon = document.createElement('span'); icon.innerHTML = rankIconSvg(progress.rank, 64);
      const text = document.createElement('div');
      const name = document.createElement('b'); name.textContent = progress.rank.name;
      const elo = document.createElement('small'); elo.textContent = `${identity.elo} ELO · ${identity.wins || 0}V ${losses}D`;
      text.append(name, elo); top.append(icon, text);
      const bar = document.createElement('div'); bar.className = 'rank-bar'; bar.dataset.rank = progress.rank.id;
      const fill = document.createElement('i'); fill.style.width = `${progress.ratio * 100}%`; bar.append(fill);
      const next = document.createElement('small'); next.className = 'profile-rank-next';
      next.textContent = progress.next ? `${progress.to - identity.elo} ELO para ${progress.next.name}` : 'Rango máximo alcanzado';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tiny-button'; button.textContent = 'Ver todos los rangos →';
      button.addEventListener('click', () => this.showRanks());
      card.append(top, bar, next, button);
    } else {
      const text = document.createElement('p'); text.textContent = this.user ? 'Elige tu usuario y juega Ranked para conseguir tu rango.' : 'Inicia sesión y juega Ranked online para conseguir tu rango.';
      const icon = document.createElement('span'); icon.className = 'profile-rank-ghost'; icon.innerHTML = rankIconSvg(500, 56);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tiny-button'; button.textContent = 'Ir al online →';
      button.addEventListener('click', () => this.openOnline());
      card.append(icon, text, button);
    }
  }

  renderTrophyGrid() {
    const trophies = new Map(this.career.trophies.map(item => [item.id, item]));
    const context = { stats: this.career.stats, progression: this.progression, trophies: new Set(trophies.keys()) };
    const unlockedCount = TROPHY_CATALOG.filter(item => item.test(context)).length;
    const percent = Math.round(unlockedCount / TROPHY_CATALOG.length * 100);
    this.trophy_summary.textContent = `${unlockedCount} de ${TROPHY_CATALOG.length} trofeos desbloqueados`;
    const trophyCount = document.getElementById('career-trophies'); if (trophyCount) trophyCount.textContent = `${unlockedCount}/${TROPHY_CATALOG.length}`;
    this.trophy_percent.textContent = `${percent}%`; this.trophy_progress_fill.style.width = `${percent}%`;
    this.trophy_grid.replaceChildren();
    // Earned trophies first; collapsed, only the next four locked ones are shown.
    const ordered = [...TROPHY_CATALOG.filter(item => item.test(context)), ...TROPHY_CATALOG.filter(item => !item.test(context))];
    const toggle = document.getElementById('trophy-toggle'), expanded = this.trophiesExpanded === true;
    this.trophy_grid.classList.toggle('collapsed', !expanded);
    if (toggle) {
      const hidden = Math.max(0, TROPHY_CATALOG.length - unlockedCount - 4);
      toggle.classList.toggle('hidden', !hidden); toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? 'Mostrar menos' : `Ver los ${hidden} trofeos restantes`;
      toggle.onclick = () => { this.trophiesExpanded = !expanded; this.renderTrophyGrid(); };
    }
    let lockedShown = 0;
    for (const item of ordered) {
      const earned = item.test(context), button = document.createElement('button');
      button.type = 'button'; button.className = `trophy-card${earned ? ' earned' : ' locked'}${!earned && ++lockedShown > 4 ? ' extra' : ''}`; button.dataset.trophyId = item.id;
      button.setAttribute('aria-label', `${item.name}, ${earned ? 'desbloqueado' : 'bloqueado'}`);
      button.setAttribute('aria-pressed', this.trophy_detail.dataset.selected === item.id ? 'true' : 'false');
      const icon = document.createElement('span'); icon.className = 'trophy-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = earned ? item.icon : '· · ·';
      const title = document.createElement('b'); title.textContent = item.name;
      const state = document.createElement('small'); state.textContent = earned ? 'DESBLOQUEADO' : 'BLOQUEADO';
      button.append(icon, title, state); this.trophy_grid.append(button);
    }
    if (this.trophy_detail.dataset.selected) this.renderTrophyDetail(this.trophy_detail.dataset.selected);
    else if (!this.trophy_grid.querySelector('.trophy-card')) this.trophy_detail.dataset.selected = '';
  }

  renderTrophyDetail(id) {
    const item = TROPHY_CATALOG.find(trophy => trophy.id === id); if (!item) return;
    const saved = this.career.trophies.find(trophy => trophy.id === id);
    const earned = item.test({ stats: this.career.stats, progression: this.progression, trophies: new Set(this.career.trophies.map(trophy => trophy.id)) });
    this.trophy_detail.dataset.selected = id;
    this.trophy_grid.querySelectorAll('[data-trophy-id]').forEach(button => button.setAttribute('aria-pressed', button.dataset.trophyId === id ? 'true' : 'false'));
    const icon = document.createElement('span'); icon.className = 'trophy-detail-icon'; icon.textContent = earned ? item.icon : '◇';
    const state = document.createElement('small'); state.className = 'trophy-detail-state'; state.textContent = earned ? 'TROFEO DESBLOQUEADO' : 'TROFEO BLOQUEADO';
    const title = document.createElement('b'); title.textContent = item.name;
    const description = document.createElement('p'); description.textContent = item.description;
    const condition = document.createElement('p'); condition.className = 'trophy-condition'; condition.textContent = `Condición: ${item.requirement}`;
    const date = document.createElement('small'); date.className = 'trophy-earned-date';
    date.textContent = earned && saved?.date ? `Conseguido el ${new Date(saved.date).toLocaleDateString('es-ES')}` : (earned ? 'Requisito cumplido' : 'Aún no conseguido');
    this.trophy_detail.replaceChildren(icon, state, title, description, condition, date);
  }

  checkAchievements() {
    const context = { stats: this.career.stats, progression: this.progression, trophies: new Set(this.career.trophies.map(item => item.id)) };
    for (const item of TROPHY_CATALOG) if (item.test(context) && !context.trophies.has(item.id)) {
      if (this.unlockTrophy(item.id, item.name)) context.trophies.add(item.id);
    }
  }

  unlockTrophy(id, name) {
    if (!this.career.awardTrophy(id, name)) return false;
    this.sound?.play('trophy'); this.trophy_toast_name.textContent = name;
    this.trophy_toast.classList.remove('show'); void this.trophy_toast.offsetWidth; this.trophy_toast.classList.add('show');
    clearTimeout(this.trophyToastTimer); this.trophyToastTimer = setTimeout(() => this.trophy_toast.classList.remove('show'), 3800);
    this.renderAccount(); if (this.screens.profile && !this.screens.profile.classList.contains('hidden')) this.renderProfile();
    return true;
  }

  setAccountMessage(message, error = false, success = false) {
    this.account_message.textContent = message; this.account_message.classList.toggle('error', error); this.account_message.classList.toggle('success', success);
  }

  recordGoal(side) {
    const localSide = this.currentMatchMode === 'online' && this.game?.localSide === 'right' ? -side : side;
    this.career.recordGoal(localSide, this.currentMatchMode === 'training'); this.renderAccount();
    this.checkAchievements();
    this.syncAccount(false);
  }

  profileComplete() {
    const number = Number(this.settings.number);
    return this.settings.profileReady === true && !!getTeamById(this.settings.teamId)
      && !!String(this.settings.name || '').trim() && Number.isInteger(number) && number >= 0 && number <= 99;
  }

  selectMode(mode) {
    if (mode === 'modifiers') { this.openModifiers(); return; }
    if (mode === 'career') { this.careerScreen.open(); return; }
    if (mode === 'legends') { this.openLegends(); return; }
    if (mode === 'bot') {
      if (!this.profileComplete()) { this.pendingMode = 'quick'; this.pendingTeamType = 'all'; this.pendingLeagueId = ''; this.openProfile(); return; }
      this.openQuickSetup(); return;
    }
    if (mode === 'leaderboard') { this.show('leaderboard'); this.loadLeaderboard(); return; }
    if (mode === 'ranks') { this.showRanks(); return; }
    if (mode === 'competitions') { this.show('competitions'); this.renderCompetitionPicker(); return; }
    // Home menu shortcuts reuse the competition picker flow (profile and eligibility checks included).
    if (mode === 'champions' || mode === 'league') { this.openCompetitionShortcut(mode); return; }
    if (mode === 'online') { this.openOnline(); return; }
    if (!this.profileComplete()) { this.pendingMode = mode; this.openProfile(); return; }
    if (mode === 'tournament') this.openTournamentSetup();
    else if (mode === 'league') { this.updateLeaguePreview(); this.show(mode); }
    else this.start(mode);
  }

  // 1v1 or 2v2 (with an AI teammate) for matches against the AI. Leagues and cups keep
  // the format they started with; new ones use the current choice.
  soloFormat() { return this.settings.soloFormat === '2v2' ? '2v2' : '1v1'; }
  mateDifficulty() {
    const level = this.progression.level, unlocked = id => { const item = DIFFICULTIES.find(entry => entry.id === id); return !!item && level >= item.unlock; };
    return unlocked(this.settings.mateDifficulty) ? this.settings.mateDifficulty : unlocked('normal') ? 'normal' : 'easy';
  }
  setSoloFormat(format) {
    this.settings.soloFormat = format === '2v2' ? '2v2' : '1v1'; this.persist(); this.renderSoloFormat();
  }
  renderSoloFormat() {
    const current = this.soloFormat();
    document.querySelectorAll('[data-solo-format]').forEach(button => {
      const active = button.dataset.soloFormat === current;
      button.classList.toggle('active', active); button.setAttribute('aria-checked', String(active));
    });
    // Teammate difficulty: same unlock levels as the rival's.
    const level = this.progression.level, mate = this.mateDifficulty();
    document.querySelectorAll('.solo-format').forEach(node => node.classList.toggle('is-duo', current === '2v2'));
    document.body.classList.toggle('solo-duo', current === '2v2');
    document.querySelectorAll('[data-mate-difficulty]').forEach(select => {
      for (const option of select.options) {
        const item = DIFFICULTIES.find(entry => entry.id === option.value); if (!item) continue;
        option.disabled = level < item.unlock; option.textContent = level < item.unlock ? `${item.label} · nivel ${item.unlock}` : item.label;
      }
      select.value = mate;
    });
    document.querySelectorAll('[data-solo-format-hint]').forEach(node => {
      node.textContent = current === '2v2' ? 'Juegas con una IA compañera que defiende y te busca el pase.' : 'Tú contra la IA, uno contra uno.';
    });
  }

  openQuickSetup() {
    this.quickChoices.player = getTeamById(this.settings.teamId)?.id || 'laliga-barcelona';
    if (!getTeamById(this.quickChoices.rival)) this.quickChoices.rival = 'laliga-real-madrid';
    this.quickDifficulty = this.settings.difficulty;
    this.renderDifficultyMode();
    this.renderQuickSetup(); this.show('quick');
  }

  moveQuickChoice(side, direction, kind = 'team') {
    if (!['player', 'rival'].includes(side)) return;
    this.quickChoices[side] = cycleTeamSelection(this.quickChoices[side], kind, direction);
    this.renderQuickSetup(); this.renderDifficultyMode(); this.sound?.play('click');
    this.quick_pickers.querySelector(`[data-side="${side}"][data-kind="${kind}"][data-quick-move="${direction}"]`)?.focus({ preventScroll: true });
  }

  teamStars(team) {
    const rating = document.createElement('span'); rating.className = 'selection-stars';
    rating.setAttribute('role', 'img'); rating.setAttribute('aria-label', `${team.stars || 3} de 5 estrellas`);
    rating.innerHTML = Array.from({ length: 5 }, (_, index) => `<svg class="${index < (team.stars || 3) ? 'filled' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.6Z"/></svg>`).join('');
    return rating;
  }

  teamEmblem(team) {
    const crest = document.createElement('span'); crest.className = 'selection-crest';
    crest.style.background = getKitBackground(team);
    const label = document.createElement('b'); label.textContent = teamAbbreviation(team.name);
    crest.append(label); crest.setAttribute('aria-hidden', 'true'); return crest;
  }

  fillTeamSelectionCard(card, team, player = {}) {
    const name = document.createElement('b'); name.className = 'selection-team-name'; name.textContent = team.name;
    const kit = document.createElement('span'); kit.className = 'selection-kit';
    const circle = document.createElement('span'); circle.className = 'match-team-preview';
    this.paintPlayerPreview(circle, team, player);
    const caption = document.createElement('span'); caption.textContent = 'EQUIPACIÓN'; kit.append(circle, caption);
    card.append(name, this.teamEmblem(team), this.teamStars(team), kit);
  }

  renderQuickSetup() {
    this.quick_pickers.replaceChildren(...['player', 'rival'].map(side => {
      const { country, league, team } = selectionFor(this.quickChoices[side]);
      const teams = PROFILE_TEAMS.filter(item => item.league === team.league);
      const panel = document.createElement('section'); panel.className = `match-team-panel fifa-team-panel ${side}`;
      panel.setAttribute('aria-label', side === 'player' ? 'Equipo local' : 'Equipo visitante');
      const title = document.createElement('h3'); title.textContent = side === 'player' ? 'LOCAL / TU EQUIPO' : 'VISITANTE / RIVAL';
      const makeArrow = (kind, delta, label) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'carousel-arrow'; button.dataset.quickMove = String(delta); button.dataset.side = side; button.dataset.kind = kind; button.textContent = delta < 0 ? '‹' : '›'; button.setAttribute('aria-label', label); return button; };
      const row = (kind, label, value, disabled = false) => {
        const wrap = document.createElement('div'); wrap.className = 'match-category-carousel selection-filter';
        const text = document.createElement('span'), caption = document.createElement('small'), name = document.createElement('b');
        caption.textContent = label; name.textContent = value; text.append(caption, name);
        const prev = makeArrow(kind, -1, `${label} anterior`), next = makeArrow(kind, 1, `${label} siguiente`);
        prev.disabled = next.disabled = disabled; wrap.append(prev, text, next); return wrap;
      };
      const carousel = document.createElement('div'); carousel.className = 'match-category-carousel selection-team';
      const card = document.createElement('div'); card.className = 'match-team-display'; card.setAttribute('aria-live', 'polite');
      this.fillTeamSelectionCard(card, team, { name: side === 'player' ? this.settings.name : teamAbbreviation(team.name), number: side === 'player' ? this.settings.number : 10 });
      carousel.append(makeArrow('team', -1, 'Equipo anterior'), card, makeArrow('team', 1, 'Equipo siguiente'));
      const count = document.createElement('small'); count.className = 'match-team-count'; count.textContent = `EQUIPO ${teams.findIndex(item => item.id === team.id) + 1} / ${teams.length}`;
      panel.append(title, row('country', 'País / categoría', country.label), row('league', 'Liga / grupo', league.label.split(' · ')[0], country.groups.length < 2), carousel, count); return panel;
    }));
    this.updateDifficultyControls();
  }

  beginQuickMatch() {
    if (!this.profileComplete()) { this.selectMode('bot'); return; }
    const player = getTeamById(this.quickChoices.player), rival = getTeamById(this.quickChoices.rival);
    if (!player || !rival) return;
    const choice = DIFFICULTIES.find(item => item.id === this.quick_difficulty.value);
    const difficulty = choice ? choice.id : 'easy';
    if (this.settings.customDifficulty && choice && this.progression.level < choice.unlock) return;
    this.settings.teamId = player.id; if (this.settings.customDifficulty) this.settings.difficulty = difficulty; this.persist(); this.updateHomeClub();
    this.start('bot', { opponentTeam: rival, opponentName: rival.name, difficulty, duo: this.soloFormat() === '2v2', mateDifficulty: this.mateDifficulty(), label: 'PARTIDO RÁPIDO · A 5 GOLES' });
  }

  openLegends() { this.renderLegends(); this.show('legends'); }

  moveLegend(direction) {
    this.legendIndex = (this.legendIndex + direction + LEGEND_MATCHES.length) % LEGEND_MATCHES.length;
    this.legendTeamId = ''; this.renderLegends(); this.sound?.play('click');
  }

  renderLegends() {
    const match = LEGEND_MATCHES[this.legendIndex], unlocked = this.progression.level >= LEGENDS_UNLOCK_LEVEL;
    if (!match.teams.includes(this.legendTeamId)) this.legendTeamId = match.teams[0];
    this.legend_title.textContent = match.name; this.legend_edition.textContent = match.edition;
    this.legend_position.textContent = `${this.legendIndex + 1} / ${LEGEND_MATCHES.length}`;
    this.legends_lock.textContent = unlocked ? 'LEYENDAS DESBLOQUEADO · ELIGE TU EQUIPO' : `DESBLOQUEA LEYENDAS AL NIVEL 7 · NIVEL ACTUAL ${this.progression.level}`;
    this.legends_lock.classList.toggle('unlocked', unlocked);
    this.legend_history.textContent = match.history;
    const source = document.createElement('a'); source.href = match.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Historia del partido ↗'; this.legend_history.append(source);
    this.legend_teams.replaceChildren(...match.teams.map(id => {
      const team = getTeamById(id), selected = id === this.legendTeamId;
      const card = document.createElement('button'); card.type = 'button'; card.className = `legend-team-choice${selected ? ' selected' : ''}`; card.dataset.legendTeam = id; card.disabled = !unlocked; card.setAttribute('aria-pressed', String(selected));
      const circle = document.createElement('span'); circle.className = 'match-team-preview'; this.paintPlayerPreview(circle, team, { name: this.settings.name || 'TU NOMBRE', number: this.settings.number });
      const name = document.createElement('b'); name.textContent = team.name;
      const action = document.createElement('small'); action.textContent = selected ? 'TU EQUIPO ✓' : 'ELEGIR ESTE EQUIPO';
      card.append(circle, name, action); return card;
    }));
    this.legend_start.disabled = !unlocked;
    this.legend_start.textContent = unlocked ? `Jugar con ${getTeamById(this.legendTeamId).name} ↗` : 'Bloqueado · alcanza el nivel 7';
  }

  beginLegendMatch() {
    let duel;
    try { duel = resolveLegendMatch(LEGEND_MATCHES[this.legendIndex].id, this.legendTeamId, this.progression.level); }
    catch (error) { this.legends_lock.textContent = error.message; return; }
    this.settings.teamId = duel.playerTeam.id;
    if (!this.profileComplete()) {
      this.pendingMode = 'legend-profile'; this.pendingTeamType = 'club'; this.pendingLeagueId = duel.playerTeam.league; this.openProfile(); return;
    }
    this.persist(); this.updateHomeClub();
    this.start('legends', { legendId: duel.match.id, opponentTeam: duel.opponentTeam, opponentName: duel.opponentTeam.name, difficulty: 'legend', fieldTheme: 'champions', competitionRound: 4, label: `LEYENDAS · ${duel.match.name.toUpperCase()} · IA LEYENDA · A 5` });
  }

  renderCompetitionPicker() {
    const trophies = TROPHY_ART;
    const item = CUP_COMPETITIONS[this.competitionIndex] || CUP_COMPETITIONS[0];
    this.competition_trophy.innerHTML = trophies[item.id] || (item.id === 'club-world-cup' ? trophies['world-cup'] : trophies.champions);
    this.competition_picker_card.style.setProperty('--competition-accent', ({ champions: '#78ddb0', league: '#73a9ed', 'world-cup': '#e7c56c', euro: '#7ab6ef', 'copa-america': '#69d2a0', 'copa-libertadores': '#e4a66d', 'club-world-cup': '#e7c56c' })[item.id] || '#78ddb0');
    this.competition_eyebrow.textContent = item.eyebrow;
    this.competition_title.textContent = item.name;
    this.competition_description.textContent = item.description;
    this.renderCompetitionGrid(trophies);
    this.competition_dots.replaceChildren(...CUP_COMPETITIONS.map((competition, i) => {
      const dot = document.createElement('i'); dot.className = i === this.competitionIndex ? 'active' : ''; dot.setAttribute('aria-label', competition.name); return dot;
    }));
  }

  // Panel grid with every competition (clubs first, then national teams) plus a
  // shortcut to change team, since each cup asks for a club or a national team.
  renderCompetitionGrid(trophies) {
    const grid = document.getElementById('competition-grid'); if (!grid) return;
    const accents = { champions: '#78ddb0', league: '#73a9ed', 'world-cup': '#e7c56c', euro: '#7ab6ef', 'copa-america': '#69d2a0', 'copa-libertadores': '#e4a66d', 'club-world-cup': '#e7c56c' };
    const order = ['champions', 'copa-libertadores', 'club-world-cup', 'league', 'world-cup', 'euro', 'copa-america'];
    const team = getTeamById(this.settings.teamId);
    const tiles = order.map((id, index) => {
      const at = CUP_COMPETITIONS.findIndex(item => item.id === id); if (at < 0) return null;
      const item = CUP_COMPETITIONS[at], tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'hub-tile panel-tile competition-tile'; tile.dataset.competitionIndex = String(at);
      tile.style.setProperty('--competition-accent', accents[id] || '#78ddb0');
      const national = item.type !== 'club', group = item.type === 'europe' ? 'europe' : item.type === 'america' ? 'america' : '';
      const fits = Boolean(team) && (national ? team.type === 'national' : team.type !== 'national') && (!group || team.league === group)
        && (id !== 'copa-libertadores' || isLibertadoresEligibleTeam(team.id)) && (id !== 'club-world-cup' || isClubWorldCupEligibleTeam(team.id));
      const tag = document.createElement('span'); tag.className = 'tile-index'; tag.textContent = `${String(index + 1).padStart(2, '0')} / ${national ? 'SELECCIONES' : 'CLUBES'}`;
      const name = document.createElement('strong'); name.textContent = item.name;
      const text = document.createElement('small'); text.textContent = item.description;
      const art = document.createElement('span'); art.className = 'tile-art competition-tile-art'; art.setAttribute('aria-hidden', 'true');
      art.innerHTML = trophies[id] || (id === 'club-world-cup' ? trophies['world-cup'] : trophies.champions);
      tile.append(tag, name, text, art);
      if (!fits) { const hint = document.createElement('i'); hint.className = 'competition-tile-hint'; hint.textContent = national ? 'ELEGIRÁS UNA SELECCIÓN' : 'ELEGIRÁS UN CLUB ADMITIDO'; tile.append(hint); }
      return tile;
    }).filter(Boolean);
    const change = document.createElement('button'); change.type = 'button'; change.className = 'hub-tile panel-tile competition-tile competition-team-tile'; change.dataset.competitionTeam = 'true';
    const tag = document.createElement('span'); tag.className = 'tile-index'; tag.textContent = '08 / TU EQUIPO';
    const name = document.createElement('strong'); name.textContent = team ? team.name : 'Elige equipo';
    const text = document.createElement('small'); text.textContent = 'Cambia de club o selección antes de empezar.';
    const art = document.createElement('span'); art.className = 'tile-art competition-team-kit match-team-preview'; art.setAttribute('aria-hidden', 'true');
    if (team) this.paintPlayerPreview(art, team, { name: (this.settings.name || '').slice(0, 10).toUpperCase(), number: this.settings.number });
    change.append(tag, name, text, art);
    grid.replaceChildren(...tiles, change);
  }

  moveCompetition(direction) {
    this.competitionIndex = (this.competitionIndex + direction + CUP_COMPETITIONS.length) % CUP_COMPETITIONS.length;
    this.renderCompetitionPicker(); this.sound?.play('click');
  }

  chooseCompetition() {
    const competition = CUP_COMPETITIONS[this.competitionIndex];
    this.selectedCompetition = competition.id;
    const mode = competition.id === 'league' ? 'league' : 'tournament';
    const required = competition.type === 'club' ? 'club' : 'national';
    const current = getTeamById(this.settings.teamId);
    const requiredGroup = competition.type === 'europe' ? 'europe' : competition.type === 'america' ? 'america' : '';
    const isSouthAmericanCup = competition.id === 'copa-libertadores';
    const isClubWorldCup = competition.id === 'club-world-cup';
    const eligibleForCup = (!isSouthAmericanCup || isLibertadoresEligibleTeam(current?.id)) && (!isClubWorldCup || isClubWorldCupEligibleTeam(current?.id));
    if (!this.profileComplete() || (required === 'club' && current?.type === 'national') || (required === 'national' && current?.type !== 'national') || (requiredGroup && current?.league !== requiredGroup) || !eligibleForCup) {
      this.pendingMode = mode; this.pendingCompetition = competition.id; this.pendingTeamType = required;
      this.pendingLeagueId = competition.id === 'league' ? this.league_competition.value : isSouthAmericanCup ? 'south-america-clubs' : isClubWorldCup ? 'club-world-cup-clubs' : requiredGroup;
      this.openProfile(); return;
    }
    if (mode === 'league') {
      if (current && current.type !== 'national' && TEAM_LEAGUES.some(league => league.id === current.league)) {
        this.league_competition.value = current.league; this.settings.leagueCompetition = current.league; this.persist();
      }
      this.updateLeaguePreview(); this.show('league');
    }
    else this.openTournamentSetup(competition.id);
  }

  openTournamentSetup(competitionId = this.pendingCompetition || this.selectedCompetition || 'champions') {
    const competition = CUP_COMPETITIONS.find(item => item.id === competitionId) || CUP_COMPETITIONS[0];
    const isInternational = competition.type !== 'club';
    const current = getTeamById(this.settings.teamId);
    const requiredGroup = competition.type === 'europe' ? 'europe' : competition.type === 'america' ? 'america' : '';
    const isSouthAmericanCup = competition.id === 'copa-libertadores';
    const isClubWorldCup = competition.id === 'club-world-cup';
    const eligibleForCup = (!isSouthAmericanCup || isLibertadoresEligibleTeam(current?.id)) && (!isClubWorldCup || isClubWorldCupEligibleTeam(current?.id));
    if (isInternational && current?.type !== 'national' || !isInternational && current?.type === 'national' || requiredGroup && current?.league !== requiredGroup || !eligibleForCup) {
      this.pendingMode = 'tournament'; this.pendingCompetition = competition.id; this.pendingTeamType = isInternational ? 'national' : 'club'; this.pendingLeagueId = isSouthAmericanCup ? 'south-america-clubs' : isClubWorldCup ? 'club-world-cup-clubs' : requiredGroup; this.openProfile(); return;
    }
    const teams = isInternational ? createInternationalDraw(competition.id, this.settings.teamId)
      : competition.id === 'copa-libertadores' ? createLibertadoresDraw(this.settings.teamId)
        : competition.id === 'club-world-cup' ? createClubWorldCupDraw(this.settings.teamId) : createChampionsDraw(this.settings.teamId);
    const size = teams.length, totalRounds = Math.log2(size);
    this.tournament = { size, teams, totalRounds, round: 0, status: 'setup', competitionId: competition.id, bracket: createBracket(teams) };
    this.renderTournamentSetup(competition);
    this.renderTournamentRoster(); this.show('tournament');
  }

  openProfile() {
    this.selectedTeamId = getTeamById(this.settings.teamId)?.id || '';
    const allowedGroups = this.getAllowedTeamGroups();
    const selectedTeam = getTeamById(this.selectedTeamId);
    if (this.pendingLeagueId && !['south-america-clubs', 'club-world-cup-clubs'].includes(this.pendingLeagueId)) {
      this.activeLeague = this.pendingLeagueId;
      if (selectedTeam?.league !== this.pendingLeagueId) this.selectedTeamId = '';
    } else if (this.pendingLeagueId === 'south-america-clubs') {
      if (!isLibertadoresEligibleTeam(selectedTeam?.id)) this.selectedTeamId = '';
      if (!['argentina', 'brasileirao'].includes(this.activeLeague)) this.activeLeague = 'argentina';
    } else if (this.pendingLeagueId === 'club-world-cup-clubs') {
      if (!isClubWorldCupEligibleTeam(selectedTeam?.id)) this.selectedTeamId = '';
      if (!TEAM_CLUB_GROUPS.some(group => group.id === this.activeLeague)) this.activeLeague = 'laliga';
    } else if (this.pendingTeamType === 'club' && selectedTeam?.type === 'national' || this.pendingTeamType === 'national' && selectedTeam?.type !== 'national') this.selectedTeamId = '';
    else if (selectedTeam) this.activeLeague = selectedTeam.league;
    if (!allowedGroups.some(group => group.id === this.activeLeague)) this.activeLeague = allowedGroups[0]?.id || TEAM_LEAGUES[0].id;
    if (this.pendingMode === 'tournament' && !this.getProfileTeams(this.activeLeague).length) this.activeLeague = TEAM_LEAGUES.find(league => this.getProfileTeams(league.id).length)?.id || TEAM_LEAGUES[0].id;
    this.activeCountry = TEAM_COUNTRIES.find(country => country.groups.includes(this.activeLeague))?.id || TEAM_COUNTRIES[0].id;
    this.player_name.value = this.settings.profileReady ? this.settings.name : '';
    this.player_number.value = this.settings.profileReady ? this.settings.number : '';
    const setupForMode = !!this.pendingMode;
    this.profile_eyebrow.textContent = setupForMode ? 'ANTES DEL SAQUE' : 'PERSONALIZACIÓN';
    this.profile_title.innerHTML = setupForMode ? 'Elige tu<br><em>equipo.</em>' : 'Tu club.<br><em>Tu dorsal.</em>';
    this.profile_copy.textContent = setupForMode
      ? `Para empezar, selecciona ${this.pendingTeamType === 'national' ? 'una selección' : 'un club'} y luego completa tu nombre y dorsal.`
      : 'Cambia de equipo o actualiza el nombre y dorsal que aparecen en el campo.';
    document.getElementById('save-player').innerHTML = setupForMode ? 'Guardar y continuar <span>→</span>' : 'Guardar jugador <span>✓</span>';
    this.saved_note.textContent = '';
    this.renderTeamNavigation();
    this.renderTeamCarousel(); this.updateProfilePreview(); this.updateProfileValidity(); this.show('customize');
  }

  renderTeamCarousel() {
    this.league_tabs.querySelectorAll('[data-league]').forEach(tab => {
      const active = tab.dataset.league === this.activeLeague; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active));
    });
    this.team_grid.replaceChildren();
    const leagueTeams = this.getProfileTeams();
    let index = this.teamCursor.get(this.activeLeague) || 0;
    if (!this.teamCursor.has(this.activeLeague)) {
      const selectedIndex = leagueTeams.findIndex(team => team.id === this.selectedTeamId);
      if (selectedIndex >= 0) index = selectedIndex;
    }
    index = (index + leagueTeams.length) % leagueTeams.length; this.teamCursor.set(this.activeLeague, index);
    const team = leagueTeams[index];
    if (!team) return;
    const card = document.createElement('button'); card.type = 'button'; card.className = 'team-card single-team-card'; card.dataset.teamId = team.id;
    const chosen = team.id === this.selectedTeamId;
    card.setAttribute('aria-label', `${team.name}. Valoración ${team.stars || 3} de 5 estrellas. ${chosen ? 'Equipo elegido' : 'Elegir este equipo'}`);
    card.setAttribute('aria-pressed', String(chosen)); card.classList.toggle('selected', chosen);
    card.classList.add('match-team-display');
    this.fillTeamSelectionCard(card, team, { name: this.player_name.value.trim() || 'TU NOMBRE', number: this.player_number.value || 10 });
    const status = document.createElement('small'); status.className = 'selection-choice-status';
    status.textContent = chosen ? 'EQUIPO ELEGIDO ✓' : 'ELEGIR ESTE EQUIPO';
    card.append(status); this.team_grid.append(card);
    this.team_position.textContent = `${index + 1} / ${leagueTeams.length}`;
    this.teams_prev.disabled = this.teams_next.disabled = leagueTeams.length < 2;
  }

  moveTeam(direction) {
    const leagueTeams = this.getProfileTeams();
    const current = this.teamCursor.get(this.activeLeague) || 0;
    this.teamCursor.set(this.activeLeague, (current + direction + leagueTeams.length) % leagueTeams.length);
    this.renderTeamCarousel(); this.sound?.play('click');
  }

  selectTeam(teamId) {
    const chosen = getTeamById(teamId);
    const leagueAllowed = this.pendingLeagueId === 'south-america-clubs' ? isLibertadoresEligibleTeam(chosen?.id)
      : this.pendingLeagueId === 'club-world-cup-clubs' ? isClubWorldCupEligibleTeam(chosen?.id)
        : !this.pendingLeagueId || chosen?.league === this.pendingLeagueId;
    if (!chosen || this.pendingTeamType === 'club' && chosen.type === 'national' || this.pendingTeamType === 'national' && chosen.type !== 'national' || !leagueAllowed) return;
    const firstSelection = this.player_name.disabled;
    this.selectedTeamId = teamId; this.activeLeague = getTeamById(teamId).league;
    this.activeCountry = TEAM_COUNTRIES.find(country => country.groups.includes(this.activeLeague))?.id || TEAM_COUNTRIES[0].id;
    const index = this.getProfileTeams().findIndex(item => item.id === teamId);
    if (index >= 0) this.teamCursor.set(this.activeLeague, index);
    this.renderTeamNavigation(); this.renderTeamCarousel(); this.updateProfilePreview(); this.updateProfileValidity();
    if (firstSelection) this.player_name.focus();
    this.sound?.play('click');
  }

  updateProfilePreview() {
    const team = getTeamById(this.selectedTeamId), name = this.player_name.value.trim() || 'TU NOMBRE';
    const rawNumber = this.player_number.value, number = rawNumber === '' ? '—' : clamp(Number(rawNumber) || 0, 0, 99);
    this.preview_name.textContent = name.toUpperCase(); this.preview_number.textContent = number;
    this.paintPlayerPreview(this.preview_ball, team);
    this.preview_ball.style.boxShadow = team ? `0 8px 28px ${team.primary}55, inset -7px -8px 13px #0003` : 'none';
    this.preview_team.textContent = team ? team.name.toUpperCase() : 'ELIGE UN EQUIPO';
    const league = team && TEAM_GROUPS.find(item => item.id === team.league);
    this.chosen_team_label.textContent = team ? `${team.name} · ${league.label.split(' · ')[0]}` : 'SELECCIONA UN EQUIPO PRIMERO';
    this.player_name.disabled = !team; this.player_number.disabled = !team;
    this.renderTeamCarousel();
    this.updateProfileValidity(); this.updateHomeClub();
  }

  paintPlayerPreview(circle, team, preview = {}) {
    circle.classList.add('player-circle-preview');
    let name = circle.querySelector('.circle-preview-name');
    let number = circle.querySelector('.circle-preview-number');
    if (!name) { name = document.createElement('span'); name.className = 'circle-preview-name'; circle.append(name); }
    if (!number) { number = document.createElement('b'); number.className = 'circle-preview-number'; circle.append(number); }
    const label = String(preview.name ?? (this.player_name.value.trim() || 'TU NOMBRE')).toUpperCase();
    name.textContent = label;
    number.textContent = preview.number ?? (this.player_number.value === '' ? '—' : clamp(Number(this.player_number.value) || 0, 0, 99));
    circle.style.background = getKitBackground(team);
    const dorsal = dorsalStyle(team?.numberColor || '#ffffff');
    circle.style.setProperty('--dorsal-color', team?.numberColor || '#ffffff');
    circle.style.setProperty('--dorsal-outline', dorsal.outline);
    circle.classList.toggle('white-dorsal', dorsal.light);
    circle.classList.toggle('plain-dorsal', team?.numberOutline === false);
    circle.style.setProperty('--preview-name-size', String(Math.min(16, 75 / Math.max(1, label.length * .65))));
  }

  updateProfileValidity() {
    if (!this.save_player) return;
    const numberText = this.player_number.value, number = Number(numberText);
    const team = getTeamById(this.selectedTeamId);
    let typeMatches = !!team;
    if (this.pendingTeamType === 'national') typeMatches = team?.type === 'national';
    else if (this.pendingTeamType === 'club') typeMatches = team?.type !== 'national';
    if (this.pendingLeagueId === 'south-america-clubs') typeMatches = typeMatches && isLibertadoresEligibleTeam(team?.id);
    else if (this.pendingLeagueId === 'club-world-cup-clubs') typeMatches = typeMatches && isClubWorldCupEligibleTeam(team?.id);
    else if (this.pendingLeagueId) typeMatches = typeMatches && team?.league === this.pendingLeagueId;
    const valid = !!team && typeMatches && !!this.player_name.value.trim()
      && numberText !== '' && Number.isInteger(number) && number >= 0 && number <= 99;
    this.save_player.disabled = !valid;
  }

  updateHomeClub() {
    const team = getTeamById(this.settings.teamId);
    this.home_club_name.textContent = team ? `${team.name.toUpperCase()} · ${team.type === 'national' ? 'SELECCIÓN' : team.type === 'honorary' ? 'HONORÍFICO' : 'CLUB'}` : 'SELECCIONA TU EQUIPO AL JUGAR';
    this.home_club_colors.style.background = team ? getKitBackground(team) : 'transparent';
    this.home_club_colors.classList.toggle('has-team', !!team);
  }

  savePlayer() {
    const team = getTeamById(this.selectedTeamId), name = this.player_name.value.trim();
    const numberText = this.player_number.value, number = Number(numberText);
    const leagueAllowed = this.pendingLeagueId === 'south-america-clubs' ? isLibertadoresEligibleTeam(team?.id)
      : this.pendingLeagueId === 'club-world-cup-clubs' ? isClubWorldCupEligibleTeam(team?.id)
        : !this.pendingLeagueId || team?.league === this.pendingLeagueId;
    if (!team || this.pendingTeamType === 'club' && team.type === 'national' || this.pendingTeamType === 'national' && team.type !== 'national' || !leagueAllowed || !name || numberText === '' || !Number.isInteger(number) || number < 0 || number > 99) return;
    this.settings.teamId = team.id; this.settings.name = name.slice(0, 16); this.settings.number = number; this.settings.profileReady = true;
    delete this.settings.color; this.persist(); this.updateHomeClub();
    const nextMode = this.pendingMode; this.pendingMode = null; this.sound?.play('click');
    const nextCompetition = this.pendingCompetition, nextLeagueId = this.pendingLeagueId; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.pendingLeagueId = '';
    this.renderTeamNavigation();
    if (nextMode === 'quick') { this.openQuickSetup(); return; }
    if (nextMode === 'legend-profile') { this.legendTeamId = team.id; this.beginLegendMatch(); return; }
    if (nextMode === 'online') { this.openOnline(); return; }
    if (nextMode === 'tournament') { this.openTournamentSetup(nextCompetition); return; }
    if (nextMode === 'league') {
      this.league_competition.value = nextLeagueId || team.league; this.settings.leagueCompetition = this.league_competition.value; this.persist();
      this.updateLeaguePreview(); this.show('league'); return;
    }
    if (nextMode) { this.show('home'); this.start(nextMode); }
    else this.saved_note.textContent = 'JUGADOR GUARDADO';
  }

  persist() { saveSettings(this.settings); this.game?.updateSettings(this.settings); this.syncAccount(false); }

  show(view) {
    this.currentView = view;
    this.ads ||= new Ads(); this.ads.update(view, this.game?.renderer);
    const onlineTheme = ['online', 'leaderboard'].includes(view) || view === 'game' && this.currentMatchMode === 'online';
    document.body.classList.add('blue-theme');
    document.body.classList.toggle('online-theme', onlineTheme);
    this.sound?.setScene?.(view === 'game' && !this.game?.state.paused ? 'game' : 'menu');
    document.querySelector('.rules-game-button')?.classList.toggle('hidden', this.currentMatchMode === 'online');
    if (this.game) {
      this.game.renderEnabled = view === 'game'; this.game.input.enabled = view === 'game' && !this.game.state.paused;
      if (view !== 'game') { this.game.input.down.clear(); this.game.input.pressed.clear(); }
    }
    document.querySelectorAll('.section-nav [data-view]').forEach(button => {
      const active = button.dataset.view === view || button.dataset.view === 'play' && ['quick','legends','online','leaderboard','competitions','tournament','league'].includes(view);
      button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    for (const [key, screen] of Object.entries(this.screens)) screen.classList.toggle('hidden', key !== view);
    // Animated background: one canvas moves into the visible menu and draws its scene.
    const backdropScene = { home: 'home', play: 'play', online: 'online', settings: 'settings', tournament: 'champions', league: 'league', career: 'champions', progress: 'home' }[view];
    if (backdropScene && this.screens[view]) this.menuBackdrop?.setScene(backdropScene, this.screens[view]);
    this.menuBackdrop?.setActive(!!backdropScene);
    if (view === 'profile') { this.renderProfile(); this.social?.setTab(this.social.tab); } else this.social?.closePlayer();
    if (view === 'missions') this.renderMissions();
    if (view === 'progress') this.progressScreen?.render();
    if (view === 'home') this.progressScreen?.renderHome();
    this.applyGoldName();
    if (view === 'play') this.refreshContinueButton();
    if (view === 'game') requestAnimationFrame(() => this.game?.renderer.resize());
  }

  renderProgress() {
    const progress = this.progression, maxed = progress.level >= Progression.maxLevel;
    this.level_value.textContent = progress.level;
    this.xp_label.textContent = maxed ? 'NIVEL MÁXIMO' : `${progress.xp} / ${progress.xpForNextLevel()} XP`;
    this.wins_label.textContent = `${progress.wins} VICTORIAS`;
    this.xp_fill.style.width = `${progress.progressRatio() * 100}%`;
   
    this.updateDifficultyControls();
    this.renderAccount();
    this.checkAchievements();
  }

  // Difficulties unlock by level (see DIFFICULTIES); a locked choice falls back to the best unlocked one.
  updateDifficultyControls() {
    const level = this.progression.level;
    const unlocked = id => { const item = DIFFICULTIES.find(entry => entry.id === id); return !!item && level >= item.unlock; };
    const best = [...DIFFICULTIES].reverse().find(item => level >= item.unlock)?.id || 'easy';
    if (!unlocked(this.settings.difficulty)) { this.settings.difficulty = best; saveSettings(this.settings); }
    if (!unlocked(this.quickDifficulty)) this.quickDifficulty = this.settings.difficulty;
    for (const select of [this.difficulty, this.play_difficulty, this.settings_difficulty, this.quick_difficulty]) {
      for (const option of select.options) {
        const item = DIFFICULTIES.find(entry => entry.id === option.value); if (!item) continue;
        option.disabled = level < item.unlock;
        option.textContent = level < item.unlock ? `${item.label} · nivel ${item.unlock}` : item.label;
      }
      select.value = select === this.quick_difficulty ? this.quickDifficulty || this.settings.difficulty : this.settings.difficulty;
    }
    const legendsUnlocked = this.progression.level >= LEGENDS_UNLOCK_LEVEL;
    this.legends_mode_card.classList.toggle('mode-locked', !legendsUnlocked);
    this.legends_mode_tag.textContent = legendsUnlocked ? '06 / CLÁSICOS · IA LEYENDA' : '06 / BLOQUEADO · NIVEL 7';
  }

  updateLeaguePreview() {
    const id = this.league_competition.value || TEAM_LEAGUES[0].id;
    const competition = TEAM_LEAGUES.find(item => item.id === id) || TEAM_LEAGUES[0];
    const count = TEAMS.filter(team => team.league === competition.id).length;
    const rounds = Math.max(0, count - 1);
    const team = getTeamById(this.settings.teamId);
    const teamHint = team?.league === id ? `TU EQUIPO · ${team.name.toUpperCase()}` : 'ELIGE UN EQUIPO DE ESTA LIGA PARA JUGAR';
    this.league_competition_summary.textContent = `${competition.label.split(' · ')[0].toUpperCase()} · ${count} CLUBES · ${rounds} JORNADAS · ${teamHint}`;
    const stat = document.querySelector('.league-stat-rounds b');
    if (stat) stat.textContent = String(rounds);
    this.renderLeaguePicker();
  }

  openCompetitionShortcut(id) {
    const index = CUP_COMPETITIONS.findIndex(item => item.id === id);
    if (index < 0) return;
    this.competitionIndex = index; this.renderCompetitionPicker(); this.chooseCompetition();
  }

  // Visual league selector: country tabs plus one card per league. The hidden
  // #league-competition select remains the source of truth for the chosen league.
  renderLeaguePicker() {
    const tabs = document.getElementById('league-country-tabs'), options = document.getElementById('league-options');
    if (!tabs || !options) return;
    const selected = this.league_competition.value || TEAM_LEAGUES[0].id;
    const leagueIds = new Set(TEAM_LEAGUES.map(league => league.id));
    const countries = TEAM_COUNTRIES.filter(country => country.groups.some(id => leagueIds.has(id)));
    const selectedCountry = countries.find(country => country.groups.includes(selected))?.id;
    // Follow the chosen league when it changes elsewhere (e.g. the player's club); otherwise keep the browsed country.
    if (selected !== this.leaguePickerSelected || !countries.some(country => country.id === this.leaguePickerCountry)) {
      this.leaguePickerCountry = selectedCountry || countries[0]?.id; this.leaguePickerSelected = selected;
    }
    const team = getTeamById(this.settings.teamId);
    tabs.replaceChildren(...countries.map(country => {
      const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'league-country-tile';
      const active = country.id === this.leaguePickerCountry;
      tab.dataset.leagueCountry = country.id; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('active', active); tab.classList.toggle('has-selection', country.id === selectedCountry);
      const groups = country.groups.filter(id => leagueIds.has(id)), clubs = TEAMS.filter(item => groups.includes(item.league)).length;
      const flag = document.createElement('span'); flag.className = `league-flag flag-${country.id}`; flag.setAttribute('aria-hidden', 'true');
      const name = document.createElement('b'); name.textContent = country.label;
      const meta = document.createElement('small'); meta.textContent = `${groups.length} ${groups.length === 1 ? 'DIVISIÓN' : 'DIVISIONES'}`; tab.title = `${country.label} · ${clubs} clubes`;
      tab.append(flag, name, meta);
      if (groups.includes(team?.league)) { const mine = document.createElement('i'); mine.className = 'league-option-mine'; mine.textContent = 'TU LIGA'; tab.append(mine); }
      return tab;
    }));
    const country = countries.find(item => item.id === this.leaguePickerCountry);
    const countryName = document.getElementById('league-country-name'); if (countryName) countryName.textContent = country?.label || '';
    const leagues = TEAM_LEAGUES.filter(league => country?.groups.includes(league.id));
    options.replaceChildren(...leagues.map(league => {
      const count = TEAMS.filter(item => item.league === league.id).length, chosen = league.id === selected;
      const card = document.createElement('button'); card.type = 'button'; card.className = 'league-option';
      card.dataset.leagueOption = league.id; card.setAttribute('role', 'radio'); card.setAttribute('aria-checked', String(chosen));
      card.classList.toggle('selected', chosen);
      const tier = document.createElement('small'); tier.className = 'league-option-tier'; tier.textContent = leagueTierLabel(league.id);
      const name = document.createElement('b'); name.textContent = league.label.split(' · ')[0];
      const meta = document.createElement('span'); meta.className = 'league-option-meta'; meta.textContent = `${count} CLUBES · ${Math.max(0, count - 1)} JORNADAS`;
      card.append(tier, name, meta);
      if (team?.league === league.id) { const mine = document.createElement('i'); mine.className = 'league-option-mine'; mine.textContent = 'TU EQUIPO'; card.append(mine); }
      return card;
    }));
  }

  selectLeagueOption(id) {
    if (!TEAM_LEAGUES.some(league => league.id === id)) return;
    this.sound?.play('click');
    if (this.league_competition.value === id) return;
    this.league_competition.value = id;
    this.league_competition.dispatchEvent(new Event('change'));
    document.querySelector(`[data-league-option="${id}"]`)?.focus({ preventScroll: true });
  }

  renderMissions() {
    const missions = this.career.activeMissions(this.progression.level);
    this.missions_list.replaceChildren();
    const summary = document.getElementById('missions-summary');
    if (summary) summary.innerHTML = `<b>${this.career.missionsCompleted()}</b><span>COMPLETADAS</span><small>${missions.reduce((sum, mission) => sum + mission.xp, 0)} XP en juego</small>`;
    missions.forEach(mission => {
      const card = document.createElement('article'); card.className = `mission-card tier-${mission.tier}`;
      const heading = document.createElement('div'); heading.className = 'mission-card-heading';
      const copy = document.createElement('div'); const title = document.createElement('b'); title.textContent = mission.title;
      const description = document.createElement('p'); description.textContent = mission.description; copy.append(title, description);
      const number = document.createElement('span'); number.className = 'tile-index mission-index';
      const stars = MISSION_TIERS.findIndex(tier => tier.id === mission.tier) + 1;
      number.innerHTML = `<span class="mission-tier">${mission.tierLabel.toUpperCase()}</span><span class="mission-stars" aria-label="Dificultad ${stars} de 4">${'★'.repeat(stars)}${'☆'.repeat(4 - stars)}</span>`;
      card.append(number);
      const status = document.createElement('span'); status.className = 'mission-status'; status.textContent = `${mission.progress}/${mission.goal}`;
      heading.append(copy, status);
      const track = document.createElement('div'); track.className = 'mission-progress'; const fill = document.createElement('i'); fill.style.width = `${Math.min(100, mission.progress / mission.goal * 100)}%`; track.append(fill);
      const reward = document.createElement('small'); reward.textContent = `RECOMPENSA · ${mission.xp} XP`;
      card.append(heading, track, reward); this.missions_list.append(card);
    });
  }

  renderTournamentSetup(competition) {
    const international = competition.type !== 'club';
    const title = competition.id === 'champions' ? 'Camino a<br> <em>Champions.</em>'
      : competition.id === 'copa-libertadores' ? 'Rumbo a<br> <em>la Gloria Eterna.</em>'
        : competition.id === 'club-world-cup' ? 'Campeones<br> <em>del mundo.</em>'
      : competition.id === 'world-cup' ? 'El sueño<br> <em>mundial.</em>'
        : competition.id === 'euro' ? 'Camino a<br> <em>la Euro.</em>'
          : 'Rumbo a<br><em>América.</em>';
    this.tournament_header_tag.textContent = competition.eyebrow;
    this.tournament_eyebrow.textContent = competition.eyebrow;
    this.tournament_title.innerHTML = title;
    this.tournament_description.textContent = international
      ? '16 selecciones, eliminatorias directas y cuatro rondas hasta levantar el trofeo.'
      : `${this.tournament.size} clubes clasificados. Cuadro eliminatorio arcade hasta la final.`;
    this.tournament_team_count.textContent = `${this.tournament.size} ${international ? 'SELECCIONES' : 'CLUBES'}`;
    this.tournament_emblem.innerHTML = this.competition_trophy.innerHTML;
    this.tournament_emblem.style.color = getComputedStyle(this.competition_picker_card).getPropertyValue('--competition-accent').trim() || 'var(--green)';
    document.getElementById('tournament-start').innerHTML = `Empezar ${competition.name} <span>↗</span>`;
  }

  beginTournament() {
    const cupId = this.tournament?.competitionId || this.selectedCompetition || 'champions';
    const competition = CUP_COMPETITIONS.find(item => item.id === cupId) || CUP_COMPETITIONS[0];
    const team = getTeamById(this.settings.teamId);
    const requiredGroup = competition.type === 'europe' ? 'europe' : competition.type === 'america' ? 'america' : '';
    const southAmericanClub = cupId === 'copa-libertadores';
    const clubWorldCup = cupId === 'club-world-cup';
    const eligibleForCup = (!southAmericanClub || isLibertadoresEligibleTeam(team?.id)) && (!clubWorldCup || isClubWorldCupEligibleTeam(team?.id));
    if (!this.profileComplete() || (competition.type === 'club' && team?.type === 'national') || (competition.type !== 'club' && team?.type !== 'national') || requiredGroup && team?.league !== requiredGroup || !eligibleForCup) {
      this.pendingMode = 'tournament'; this.pendingCompetition = cupId; this.pendingTeamType = competition.type === 'club' ? 'club' : 'national'; this.pendingLeagueId = southAmericanClub ? 'south-america-clubs' : clubWorldCup ? 'club-world-cup-clubs' : requiredGroup; this.openProfile(); return;
    }
    if (!this.tournament || this.tournament.status !== 'setup') this.openTournamentSetup(cupId);
    this.tournament.round = 0; this.tournament.status = 'playing';
    this.league = null; this.launchTournamentRound();
  }

  renderTournamentRoster() {
    // The setup screen shows the drawn bracket (first-round ties) instead of a plain list.
    this.tournament_roster.replaceChildren();
    this.tournament_roster.classList.add('bracket', 'bracket-setup');
    const stages = document.querySelector('#tournament-screen .champions-card-heading>div>span');
    if (stages && this.tournament?.bracket) stages.textContent = this.tournament.bracket.rounds.map((_, index) => roundName(this.tournament.bracket.size, index + 1).replace(/ DE FINAL$/i, '')).join(' · ').toUpperCase();
    this.renderBracket(this.tournament_roster, this.tournament, 0, 0, { mirror: Boolean(window.matchMedia?.('(min-width: 1024px)').matches) });
  }

  renderBracketPanel(cup) {
    const champion = bracketChampion(cup.bracket), competition = CUP_COMPETITIONS.find(item => item.id === cup.competitionId);
    const championTeam = champion && (cup.teams.find(team => team.id === champion) || getTeamById(champion));
    this.tournament_bracket_title.textContent = `${(competition?.name || 'TORNEO').toUpperCase()} · CUADRO${championTeam ? ' · CAMPEÓN: ' + championTeam.name.toUpperCase() : ''}`;
    // Between rounds, show the round just played and what is left.
    const current = Math.max(0, Math.min(cup.round, cup.totalRounds) - 1);
    // Wide screens: the two halves meet at the final, so the whole bracket fits without scrolling.
    this.renderBracket(this.tournament_bracket, cup, current, current, { mirror: Boolean(window.matchMedia?.('(min-width: 1024px)').matches) });
    this.tournament_bracket_panel.classList.remove('hidden');
  }

  // Knockout bracket: one column per round; the player's path is highlighted
  // and the view scrolls to `focusRound`. With `mirror` (wide screens) each round
  // is split in two halves that meet at the final, so big draws fit in height.
  renderBracket(container, cup, focusRound = 0, fromRound = 0, { mirror = false } = {}) {
    const bracket = cup?.bracket; container.replaceChildren(); if (!bracket) return;
    const teamOf = id => id && (cup.teams.find(team => team.id === id) || getTeamById(id));
    const matchCard = match => {
      const card = document.createElement('div'); card.className = 'bracket-match';
      const mine = [match.home, match.away].includes(this.settings.teamId);
      card.classList.toggle('mine', mine); card.classList.toggle('pending', !match.winner);
      for (const side of ['home', 'away']) {
        const id = match[side], team = teamOf(id), row = document.createElement('div'); row.className = 'bracket-team';
        row.classList.toggle('winner', !!match.winner && match.winner === id); row.classList.toggle('loser', !!match.winner && !!id && match.winner !== id);
        row.classList.toggle('you', id === this.settings.teamId);
        const chip = document.createElement('i'); chip.className = 'bracket-chip'; chip.style.background = team ? getKitBackground(team) : 'transparent';
        const name = document.createElement('span'); name.textContent = team ? team.name.replace(/\s+CF$/i, '') : mirror ? '—' : 'Por decidir'; name.title = team?.name || '';
        const goals = document.createElement('b'); goals.textContent = match[`${side}Goals`] ?? '';
        row.append(chip, name, goals); card.append(row);
      }
      return card;
    };
    const column = (roundIndex, matches, side = '') => {
      const section = document.createElement('section'); section.className = `bracket-round${side ? ` bracket-${side}` : ''}`; section.dataset.round = String(roundIndex);
      const title = document.createElement('h4'); title.textContent = roundName(bracket.size, roundIndex + 1);
      const list = document.createElement('div'); list.className = 'bracket-matches'; list.append(...matches.map(matchCard));
      section.append(title, list); return section;
    };
    const rounds = bracket.rounds.map((matches, roundIndex) => ({ matches, roundIndex })).filter(item => item.roundIndex >= fromRound);
    const split = mirror && rounds.length >= 2 && rounds[0].matches.length >= 2;
    container.classList.toggle('bracket-mirror', split);
    if (split) {
      const last = rounds[rounds.length - 1], early = rounds.slice(0, -1);
      const half = matches => Math.ceil(matches.length / 2);
      container.append(...early.map(({ matches, roundIndex }) => column(roundIndex, matches.slice(0, half(matches)), 'left')),
        column(last.roundIndex, last.matches, 'final'),
        ...early.reverse().map(({ matches, roundIndex }) => column(roundIndex, matches.slice(half(matches)), 'right')));
      return;
    }
    container.append(...rounds.map(({ matches, roundIndex }) => column(roundIndex, matches)));
    requestAnimationFrame(() => { const focus = container.querySelector(`[data-round="${focusRound}"]`); if (focus) container.scrollLeft = Math.max(0, focus.offsetLeft - 12); });
  }

  launchTournamentRound() {
    const cup = this.tournament;
    cup.format ||= this.soloFormat();
    cup.round++;
    const stage = roundName(cup.size, cup.round);
    // Saves made before the bracket existed keep the original random pick.
    const bracketRival = cup.bracket ? bracketOpponent(cup.bracket, cup.round - 1, this.settings.teamId) : null;
    const opponentTeam = (bracketRival && (cup.teams.find(team => team.id === bracketRival) || getTeamById(bracketRival))) || pickChampionsOpponent(cup.teams, cup.round);
    const competition = CUP_COMPETITIONS.find(item => item.id === cup.competitionId) || CUP_COMPETITIONS[0];
    this.start('tournament', { opponentName: opponentTeam.name, opponentTeam, label: `${competition.name.toUpperCase()} · ${stage} · ${cup.round}/${cup.totalRounds}`, fieldTheme: competition.fieldTheme, competitionRound: cup.round, duo: cup.format === '2v2', mateDifficulty: this.mateDifficulty() }, true);
  }

  beginLeague() {
    const competitionId = this.league_competition.value;
    const team = getTeamById(this.settings.teamId);
    if (!this.profileComplete() || team?.type === 'national' || team?.league !== competitionId) {
      this.pendingMode = 'league'; this.pendingCompetition = 'league'; this.pendingTeamType = 'club'; this.pendingLeagueId = competitionId; this.openProfile(); return;
    }
    const schedule = createLeagueSchedule(competitionId, team.id);
    const opponents = schedule.map(fixtures => {
      const fixture = fixtures.find(item => item.homeId === team.id || item.awayId === team.id);
      return getTeamById(fixture.homeId === team.id ? fixture.awayId : fixture.homeId);
    });
    const goalTarget = [2, 3, 5].includes(Number(this.league_goal_target.value)) ? Number(this.league_goal_target.value) : 2;
    this.league = { jornada: 1, wins: 0, losses: 0, points: 0, status: 'playing', competitionId, playerTeamId: team.id, schedule, opponents, standings: createLeagueStandings(competitionId), matchResults: [], goalTarget, format: this.soloFormat() };
    this.tournament = null; this.launchLeagueRound();
  }

  ensureLeagueState(season = this.league) {
    if (!season) return;
    season.playerTeamId ||= this.settings.teamId;
    const savedTeam = getTeamById(season.playerTeamId);
    if (!savedTeam || savedTeam.league !== season.competitionId || savedTeam.type === 'national') {
      season.playerTeamId = TEAMS.find(team => team.league === season.competitionId)?.id || '';
    }
    if (!Array.isArray(season.schedule) || !season.schedule.length) {
      season.schedule = createLeagueSchedule(season.competitionId, season.playerTeamId, Math.random, season.opponents);
    }
    if (!Array.isArray(season.opponents) || !season.opponents.length) {
      season.opponents = season.schedule.map(fixtures => {
        const fixture = fixtures.find(item => item.homeId === season.playerTeamId || item.awayId === season.playerTeamId);
        return getTeamById(fixture?.homeId === season.playerTeamId ? fixture.awayId : fixture?.homeId);
      });
    }
    if (!Array.isArray(season.standings) || !season.standings.length) {
      season.standings = createLeagueStandings(season.competitionId);
      const playerRow = season.standings.find(row => row.teamId === season.playerTeamId);
      if (playerRow) {
        playerRow.wins = season.wins || 0; playerRow.losses = season.losses || 0;
        playerRow.points = season.points || 0; playerRow.played = playerRow.wins + playerRow.losses;
      }
    }
  }

  launchLeagueRound() {
    this.ensureLeagueState();
    const round = this.league.jornada, competition = TEAM_LEAGUES.find(item => item.id === this.league.competitionId);
    const totalRounds = this.league.opponents?.length || 16;
    const opponentTeam = this.league.opponents[round - 1] || null;
    const opponentName = opponentTeam?.name || 'RIVAL FC';
    this.start('league', { opponentName, opponentTeam, label: `LIGA NACIONAL · ${competition.label.split(' · ')[0].toUpperCase()} · JORNADA ${round}/${totalRounds} · A ${this.league.goalTarget}`, fieldTheme: `league-${competition.id}`, competitionRound: round, goalTarget: this.league.goalTarget, duo: this.league.format === '2v2', mateDifficulty: this.mateDifficulty() }, true);
  }

  start(mode, options = {}, preserveCompetition = false, snapshot = null) {
    if (mode === 'legends') {
      try { const duel = resolveLegendMatch(options.legendId, this.settings.teamId, this.progression.level); options = { ...options, difficulty: duel.difficulty, opponentTeam: duel.opponentTeam, opponentName: duel.opponentTeam.name }; }
      catch { this.openLegends(); return; }
    }
    if (mode !== 'career' && !this.profileComplete()) { this.pendingMode = mode; this.openProfile(); return; }
    if (!preserveCompetition) { this.tournament = null; this.league = null; }
    options = { ...options, modifiers: mode === 'online' ? DEFAULT_MODIFIERS : normalizeModifiers(snapshot?.modifiers || options.modifiers || this.settings.modifiers) };
    this.currentMatchMode = mode; this.currentMatchOptions = options; this.result_finish.disabled = false; this.hideRankProgress();
    document.querySelector('.game-header').classList.toggle('online-game-header', mode === 'online');
    this.countdown_banner.classList.add('hidden'); this.goal_banner.classList.add('hidden');
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden');
    this.result_rematch.classList.add('hidden'); this.result_online_status.classList.add('hidden'); this.hideConnectionStatus();
    // AI rivals: automatic level from the rival's stars, or the chosen one with "Dificultad personalizada".
    const aiMode = ['bot', 'league', 'tournament', 'career'].includes(mode);
    if (aiMode && !snapshot) options = { ...options, difficulty: this.rivalDifficulty(options.opponentTeam, options.difficulty) };
    this.currentMatchOptions = options;
    this.show('game'); this.game.start(mode, mode === 'legends' ? 'legend' : snapshot?.difficulty || options.difficulty || this.settings.difficulty, options);
    if (snapshot) this.game.restoreSnapshot(snapshot);
    this.trajectory_toggle.checked = this.game.trajectory; this.trajectory_enabled.checked = this.game.trajectory;
    this.hud_player_name.classList.remove('ranked-stack'); this.hud_opponent_name.classList.remove('ranked-stack');
    this.hud_player_name.textContent = this.settings.name.toUpperCase(); this.player_dot.style.background = (options.playerTeam || getTeamById(this.settings.teamId))?.primary || '#68746e';
    this.opponent_dot.style.background = options.opponentTeam?.primary || '#f19676';
    this.hud_opponent_name.textContent = mode === 'training' ? 'PRÁCTICA' : (options.opponentName || 'BOT');
    // 100 % reward: golden name online and golden name/number on the kit with any team.
    const gold = this.goldUnlocked();
    if (this.game.player) this.game.player.goldKit = gold && !!this.settings.goldKit;
    if (this.game.bot && mode === 'online' && !options.squad) this.game.bot.goldKit = !!options.opponentGoldKit;
    this.hud_player_name.classList.toggle('gold-name', mode === 'online' && gold);
    this.hud_opponent_name.classList.toggle('gold-name', mode === 'online' && !!options.opponentGold);
    const baseLabel = options.label || (mode === 'training' ? 'MODO ENTRENAMIENTO' : `PARTIDO · ${difficultyLabel(this.settings.difficulty).toUpperCase()}`);
    const target = `A ${this.game.goalTarget} ${this.game.goalTarget === 1 ? 'GOL' : 'GOLES'}`;
    let label = mode === 'training' ? baseLabel : /\bA \d+(?: GOLES)?\b/.test(baseLabel) ? baseLabel.replace(/\bA \d+(?: GOLES)?\b/g, target) : `${baseLabel} · ${target}`;
    if (aiMode) label += ` · ${this.settings.customDifficulty ? 'IA' : `RIVAL ${'★'.repeat(Math.max(1, Math.min(5, options.opponentTeam?.stars || 3)))} · IA`} ${difficultyLabel(this.game.botAI.difficulty).toUpperCase()}`;
    const duo = !!options.duo && ['bot', 'tournament', 'league', 'career'].includes(mode);
    this.mode_label.textContent = (mode !== 'online' && this.game.gameplay === 'classic' ? 'JUGABILIDAD CLÁSICA · ' : '') + (duo ? `2 CONTRA 2 · IA ${difficultyLabel(options.mateDifficulty || 'normal').toUpperCase()} · ` : '') + (modifiersAreDefault(options.modifiers) ? '' : 'REGLAS PERSONALIZADAS · ') + label;
    if (duo) this.hud_player_name.textContent = `${this.settings.name.toUpperCase()} + IA`;
    this.training_tools.classList.toggle('hidden', mode !== 'training');
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden'); this.goal_banner.classList.add('hidden');
    document.getElementById('pause-button').textContent = 'Ⅱ';
    document.getElementById('pause-button').classList.toggle('hidden', mode === 'online');
    this.renderMatchPresentation(mode, options, !snapshot);
    this.updatePowerCooldown(this.game.player?.powerCooldown || 0); this.saveCurrentCompetition();
  }

  renderMatchPresentation(mode, options, animate = true) {
    const profiles = [
      { team: options.playerTeam || getTeamById(this.settings.teamId), player: this.game.player, level: this.progression.level },
      { team: options.opponentTeam, player: this.game.bot, level: options.opponentLevel || 1 },
    ];
    for (const [index, node] of [this.online_player_details, this.online_opponent_details].entries()) {
      node.classList.toggle('hidden', mode !== 'online');
      const profile = profiles[index];
      const username = index === 0 ? options.playerUsername || this.hub?.identity?.username : options.opponentUsername;
      const elo = index === 0 ? options.playerElo ?? this.hub?.identity?.elo : options.opponentElo;
      node.textContent = `${username ? '@' + username + ' · ' + (elo ?? 500) + ' ELO · ' : ''}${profile.team?.name || 'EQUIPO'} · #${profile.player?.number ?? 10} · NIVEL ${profile.level}`;
    }
    this.match_intro.replaceChildren(); this.match_intro.classList.add('hidden');
    if (!animate || mode === 'training') return;
    const title = document.createElement('small'); title.className = 'intro-kicker'; title.textContent = 'EL PARTIDO ESTÁ A PUNTO DE EMPEZAR';
    const row = document.createElement('div'); row.className = 'intro-teams';
    profiles.forEach((profile, index) => {
      if (index) { const vs = document.createElement('b'); vs.className = 'intro-versus'; vs.textContent = 'VS'; row.append(vs); }
      const card = document.createElement('div'); card.className = 'intro-team';
      const circle = document.createElement('span'); circle.className = 'match-team-preview';
      this.paintPlayerPreview(circle, profile.team, { name: profile.player?.name || 'RIVAL', number: profile.player?.number ?? 10 });
      const team = document.createElement('b'); team.textContent = profile.team?.name || 'RIVAL';
      const name = document.createElement('span'); name.textContent = `${profile.player?.name || 'RIVAL'} · #${profile.player?.number ?? 10}`;
      card.append(circle, team, name);
      if (mode === 'online') { const level = document.createElement('small'); level.textContent = `NIVEL ${profile.level}`; card.append(level); }
      row.append(card);
    });
    this.match_intro.append(title, row); this.match_intro.classList.remove('hidden');
  }

  openModifiers() {
    this.modifierReturnView = this.currentView || 'play';
    this.modifierResume = this.modifierReturnView === 'game' && this.currentMatchMode !== 'online' && !this.game.state.paused;
    if (this.modifierResume) this.game.setPaused(true);
    this.modifierLocked = this.currentMatchMode === 'online' || this.currentView === 'online';
    const shared = this.onlineMatch?.role === 'host' ? this.onlineMatch.profile?.modifiers : this.onlineMatch?.opponent?.modifiers || this.onlineMatch?.profile?.modifiers;
    this.modifierValues = normalizeModifiers(this.modifierLocked ? DEFAULT_MODIFIERS : this.settings.modifiers);
    this.modifiers_note.textContent = this.modifierLocked ? 'El online utiliza siempre las reglas por defecto. Los modificadores solo están disponibles en los modos sin conexión.' : this.modifierReturnView === 'game' ? 'La partida actual conserva sus reglas. Tus cambios se aplicarán al próximo partido.' : 'Los modificadores solo afectan a los modos sin conexión. El online siempre usa reglas por defecto.';
    this.renderModifiers(); this.show('modifiers');
  }
  renderModifiers() {
    this.modifier_controls.replaceChildren(...MODIFIER_OPTIONS.map(option => {
      const row = document.createElement('div'); row.className = 'modifier-row';
      const label = document.createElement('label'); label.htmlFor = `modifier-${option.key}`; label.textContent = option.label;
      const output = document.createElement('output'); output.id = `modifier-value-${option.key}`; output.htmlFor = `modifier-${option.key}`; output.textContent = formatModifier(option, this.modifierValues[option.key]);
      const description = document.createElement('p'); description.textContent = option.description;
      const input = document.createElement('input'); input.type = 'range'; input.id = label.htmlFor; input.min = option.min; input.max = option.max; input.step = option.step; input.value = this.modifierValues[option.key]; input.disabled = this.modifierLocked;
      input.setAttribute('aria-describedby', `modifier-description-${option.key}`); description.id = `modifier-description-${option.key}`;
      input.addEventListener('input', () => { this.modifierValues[option.key] = Number(input.value); output.textContent = formatModifier(option, Number(input.value)); this.updateModifierPreview(); });
      input.addEventListener('change', () => this.saveModifiers());
      row.append(label, output, description, input); return row;
    }));
    this.modifiers_reset.disabled = this.modifierLocked;
    document.querySelectorAll('[data-modifier-preset]').forEach(button => { button.disabled = this.modifierLocked; });
    this.modifiers_done.firstChild.textContent = this.modifierLocked ? 'Volver ' : 'Guardar y volver ';
    this.updateModifierPreview();
  }
  updateModifierPreview() {
    const rules = this.modifierValues;
    document.getElementById('modifier-ball').setAttribute('r', 6 * rules.ballSize);
    for (const side of ['left', 'right']) {
      document.getElementById(`modifier-${side}-player`).setAttribute('r', 11 * rules.playerSize);
      const goal = document.getElementById(`modifier-${side}-goal`); const depth = Math.max(15, 12 * rules.ballSize + 3); goal.setAttribute('width', depth); goal.setAttribute('x', side === 'left' ? 30 - depth : 230); goal.setAttribute('y', 80 - 35 * rules.goalSize); goal.setAttribute('height', 70 * rules.goalSize);
    }
    const count = MODIFIER_OPTIONS.filter(option => rules[option.key] !== option.default).length;
    this.modifier_summary.textContent = count ? `${count} modificadores activos` : 'Reglas por defecto';
  }
  saveModifiers() {
    if (this.modifierLocked) return;
    this.settings.modifiers = normalizeModifiers(this.modifierValues); this.persist();
  }
  closeModifiers() {
    this.saveModifiers(); this.show(this.modifierReturnView || 'play');
    if (this.modifierResume) this.game.setPaused(false);
    this.modifierResume = false;
  }

  updateScore(player, bot) { this.score.innerHTML = `${player} <small>:</small> ${bot}`; }
  updateTime(time) { if (this.timer.textContent !== time) this.timer.textContent = time; }
  updatePowerCooldown(seconds) {
    const total = this.game?.modifiers?.powerCooldown || 20;
    const key = `${Math.ceil(seconds * 10)}|${total}`; if (key === this.lastPowerHud) return; this.lastPowerHud = key;
    this.shot_power_time.textContent = seconds > 0 ? `${Math.ceil(seconds)}s` : 'LISTO';
    const status = document.getElementById('shot-power-status');
    status.classList.toggle('ready', seconds <= 0);
    status.style.setProperty('--power-progress', `${Math.max(0, Math.min(100, (1 - seconds / total) * 100))}%`);
    status.setAttribute('aria-label', seconds > 0 ? `Tiro de fuego disponible en ${Math.ceil(seconds)} segundos` : 'Tiro de fuego disponible');
  }

  openOnline() {
    this.autoMatchmaking = false; this.show('online');
    this.hub?.open().catch(error => this.hub.message(error.message, true));
  }
  createOnlineRoom() { return this.hub.action('create', { kind: 'quick', size: this.hub.formats.quick }); }
  findOnlineMatch() { return this.hub.action('queue', { kind: 'quick', size: this.hub.formats.quick }); }
  joinOnlineRoom() { return this.hub.action('join', { kind: 'quick', code: this.online_room_input.value }); }
  onlinePlayer() { const gold = this.goldUnlocked(); return { name: this.settings.name, number: this.settings.number, teamId: this.settings.teamId, modifiers: DEFAULT_MODIFIERS, level: this.progression.level, gold, goldKit: gold && !!this.settings.goldKit,
    userId: this.user?.id || '', username: this.hub?.identity?.username || '', elo: this.hub?.identity?.elo ?? 500 }; }

  updateOnlineStatus(status, detail = '') {
    if (!this.online_status) return;
    this.online_room_panel.classList.toggle('hidden', status === 'idle');
    const messages = {
      idle: '', connecting: this.autoMatchmaking ? 'Conectando con tu rival…' : 'Conectando con Supabase Realtime…',
      ready: this.autoMatchmaking ? 'Conexión lista. Esperando a tu rival…' : this.onlineMatch?.role === 'host' ? 'Sala creada. Comparte el código y espera a tu rival.' : 'Conectado. Buscando la sala…',
      searching: 'Buscando rival… Te emparejaremos en cuanto haya alguien disponible.',
      matching: 'Rival encontrado. Preparando el partido…',
      waiting: 'Sala encontrada. Preparando el partido…', 'peer-left': 'Tu rival se ha desconectado.',
    };
    this.online_cancel.textContent = ['searching', 'matching'].includes(status) || (this.autoMatchmaking && ['connecting', 'ready'].includes(status)) ? 'Cancelar búsqueda' : 'Cancelar sala';
    this.online_status.textContent = status === 'error' ? (detail || 'No se pudo conectar. Comprueba el código e inténtalo de nuevo.') : (messages[status] || 'Conectando…');
    this.online_status.classList.toggle('error', status === 'error' || status === 'peer-left');
  }

  async copyOnlineRoomCode() {
    try {
      await navigator.clipboard.writeText(this.online_room_code.textContent);
      this.online_status.textContent = 'Código copiado. Envíalo a tu rival.';
      this.online_status.classList.remove('error');
    } catch { this.online_status.textContent = `Comparte este código: ${this.online_room_code.textContent}`; }
  }

  startOnlineMatch(info) {
    this.autoMatchmaking = false;
    const other = info.opponent || {};
    const opponentTeam = getTeamById(other.teamId);
    const team = opponentTeam || null;
    this.online_room_panel.classList.add('hidden');
    this.result_rematch.disabled = false; this.result_rematch.innerHTML = 'Pedir revancha <span>↻</span>';
    this.result_online_status.classList.add('hidden');
    const kind = this.hub?.lobby?.kind;
    let label = kind === 'ranked' ? 'ONLINE · RANKED' : kind === 'tournament' ? 'ONLINE · TORNEO' : 'ONLINE · PARTIDO RÁPIDO';
    // 2v2: each side wears its captain's kit and shows both usernames.
    const squad = info.squad || null, teamExtras = {};
    if (squad) {
      const mine = squad.localSeat < 2 ? [0, 1] : [2, 3], rivals = squad.localSeat < 2 ? [2, 3] : [0, 1];
      const names = seats => seats.map(seat => squad.seats[seat]?.username || squad.seats[seat]?.name || 'jugador').join(' + @');
      const elo = seats => Math.round(seats.reduce((sum, seat) => sum + (Number(squad.seats[seat]?.elo) || 500), 0) / 2);
      Object.assign(teamExtras, { squad, playerTeam: getTeamById(squad.seats[mine[0]]?.teamId) || null, playerUsername: names(mine), playerElo: elo(mine),
        opponentTeam: getTeamById(squad.seats[rivals[0]]?.teamId) || null, opponentUsername: names(rivals), opponentElo: elo(rivals), opponentName: squad.seats[rivals[0]]?.name || 'RIVAL', opponentNumber: squad.seats[rivals[0]]?.number });
      label += ' · 2V2';
    }
    this.start('online', {
      modifiers: DEFAULT_MODIFIERS, localSide: info.localSide, opponentName: other.name || 'RIVAL', opponentNumber: other.number, opponentLevel: other.level || 1,
      opponentTeam: team, opponentUsername: other.username, opponentElo: other.elo, opponentGold: !!other.gold, opponentGoldKit: !!other.goldKit, roomCode: info.roomCode, label, ...teamExtras,
    });
    // Names with rank badges: both teammates in 2v2.
    const people = seats => seats.map(seat => ({ name: squad.seats[seat]?.username || squad.seats[seat]?.name || 'jugador', elo: squad.seats[seat]?.elo }));
    const mine = squad ? people(squad.localSeat < 2 ? [0, 1] : [2, 3]) : [{ name: this.hub?.identity?.username || this.settings.name, elo: this.hub?.identity?.elo }];
    const rivals = squad ? people(squad.localSeat < 2 ? [2, 3] : [0, 1]) : [{ name: other.username || other.name || 'rival', elo: other.elo }];
    this.setRankedNames(this.hud_player_name, mine, ''); this.setRankedNames(this.hud_opponent_name, rivals, '');
    this.currentMatchOptions.rankedNames = { player: mine, opponent: rivals };
    if (teamExtras.playerTeam) this.player_dot.style.background = teamExtras.playerTeam.primary;
    // Reconnected or reloaded host: continue from the last known score and time.
    const resume = info.resume || (info.role === 'host' && this.lastOnlineResume?.matchId === this.onlineMatch?.assignment?.matchId ? this.lastOnlineResume : null);
    if (info.role === 'host' && resume && this.game.applyResume(resume)) this.hub?.message('Partido reanudado.');
    this.lastOnlineResume = null;
  }

  // "@a + @b" with rank badges (HUD, final scoreboard).
  setRankedNames(node, people, separator = ' + ') {
    node.replaceChildren(); node.classList.toggle('ranked-stack', !separator && people.length > 1);
    people.forEach((person, index) => {
      if (index && separator) node.append(separator);
      const name = document.createElement('span'); name.className = 'ranked-name';
      name.append(rankBadge(person.elo, { size: 16 }), `@${person.name}`);
      node.append(name);
    });
  }

  // Ranked result: animated bar from the old ELO to the new one, tier by tier.
  showRankProgress(before, after) {
    const overlay = this.rank_overlay; if (!overlay) return;
    clearTimeout(this.rankTimer); this.rankAnimation = (this.rankAnimation || 0) + 1;
    const run = this.rankAnimation, delta = after - before, start = rankProgress(before), end = rankProgress(after);
    const big = document.getElementById('rank-current-icon'), fill = document.getElementById('rank-bar-fill');
    const title = document.getElementById('rank-title'), message = document.getElementById('rank-message'), eloNode = document.getElementById('rank-elo');
    const deltaNode = document.getElementById('rank-delta');
    deltaNode.textContent = `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} ELO`; deltaNode.dataset.sign = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    message.textContent = ''; overlay.classList.remove('hidden'); document.getElementById('rank-continue').focus({ preventScroll: true });
    const paint = progress => {
      big.innerHTML = rankIconSvg(progress.rank, 104); big.dataset.rank = progress.rank.id;
      title.textContent = progress.rank.name; overlay.dataset.rank = progress.rank.id;
      document.getElementById('rank-bar-from').innerHTML = rankIconSvg(progress.rank, 30);
      document.getElementById('rank-bar-to').innerHTML = progress.next ? rankIconSvg(progress.next, 30) : '';
      document.getElementById('rank-bar-min').textContent = progress.from;
      document.getElementById('rank-bar-max').textContent = progress.next ? `${progress.next.name} · ${progress.to}` : 'Rango máximo';
    };
    const finish = () => {
      if (run !== this.rankAnimation) return;
      eloNode.textContent = `${after} ELO`; fill.style.transition = 'none'; fill.style.width = `${end.ratio * 100}%`; paint(end);
      const changed = start.rank.id !== end.rank.id, up = after > before;
      message.textContent = changed ? (up ? `¡Has ascendido a ${end.rank.name}!` : `Has bajado a ${end.rank.name}. ¡A por la revancha!`)
        : end.next ? `Te faltan ${end.to - after} ELO para ${end.next.name}.` : 'Estás en el rango más alto. ¡Defiéndelo!';
      overlay.dataset.result = changed ? (up ? 'up' : 'down') : 'same';
    };
    paint(start); eloNode.textContent = `${before} ELO`; overlay.dataset.result = '';
    fill.style.transition = 'none'; fill.style.width = `${start.ratio * 100}%`;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    // ELO counter.
    const counterStart = performance.now(), segments = rankJourney(before, after), total = Math.max(1, segments.length) * 1100 + 300;
    const count = now => { if (run !== this.rankAnimation) return; const t = Math.min(1, (now - counterStart) / total); eloNode.textContent = `${Math.round(before + (after - before) * t)} ELO`; if (t < 1) requestAnimationFrame(count); };
    requestAnimationFrame(count);
    const step = (index, entered = null) => {
      if (run !== this.rankAnimation) return;
      const segment = segments[index]; if (!segment) { finish(); return; }
      const progress = rankProgress(segment.rank.min === 0 ? segment.rank.floor : segment.rank.min);
      paint(progress);
      // Just changed tier: the new badge pops in (or drops) as the bar restarts.
      if (entered) {
        big.classList.remove('rank-pop', 'rank-drop'); void big.offsetWidth; big.classList.add(entered === 'up' ? 'rank-pop' : 'rank-drop');
        if (entered === 'up') this.sound?.play('goal');
      }
      fill.style.transition = 'none'; fill.style.width = `${segment.from * 100}%`; void fill.offsetWidth;
      fill.style.transition = 'width .9s cubic-bezier(.25,.8,.3,1)'; fill.style.width = `${segment.to * 100}%`;
      this.rankTimer = setTimeout(() => step(index + 1, segment.change), segment.change ? 1150 : 950);
    };
    this.rankTimer = setTimeout(() => step(0), 350);
  }
  // All tiers as one progress ladder (one equal segment per tier) with your position.
  showRanks() {
    const overlay = document.getElementById('ranks-overlay'), identity = this.hub?.identity;
    const elo = identity ? Number(identity.elo) : null, current = elo === null ? -1 : rankIndex(elo), progress = elo === null ? null : rankProgress(elo);
    const you = document.getElementById('ranks-you'); you.replaceChildren();
    if (progress) {
      const badge = document.createElement('span'); badge.className = 'ranks-you-icon'; badge.innerHTML = rankIconSvg(progress.rank, 64);
      const text = document.createElement('div'); text.className = 'ranks-you-text';
      const name = document.createElement('b'); name.textContent = `@${identity.username} · ${progress.rank.name}`;
      const detail = document.createElement('small'); detail.textContent = progress.next ? `${elo} ELO · te faltan ${progress.to - elo} para ${progress.next.name}` : `${elo} ELO · rango máximo`;
      text.append(name, detail); you.append(badge, text);
    } else you.textContent = 'Inicia sesión y juega Ranked para conseguir tu rango. Todos empiezan en Amateur (500 ELO).';
    // Ladder: past tiers full, the current one by progress, the rest empty.
    const ladder = document.getElementById('ranks-ladder'); ladder.replaceChildren();
    const track = document.createElement('div'); track.className = 'ranks-track';
    RANKS.forEach((rank, index) => {
      const segment = document.createElement('div'); segment.className = 'ranks-segment'; segment.dataset.rank = rank.id;
      segment.classList.toggle('reached', index <= current); segment.classList.toggle('current', index === current);
      const fill = document.createElement('i'); fill.style.width = `${index < current ? 100 : index === current ? progress.ratio * 100 : 0}%`;
      const tick = document.createElement('span'); tick.className = 'ranks-tick'; tick.innerHTML = rankIconSvg(rank, index === current ? 34 : 26);
      const label = document.createElement('small'); label.textContent = rank.floor;
      segment.append(fill, tick, label); track.append(segment);
    });
    ladder.append(track);
    if (progress) {
      // Leyenda has no ceiling: its marker moves across the last segment up to 1000 ELO.
      const within = progress.next ? progress.ratio : Math.min(1, (elo - progress.rank.floor) / 200);
      const marker = document.createElement('span'); marker.className = 'ranks-marker'; marker.textContent = 'TÚ';
      marker.style.left = `${Math.min(99, (current + within) / RANKS.length * 100)}%`;
      ladder.append(marker);
    }
    const list = document.getElementById('ranks-list'); list.replaceChildren();
    RANKS.forEach((rank, index) => {
      const next = RANKS[index + 1];
      const item = document.createElement('li'); item.className = 'ranks-item'; item.dataset.rank = rank.id;
      item.classList.toggle('current', index === current); item.classList.toggle('locked', index > current);
      const icon = document.createElement('span'); icon.innerHTML = rankIconSvg(rank, 40);
      const text = document.createElement('div');
      const name = document.createElement('b'); name.textContent = rank.name;
      const range = document.createElement('small'); range.textContent = index === 0 ? `Hasta ${next.min - 1} ELO · empiezas en 500` : next ? `${rank.min}–${next.min - 1} ELO` : `${rank.min} ELO o más`;
      text.append(name, range);
      const state = document.createElement('em');
      state.textContent = index === current ? 'TU RANGO' : index < current ? 'CONSEGUIDO' : elo === null ? (index === 0 ? 'INICIAL' : `${rank.min} ELO`) : `FALTAN ${rank.min - elo}`;
      item.append(icon, text, state); list.append(item);
    });
    overlay.classList.remove('hidden'); document.getElementById('ranks-done').focus({ preventScroll: true });
  }

  hideRankProgress() { this.rankAnimation = (this.rankAnimation || 0) + 1; clearTimeout(this.rankTimer); this.rank_overlay?.classList.add('hidden'); }

  handleOnlinePeerLeft() {
    const matchId = this.onlineMatch?.assignment?.matchId;
    if (matchId && this.currentMatchMode === 'online' && this.game?.state.running && !this.game.state.matchOver) this.lastOnlineResume = this.game.resumeState(matchId);
    this.onlineMatch?.leave(false);
    if (this.currentMatchMode === 'online') {
      this.game?.stop(); this.currentMatchMode = null; this.currentMatchOptions = null;
      this.show('online'); this.online_room_panel.classList.remove('hidden');
      this.updateOnlineStatus('peer-left');
      // Server rooms: forget the connection so the hub reconnects to the same match while it is open.
      if (this.hub?.lobby && matchId) { this.hub.connectedMatchId = null; this.hub.message('Se ha perdido la conexión con la partida. Intentando reconectar… Si alguien no vuelve, la sala se resuelve sola en 90 segundos.', true); }
      else this.hub?.message('Conexión perdida. Esperando la resolución de la sala; puedes salir o esperar la reconexión.', true);
    }
  }

  // Where this online match was, in host order, to resume it after a reload or reconnection.
  onlineResume() {
    const matchId = this.onlineMatch?.assignment?.matchId;
    if (!matchId) return null;
    if (this.currentMatchMode === 'online' && this.game?.state.running && !this.game.state.matchOver) return this.game.resumeState(matchId);
    return this.lastOnlineResume?.matchId === matchId ? this.lastOnlineResume : null;
  }

  checkHostStall() {
    const match = this.onlineMatch, game = this.game;
    const stalled = this.currentMatchMode === 'online' && match?.role === 'guest' && match.matched && !match.peerDisconnectedAt && match.lastSnapshotAt > 0
      && Date.now() - match.lastSnapshotAt > 3000 && game?.state.running && !game.state.matchOver && this.result_overlay.classList.contains('hidden');
    if (stalled) {
      this.connection_banner.textContent = 'Esperando al anfitrión de la partida… Puede tener mala conexión o el juego en segundo plano.';
      this.connection_banner.classList.remove('hidden'); this.hostStallShown = true;
    } else if (this.hostStallShown) { this.hostStallShown = false; if (!match?.peerDisconnectedAt) this.hideConnectionStatus(); }
  }

  // Goal replay overlay. Online, the replay only ends early once both players skip.
  updateReplay(info) {
    this.replay_banner.classList.toggle('hidden', !info);
    if (!info) return;
    const touch = window.matchMedia?.('(pointer:coarse)').matches;
    const skipHint = this.controller?.index !== null && this.controller?.index !== undefined ? 'Pulsa ✕ / A para saltar' : touch ? 'Toca Saltar o DISPARAR' : 'Pulsa ESPACIO para saltar';
    // Rotated (portrait) pitch: keep the banner away from the goal being replayed.
    this.replay_banner.classList.toggle('at-bottom', !!this.game?.renderer.rotated && this.game.state.goalSide === 1);
    this.replay_skip.disabled = info.localSkip;
    this.replay_skip.innerHTML = info.localSkip ? 'Saltada <span aria-hidden="true">✓</span>' : 'Saltar <span aria-hidden="true">⏭</span>';
    this.replay_status.textContent = !info.online ? skipHint
      : info.players ? (info.localSkip ? `Esperando a los demás · ${info.skipped}/${info.players} han saltado` : `Los cuatro debéis saltar · ${info.skipped}/${info.players}`)
      : info.localSkip ? (info.remoteSkip ? 'Continuando…' : 'Esperando a que tu rival salte…')
        : info.remoteSkip ? 'Tu rival ya ha saltado · salta para continuar' : 'Los dos debéis saltar para continuar';
  }

  showConnectionStatus(seconds) {
    this.connection_banner.textContent = `${this.currentMatchOptions?.squad ? 'Conexión con el anfitrión de la partida perdida' : 'Conexión con tu rival perdida'}. Reconectando… ${seconds}s`;
    this.connection_banner.classList.remove('hidden');
  }

  hideConnectionStatus() { this.connection_banner.classList.add('hidden'); }

  showRematchRequest() {
    if (this.currentMatchMode !== 'online' || this.result_overlay.classList.contains('hidden')) return;
    this.result_rematch.disabled = false;
    this.result_rematch.innerHTML = 'Aceptar revancha <span>↻</span>';
    this.result_online_status.textContent = 'Tu rival quiere jugar otra vez. Acepta para empezar.';
    this.result_online_status.classList.remove('hidden');
  }

  requestOnlineRematch() {
    // Server rooms (quick / ranked) use the database rematch; legacy direct rooms keep the realtime vote.
    if (this.hub?.lobby) { this.hub.requestRematch(); return; }
    this.result_rematch.disabled = true;
    this.result_rematch.innerHTML = 'Esperando al rival… <span>⌛</span>';
    this.result_online_status.textContent = 'Se iniciará cuando ambos aceptéis.';
    this.result_online_status.classList.remove('hidden');
    this.onlineMatch?.requestRematch();
  }

  async loadLeaderboard() {
    this.leaderboard_refresh.disabled = true;
    this.leaderboard_message.textContent = 'Cargando resultados…';
    this.leaderboard_list.replaceChildren(); this.renderLeaderboardPodium([]);
    try {
      const rows = await this.accountService?.onlineAction('leaderboard');
      if (!Array.isArray(rows)) throw new Error('No se pudo conectar con la clasificación.');
      if (!rows.length) { this.leaderboard_message.textContent = 'Aún no hay resultados. Juega online e inicia sesión para aparecer aquí.'; return; }
      this.leaderboard_message.textContent = this.user
        ? 'Clasificación Ranked · resultados confirmados.'
        : 'Inicia sesión para consultar la clasificación Ranked.';
      rows.forEach((row, index) => {
        const item = document.createElement('li'); item.className = 'leaderboard-row';
        const place = document.createElement('b'); place.className = 'leaderboard-place'; place.textContent = String(index + 1).padStart(2, '0');
        const name = document.createElement('span'); name.className = 'leaderboard-name'; name.textContent = '@' + row.username; name.prepend(rankBadge(row.elo, { size: 20 }));
        const record = document.createElement('small'); record.textContent = `${row.elo} ELO · ${row.ranked_wins}V · ${row.ranked_played}P`;
        item.append(place, name, record); this.leaderboard_list.append(item);
      });
      this.renderLeaderboardPodium(rows);
    } catch (error) {
      this.leaderboard_message.textContent = error?.message || 'No se pudo cargar la clasificación.';
    } finally { this.leaderboard_refresh.disabled = false; }
  }

  // Top three as panels plus the signed-in player's position (when in the top 50).
  renderLeaderboardPodium(rows) {
    const podium = document.getElementById('leaderboard-podium'), you = document.getElementById('leaderboard-you');
    if (!podium || !you) return;
    podium.replaceChildren(...rows.slice(0, 3).map((row, index) => {
      const tile = document.createElement('div'); tile.className = `podium-tile podium-${index + 1}`;
      const place = document.createElement('b'); place.className = 'podium-place'; place.textContent = String(index + 1);
      const name = document.createElement('span'); name.className = 'podium-name'; name.textContent = `@${row.username}`;
      const detail = document.createElement('small'); detail.textContent = `${rankFor(row.elo).name} · ${row.elo} ELO · ${row.ranked_wins}V`;
      const badge = document.createElement('span'); badge.className = 'podium-badge'; badge.innerHTML = rankIconSvg(row.elo, 40);
      tile.append(place, badge, name, detail); return tile;
    }));
    if (!rows.length) podium.append(Object.assign(document.createElement('p'), { className: 'online-match-hint', textContent: 'El podio aparecerá con los primeros resultados Ranked.' }));
    const identity = this.hub?.identity, at = identity ? rows.findIndex(row => row.username === identity.username) : -1;
    you.classList.toggle('hidden', !identity);
    if (identity) you.textContent = at >= 0 ? `Tu posición: ${at + 1}.º de ${rows.length} · ${identity.elo} ELO` : `Aún no estás en el top ${rows.length || 50} · ${identity.elo} ELO`;
  }

  async cancelOnlineRoom() { return this.hub.action('leave'); }

  saveCurrentCompetition(snapshot = null) {
    const mode = this.tournament ? 'tournament' : this.league ? 'league' : null;
    if (!mode || !this.currentMatchMode) return false;
    if (this.league?.status === 'complete' || ['champion', 'eliminated'].includes(this.tournament?.status)) {
      clearCompetitionSave(); this.refreshContinueButton(null); return false;
    }
    const game = snapshot || this.game?.captureSnapshot();
    if (!game) return false;
    const saved = {
      version: 1, savedAt: Date.now(),
      competition: { mode, tournament: this.tournament, league: this.league },
      match: { mode: this.currentMatchMode, options: this.currentMatchOptions || {} },
      game,
    };
    const ok = storeCompetitionSave(saved);
    if (ok) this.refreshContinueButton(saved);
    this.syncAccount(false);
    return ok;
  }

  refreshContinueButton(saved = loadCompetitionSave()) {
    if (!this.continue_competition) return;
    if (!saved) { this.continue_competition.classList.add('hidden'); this.play_continue_wrap.classList.add('hidden'); return; }
    const competition = saved.competition || {};
    if (competition.mode === 'league') {
      const league = competition.league || {};
      const total = league.opponents?.length || 16;
      this.continue_detail.textContent = league.status === 'next' ? `SIGUIENTE · JORNADA ${Math.min(total, (league.jornada || 1) + 1)}/${total}` : `LIGA · JORNADA ${league.jornada || 1}/${total}`;
    } else {
      const cup = competition.tournament || {};
      const stage = roundName(cup.size || 16, cup.round || 1);
      const cupName = CUP_COMPETITIONS.find(item => item.id === cup.competitionId)?.name || 'Champions';
      this.continue_detail.textContent = cup.status === 'next' ? `${cupName.toUpperCase()} · SIGUIENTE RONDA` : `${cupName.toUpperCase()} · ${stage}`;
    }
    this.continue_competition.classList.remove('hidden');
    this.play_continue_wrap.classList.remove('hidden');
  }

  resumeCompetition() {
    const saved = loadCompetitionSave();
    if (!saved) { this.refreshContinueButton(null); return; }
    this.tournament = saved.competition.mode === 'tournament' ? saved.competition.tournament : null;
    this.league = saved.competition.mode === 'league' ? saved.competition.league : null;
    if (this.league) {
      this.ensureLeagueState();
      if (this.settings.teamId !== this.league.playerTeamId) {
        this.settings.teamId = this.league.playerTeamId; this.persist(); this.updateHomeClub();
      }
    }
    this.sound?.play('click');
    const finishedRound = saved.game.matchOver && (this.league?.status === 'next' || this.tournament?.status === 'next');
    if (finishedRound) { this.advanceCompetition(); return; }
    this.start(saved.match.mode, saved.match.options || {}, true, saved.game);
  }

  saveAndQuit() {
    // A career match left half-way is not recorded: it is played again from the start.
    if (this.currentMatchMode === 'career') { this.leaveCareerMatch(); return; }
    if (this.currentMatchMode === 'online' && this.hub?.lobby) { this.hub.action('leave'); return; }
    if (this.currentMatchMode === 'online') this.onlineMatch?.leave();
    this.game?.setPaused(true); this.saveCurrentCompetition(); this.game?.stop();
    this.syncAccount(true);
    this.currentMatchMode = null; this.currentMatchOptions = null;
    this.show('home'); this.goal_banner.classList.add('hidden'); this.countdown_banner.classList.add('hidden');
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden'); this.refreshContinueButton();
  }

  showCountdown(value) {
    if (value === null || value <= 3) this.match_intro.classList.add('hidden');
    if (value === null || value === undefined) { this.countdown_banner.classList.add('hidden'); return; }
    this.countdown_banner.textContent = String(value); this.countdown_banner.classList.remove('hidden');
    this.countdown_banner.classList.remove('countdown-tick'); void this.countdown_banner.offsetWidth; this.countdown_banner.classList.add('countdown-tick');
  }
  goal() { this.controller?.rumble(.5,240); this.goal_banner.classList.remove('hidden'); setTimeout(() => this.goal_banner.classList.add('hidden'), 1500); }

  handleMatchEnd(result) {
    const won = result.winner === 'player';
    if (result.mode !== 'training') this.career.recordMatch(won, { playerScore: result.playerScore, elapsedSeconds: result.elapsedSeconds });
    const rivalStars = ['bot', 'league', 'tournament', 'career'].includes(result.mode) ? (this.currentMatchOptions?.opponentTeam?.stars || 0) : 0;
    const xpMultiplier = won && rivalStars ? starXpMultiplier(rivalStars) : 1;
    const reward = result.mode !== 'training' ? this.progression.awardMatch(won, xpMultiplier) : null;
    if (won) this.confetti.play();
    this.sound?.play(won ? 'win' : 'loss');
    this.renderProgress();
    const rewardText = !reward ? 'Entrenamiento completado.' : reward.gained ? `+${reward.gained} XP por jugar${xpMultiplier > 1 ? ` (+${Math.round((xpMultiplier - 1) * 100)} % por ganar a un rival de ${rivalStars}★)` : ''}.` : 'Nivel máximo.';
    const levelText = reward?.leveledUp ? ` ¡Has subido al nivel ${reward.level}!` : '';
    this.result_xp.textContent = reward ? (reward.gained ? `+${reward.gained} XP` : 'NIVEL MÁXIMO') : '0 XP';
    this.result_level.textContent = `NIVEL ${this.progression.level}`;
    this.result_xp_fill.style.width = `${this.progression.progressRatio() * 100}%`;
    this.result_copy.textContent = `${rewardText}${levelText}`;
    this.renderScoreboard(result, won);
    this.result_next.classList.add('hidden'); this.result_rematch.classList.add('hidden'); this.result_rematch_status.classList.add('hidden'); this.result_online_status.classList.add('hidden'); this.league_standings_panel.classList.add('hidden'); this.result_finish.textContent = 'Volver al menú';
    this.result_eyebrow.textContent = this.matchEyebrow(result.mode); this.result_title.textContent = won ? 'Victoria' : 'Derrota';

    let cupFinal = false, cupChampion = false, leagueFinished = false, leagueChampion = false;
    if (result.mode === 'tournament' && this.tournament) {
      const cup = this.tournament;
      cupFinal = cup.round >= cup.totalRounds;
      if (cup.bracket) {
        playBracketRound(cup.bracket, cup.round - 1, this.settings.teamId, result.playerScore, result.botScore, Math.random, this.game?.goalTarget || 3);
        if (!won) simulateRemainingBracket(cup.bracket, cup.round, Math.random, this.game?.goalTarget || 3);
      }
      if (!won) { cup.status = 'eliminated'; this.result_eyebrow.textContent = 'TORNEO TERMINADO'; this.result_title.textContent = 'Fin del camino'; this.result_copy.textContent = `El torneo acaba en ${roundName(cup.size, cup.round).toLowerCase()}. ${rewardText}${levelText}`; }
      else if (cup.round >= cup.totalRounds) {
        cup.status = 'champion';
        cupChampion = true;
        const competition = CUP_COMPETITIONS.find(item => item.id === cup.competitionId) || CUP_COMPETITIONS[0];
        this.unlockTrophy(cup.competitionId, competition.name);
        this.result_eyebrow.textContent = 'CAMPEONES'; this.result_title.textContent = '¡Ganaste la copa!'; this.result_copy.textContent = `Victorias: ${cup.totalRounds}. ${rewardText}${levelText}`;
      }
      else { cup.status = 'next'; this.result_eyebrow.textContent = `RONDA ${cup.round}/${cup.totalRounds} SUPERADA`; this.result_next.innerHTML = `<span>Jugar ${roundName(cup.size, cup.round + 1).toLowerCase()} →</span><kbd class="next-key">ESPACIO</kbd>`; this.result_next.classList.remove('hidden'); this.result_finish.textContent = 'Abandonar torneo'; }
    }

    if (result.mode === 'league' && this.league) {
      const season = this.league;
      this.ensureLeagueState(season);
      const playerTeamId = season.playerTeamId || this.settings.teamId;
      const fixtures = season.schedule[season.jornada - 1] || [];
      const previousRanks = season.jornada > 1 ? new Map(sortLeagueStandings(season.standings, playerTeamId).map((row, index) => [row.teamId, index + 1])) : null;
      season.standings = updateLeagueStandings(season.standings, fixtures, playerTeamId, result.playerScore, result.botScore);
      const playedFixture = fixtures.find(item => item.homeId === playerTeamId || item.awayId === playerTeamId);
      const opponentId = playedFixture?.homeId === playerTeamId ? playedFixture.awayId : playedFixture?.homeId;
      season.matchResults ||= [];
      season.matchResults.push({ round: season.jornada, opponentId, goalsFor: result.playerScore, goalsAgainst: result.botScore,
        durationSeconds: Math.max(0, Number(result.elapsedSeconds) || 0), shotsFor: result.stats?.shotsPlayer || 0,
        shotsAgainst: result.stats?.shotsOpponent || 0, goals: (result.stats?.goals || []).map(goal => ({ minute: goal.minute, side: goal.side })) });
      const playerRow = season.standings.find(row => row.teamId === playerTeamId);
      season.wins = playerRow?.wins || 0; season.losses = playerRow?.losses || 0; season.points = playerRow?.points || 0;
      const totalRounds = season.schedule.length;
      if (season.jornada >= totalRounds) {
        leagueFinished = true;
        season.status = 'complete'; this.result_eyebrow.textContent = 'TEMPORADA COMPLETADA'; this.result_title.textContent = 'Fin de la liga';
        this.career.recordLeagueSeason();
        leagueChampion = sortLeagueStandings(season.standings, playerTeamId)[0]?.teamId === playerTeamId;
        if (leagueChampion) {
          this.result_eyebrow.textContent = 'CAMPEONES · TEMPORADA COMPLETADA';
          this.result_title.textContent = '¡Liga conquistada!';
          const competition = TEAM_LEAGUES.find(item => item.id === season.competitionId) || TEAM_LEAGUES[0];
          this.unlockTrophy(`league-${season.competitionId}`, `Campeón · ${competition.label.split(' · ')[0]}`);
        }
        this.result_copy.textContent = `${totalRounds} jornadas · ${season.points} puntos · ${season.wins}V ${season.losses}D. ${rewardText}${levelText}`;
      } else {
        season.status = 'next'; this.result_eyebrow.textContent = `JORNADA ${season.jornada}/${totalRounds}`; this.result_next.innerHTML = `<span>Jugar jornada ${season.jornada + 1} →</span><kbd class="next-key">ESPACIO</kbd>`; this.result_next.classList.remove('hidden'); this.result_finish.textContent = 'Abandonar liga';
        this.result_copy.textContent = `${season.points} puntos · ${season.wins} victorias · ${season.losses} derrotas. ${rewardText}${levelText}`;
      }
      this.renderLeagueStandings(season, previousRanks);
    }
    let careerChampion = false, careerCompetition = '';
    if (result.mode === 'career') {
      const state = loadCareer(), current = nextCareerMatch(state);
      const event = current ? recordCareerMatch(state, result.playerScore, result.botScore) : null;
      if (event) {
        saveCareer(state); this.careerScreen.reload(); this.trackCareer(state);
        const stage = event.stage, label = current.match.label;
        careerChampion = !!event.trophy; careerCompetition = stage.kind === 'league' ? 'league' : stage.competitionId;
        this.result_eyebrow.textContent = `MODO CARRERA · T${state.season} · ${stage.name.toUpperCase()} · ${label.toUpperCase()}`;
        if (event.trophy) { this.result_title.textContent = `¡Campeón de ${COMPETITION_NAMES[stage.competitionId] || stage.name}!`; this.result_copy.textContent = `+${event.trophy.points} puntos para tu vitrina.${event.clubWorldCup ? ' Te has clasificado para el Mundial de Clubes.' : ''} ${rewardText}${levelText}`; }
        else if (event.eliminated) { this.result_title.textContent = label === 'Final' ? 'Final perdida' : 'Eliminados'; this.result_copy.textContent = `${stage.name}: ${label === 'Final' ? 'subcampeones' : 'fuera en semifinales'}. ${rewardText}${levelText}`; }
        else if (stage.kind === 'league' && event.stageDone) {
          const outcome = leagueResultText(state);
          this.result_title.textContent = outcome.title; this.result_copy.textContent = `${outcome.copy} ${rewardText}${levelText}`;
          careerChampion = state.history.at(-1)?.outcome === 'champion' && state.plan?.season === state.season;
        }
        else if (stage.kind === 'league') this.result_copy.textContent = `${won ? 'Primer paso hacia el título.' : 'Queda un partido clave para salvar la temporada.'} ${rewardText}${levelText}`;
        const more = state.phase === 'season' && nextCareerMatch(state);
        this.result_next.innerHTML = more ? `<span>Siguiente: ${nextCareerMatch(state).stage.name} · ${nextCareerMatch(state).match.label} →</span><kbd class="next-key">ESPACIO</kbd>` : `<span>${state.phase === 'summary' ? 'Ver resumen de la temporada' : 'Volver a la carrera'} →</span><kbd class="next-key">ESPACIO</kbd>`;
        this.result_next.classList.remove('hidden'); this.result_finish.textContent = 'Menú de carrera';
      }
    }
    this.tournament_bracket_panel.classList.add('hidden');
    if (result.mode === 'tournament' && this.tournament?.bracket) this.renderBracketPanel(this.tournament);
    const team = getTeamById(this.settings.teamId);
    const newMissions = result.mode === 'training' ? Object.assign([], { added: [] }) : this.career.processMissionEvent({
      mode: result.mode, won, goalsFor: result.playerScore, goalsAgainst: result.botScore,
      difficulty: result.mode === 'online' ? '' : this.game?.botAI?.difficulty, duo: !!(this.currentMatchOptions?.duo || this.currentMatchOptions?.squad),
      competitionMode: result.mode === 'tournament' || result.mode === 'league' || result.mode === 'career',
      competitionId: result.mode === 'tournament' ? this.tournament?.competitionId : (result.mode === 'league' ? this.league?.competitionId : result.mode === 'career' ? careerCompetition : ''),
      isFinal: cupFinal, isChampion: cupChampion || (careerChampion && careerCompetition !== 'league'), isLeagueChampion: leagueChampion || (careerChampion && careerCompetition === 'league'),
    }, this.progression.level);
    this.trackProgress(result, won);
    const missionXp = newMissions.reduce((sum, mission) => sum + mission.xp, 0);
    if (missionXp) {
      const missionReward = this.progression.awardXP(missionXp);
      this.renderProgress();
      const totalGained = (reward?.gained || 0) + missionXp;
      this.result_xp.textContent = totalGained ? `+${totalGained} XP` : 'NIVEL MÁXIMO';
      this.result_level.textContent = `NIVEL ${this.progression.level}`;
      this.result_xp_fill.style.width = `${this.progression.progressRatio() * 100}%`;
      this.result_copy.textContent += ` Misión completada: ${newMissions.map(mission => `${mission.title} (${mission.tierLabel})`).join(', ')} (+${missionXp} XP). Nueva misión: ${newMissions.added.map(mission => mission.title).join(', ')}.`;
      if (missionReward.leveledUp) this.result_copy.textContent += ` ¡Has subido al nivel ${this.progression.level}!`;
    }
    if (cupFinal || leagueFinished) this.showCompetitionResultStats(result, cupChampion || leagueChampion, leagueFinished ? this.league : null, leagueChampion);
    else this.result_stats.classList.add('hidden');
    if (result.mode === 'online' && this.hub?.lobby) this.hub.record(result);
    if (result.mode === 'online' && !this.hub?.lobby) {
      this.result_rematch.classList.remove('hidden');
      this.result_rematch.disabled = false; this.result_rematch.innerHTML = 'Pedir revancha <span>↻</span>';
      this.result_finish.textContent = 'Salir de la sala';
      this.result_online_status.classList.remove('hidden');
      if (!this.user) {
        this.result_online_status.textContent = 'Inicia sesión para guardar tu resultado en la clasificación amistosa.';
      } else {
        this.result_online_status.textContent = 'Guardando resultado…';
        this.accountService.recordOnlineResult({
          matchId: this.onlineMatch?.matchId,
          playerName: this.settings.name,
          opponentName: this.onlineMatch?.opponent?.name || 'RIVAL',
          playerScore: result.playerScore,
          opponentScore: result.botScore,
        }).then(saved => {
          this.result_online_status.textContent = saved ? 'Resultado guardado en la clasificación amistosa.' : 'Ya habías guardado este partido.';
        }).catch(error => { this.result_online_status.textContent = error?.message || 'No se pudo guardar el resultado.'; });
      }
    }
    this.sound?.setScene?.('menu'); this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.remove('hidden'); this.resultShownAt = performance.now();
    this.renderAccount();
    if ((this.league?.status === 'next') || (this.tournament?.status === 'next')) this.saveCurrentCompetition();
    else if (result.mode === 'league' || result.mode === 'tournament') { clearCompetitionSave(); this.refreshContinueButton(null); }
    this.syncAccount(true);
  }

  // Final scoreboard: both teams (kit crest, team, player), the score and the
  // minute of every goal, plus a timeline of the match.
  renderScoreboard(result, won) {
    const options = this.currentMatchOptions || {}, online = result.mode === 'online';
    const stats = result.stats || { goals: [] }, total = Math.max(1, Number(result.elapsedSeconds) || 0);
    const homeTeam = options.playerTeam || getTeamById(this.settings.teamId), awayTeam = options.opponentTeam || null;
    const player = this.game?.player, rival = this.game?.bot;
    const sides = {
      home: { team: homeTeam, body: player, title: homeTeam?.name || 'Tu equipo', subtitle: options.squad ? `@${options.playerUsername}` : `${online && this.hub?.identity ? '@' + this.hub.identity.username : this.settings.name} · #${player?.number ?? this.settings.number}`, goals: 'player' },
      away: { team: awayTeam, body: rival, title: awayTeam?.name || options.opponentName || 'Rival', subtitle: options.squad ? `@${options.opponentUsername}` : `${online ? '@' + (options.opponentUsername || options.opponentName || 'rival') : 'IA · ' + difficultyLabel(this.game?.botAI?.difficulty).toUpperCase()} · #${rival?.number ?? 10}`, goals: 'opponent' },
    };
    for (const [key, side] of Object.entries(sides)) {
      this.paintPlayerPreview(this[`result_${key}_crest`], side.team, { name: side.body?.name || '', number: side.body?.number ?? '' });
      this[`result_${key}_team`].textContent = side.title; this[`result_${key}_player`].textContent = side.subtitle;
      const ranked = online && options.rankedNames?.[key === 'home' ? 'player' : 'opponent'];
      if (ranked) this.setRankedNames(this[`result_${key}_player`], ranked);
      const list = this[`result_${key}_goals`], goals = (stats.goals || []).filter(goal => goal.side === side.goals);
      list.replaceChildren(...goals.map(goal => { const item = document.createElement('li'); item.textContent = `${goal.minute}'`; return item; }));
      if (!goals.length) { const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = 'Sin goles'; list.append(empty); }
    }
    this.result_scoreboard.classList.toggle('won', won); this.result_scoreboard.classList.toggle('lost', !won);
    this.result_scoreboard.querySelector('.score-side.home').classList.toggle('winner', won); this.result_scoreboard.querySelector('.score-side.away').classList.toggle('winner', !won);
    this.result_score.innerHTML = `${result.playerScore}<i>–</i>${result.botScore}`;
    this.result_score.setAttribute('aria-label', `${sides.home.title} ${result.playerScore}, ${sides.away.title} ${result.botScore}`);
    this.result_duration.textContent = `${formatMatchDuration(result.elapsedSeconds)} · TIROS ${stats.shotsPlayer || 0}–${stats.shotsOpponent || 0}`;
    const track = this.result_timeline.querySelector('.goal-timeline-track');
    track.replaceChildren(...(stats.goals || []).map(goal => {
      const marker = document.createElement('i'); marker.className = `goal-marker ${goal.side === 'player' ? 'home' : 'away'}`;
      marker.style.left = `${Math.max(2, Math.min(98, (Number(goal.elapsedSeconds) || 0) / total * 100))}%`;
      marker.style.setProperty('--marker-color', (goal.side === 'player' ? homeTeam?.primary : awayTeam?.primary) || (goal.side === 'player' ? '#65e6a5' : '#f19676'));
      marker.title = `${goal.minute}'`; return marker;
    }));
  }

  matchEyebrow(mode) {
    const label = { bot: 'PARTIDO RÁPIDO', online: (this.hub?.lobby?.kind === 'ranked' ? 'ONLINE · RANKED' : this.hub?.lobby?.kind === 'tournament' ? 'ONLINE · TORNEO' : 'ONLINE · PARTIDO RÁPIDO') + (this.currentMatchOptions?.squad ? ' · 2V2' : ''), legends: 'LEYENDAS' }[mode];
    return label ? `${label} · FINAL` : 'FINAL DEL PARTIDO';
  }

  showCompetitionResultStats(result, champion, season = null, leagueChampion = false) {
    const stats = result.stats || { shotsPlayer: 0, shotsOpponent: 0, goals: [] };
    const minutes = (stats.goals || []).map(goal => `${goal.minute}' ${goal.side === 'player' ? 'TÚ' : 'RIVAL'}`).join(' · ') || 'Sin goles';
    this.result_stat_duration.textContent = formatMatchDuration(result.elapsedSeconds);
    this.result_stat_goals.textContent = minutes;
    this.result_stat_shots.textContent = `${stats.shotsPlayer || 0} · ${stats.shotsOpponent || 0}`;
    this.result_trophy.classList.toggle('trophy-won', !!champion);
    this.result_season_summary.replaceChildren();
    this.result_season_summary.classList.toggle('hidden', !season);
    if (season) {
      const results = season.matchResults || [];
      const team = getTeamById(season.playerTeamId);
      const longest = [...results].sort((a, b) => b.durationSeconds - a.durationSeconds)[0];
      const longestOpponent = getTeamById(longest?.opponentId);
      const totalShots = results.reduce((sum, match) => sum + match.shotsFor, 0);
      const totalShotsAgainst = results.reduce((sum, match) => sum + match.shotsAgainst, 0);
      const totalGoals = results.reduce((sum, match) => sum + match.goalsFor, 0);
      const goalsAgainst = results.reduce((sum, match) => sum + match.goalsAgainst, 0);
      const draws = season.standings.find(row => row.teamId === season.playerTeamId)?.draws || 0;
      const position = sortLeagueStandings(season.standings, season.playerTeamId).findIndex(row => row.teamId === season.playerTeamId) + 1;
      const title = document.createElement('h3'); title.textContent = leagueChampion ? `¡CAMPEÓN · ${team?.name || 'TU EQUIPO'}!` : 'RESUMEN DE TEMPORADA';
      const grid = document.createElement('div'); grid.className = 'season-summary-grid';
      const values = [
        ['POSICIÓN FINAL', `${position} / ${season.standings.length}`], ['PARTIDOS', `${results.length} · ${season.wins}V ${draws}E ${season.losses}D`],
        ['PUNTOS', String(season.points)], ['GOLES · A FAVOR / EN CONTRA', `${totalGoals} / ${goalsAgainst}`], ['TIROS · A FAVOR / EN CONTRA', `${totalShots} / ${totalShotsAgainst}`],
        ['PARTIDO MÁS LARGO', longest ? `${formatMatchDuration(longest.durationSeconds)} · vs ${longestOpponent?.name || 'rival'} (${longest.goalsFor}-${longest.goalsAgainst})` : '—'],
        ['TIEMPO TOTAL · MEDIA', `${formatMatchDuration(results.reduce((sum, match) => sum + match.durationSeconds, 0))} · ${formatMatchDuration(results.length ? results.reduce((sum, match) => sum + match.durationSeconds, 0) / results.length : 0)}`],
        ['MINUTOS DE GOL', results.flatMap(match => (match.goals || []).map(goal => `J${match.round} · ${goal.minute}'`)).join(' · ') || 'Sin goles'],
      ];
      for (const [label, value] of values) {
        const item = document.createElement('div'); const caption = document.createElement('span'); caption.textContent = label;
        const detail = document.createElement('b'); detail.textContent = value; item.append(caption, detail); grid.append(item);
      }
      const historyTitle = document.createElement('h4'); historyTitle.textContent = 'TODOS LOS PARTIDOS · MÁS LARGOS PRIMERO';
      const history = document.createElement('div'); history.className = 'season-match-history';
      for (const match of [...results].sort((a, b) => b.durationSeconds - a.durationSeconds)) {
        const row = document.createElement('div'); row.className = 'season-match-row';
        const opponent = getTeamById(match.opponentId);
        const fixture = document.createElement('b'); fixture.textContent = `J${match.round} · ${team?.name || 'Tú'} ${match.goalsFor}–${match.goalsAgainst} ${opponent?.name || 'rival'}`;
        const detail = document.createElement('span');
        const minutes = (match.goals || []).map(goal => `${goal.minute}'`).join(' · ') || 'sin goles';
        detail.textContent = `${formatMatchDuration(match.durationSeconds)} · ${match.shotsFor} tiros · ${minutes}`;
        row.append(fixture, detail); history.append(row);
      }
      this.result_season_summary.append(title, grid, historyTitle, history);
    }
    this.result_stats.classList.remove('hidden');
  }

  // League table between matchdays: club colours, position change since the
  // previous jornada, recent form, leader marker, the player's row and the
  // next rival. `previousRanks` maps teamId → position before this jornada.
  renderLeagueStandings(season, previousRanks = null) {
    const competition = TEAM_LEAGUES.find(item => item.id === season.competitionId);
    const total = season.schedule?.length || season.opponents?.length || 0;
    this.league_standings_title.textContent = `${competition?.label.split(' · ')[0] || 'LIGA'} · CLASIFICACIÓN · JORNADA ${season.jornada}${total ? '/' + total : ''}`;
    const rows = sortLeagueStandings(season.standings, season.playerTeamId);
    const nextRival = season.status === 'next' ? season.opponents?.[season.jornada]?.id : null;
    const cell = (text, className = '') => { const td = document.createElement('td'); td.textContent = text; if (className) td.className = className; return td; };
    this.league_standings_body.replaceChildren(...rows.map((entry, index) => {
      const team = getTeamById(entry.teamId), row = document.createElement('tr'), position = index + 1;
      row.classList.toggle('your-league-team', entry.teamId === season.playerTeamId);
      row.classList.toggle('league-leader', position === 1);
      if (entry.teamId === season.playerTeamId) row.setAttribute('aria-current', 'true');
      const pos = cell(String(position), 'col-pos');
      const before = previousRanks?.get(entry.teamId);
      if (before && before !== position) { const arrow = document.createElement('i'); arrow.className = before > position ? 'rank-up' : 'rank-down'; arrow.textContent = before > position ? '▲' : '▼'; arrow.title = `${before > position ? 'Sube' : 'Baja'} ${Math.abs(before - position)}`; pos.append(arrow); }
      const name = document.createElement('th'); name.scope = 'row'; name.className = 'col-team';
      const chip = document.createElement('span'); chip.className = 'league-team-chip'; chip.style.background = getKitBackground(team);
      const label = document.createElement('span'); label.className = 'league-team-name'; label.textContent = team?.name || entry.teamId;
      name.append(chip, label);
      if (entry.teamId === season.playerTeamId) { const tag = document.createElement('b'); tag.className = 'league-tag mine'; tag.textContent = 'TÚ'; name.append(tag); }
      else if (entry.teamId === nextRival) { const tag = document.createElement('b'); tag.className = 'league-tag next'; tag.textContent = 'PRÓX.'; name.append(tag); }
      const form = cell('', 'col-form');
      for (const result of entry.form || []) { const dot = document.createElement('i'); dot.className = `form-dot form-${result}`; dot.title = ({ W: 'Victoria', D: 'Empate', L: 'Derrota' })[result]; form.append(dot); }
      row.append(pos, name, cell(String(entry.played)), cell(String(entry.wins), 'col-wdl'), cell(String(entry.draws), 'col-wdl'), cell(String(entry.losses), 'col-wdl'),
        cell(`${entry.goalDifference > 0 ? '+' : ''}${entry.goalDifference}`), cell(String(entry.points), 'col-pts'), form);
      return row;
    }));
    this.league_standings_panel.classList.remove('hidden');
    requestAnimationFrame(() => {
      const wrap = this.league_standings_body.closest('.league-table-wrap'), mine = this.league_standings_body.querySelector('.your-league-team');
      if (wrap && mine) wrap.scrollTop = Math.max(0, mine.offsetTop - wrap.clientHeight / 2);
    });
  }

  // ---- Rival difficulty -----------------------------------------------------------
  // Automatic: the rival's stars set the AI (1★ Principiante … 5★ Champions), with no level limit.
  // "Dificultad personalizada": the chosen difficulty for every rival.
  rivalDifficulty(team, chosen) {
    if (this.settings.customDifficulty) return chosen || this.settings.difficulty;
    return difficultyForStars(team?.stars);
  }
  // Gameplay: "arcade" (default) or "classic" (close control, smaller ball). Online always plays arcade.
  setGameplay(value) { this.settings.gameplay = value === 'classic' ? 'classic' : 'arcade'; this.persist(); this.renderGameplay(); }
  renderGameplay() {
    const value = this.settings.gameplay === 'classic' ? 'classic' : 'arcade';
    document.querySelectorAll('[data-gameplay]').forEach(button => { const on = button.dataset.gameplay === value; button.classList.toggle('active', on); button.setAttribute('aria-checked', String(on)); });
  }
  setCustomDifficulty(on) { this.settings.customDifficulty = !!on; this.persist(); this.renderDifficultyMode(); }
  // Toggle + note next to every difficulty selector (home, Jugar, quick match and settings).
  renderDifficultyMode() {
    const custom = !!this.settings.customDifficulty;
    document.body.classList.toggle('auto-difficulty', !custom);
    for (const select of [this.difficulty, this.play_difficulty, this.settings_difficulty, this.quick_difficulty]) {
      if (!select) continue;
      let box = select.parentElement.querySelector(':scope > .difficulty-mode');
      if (!box) {
        box = document.createElement('span'); box.className = 'difficulty-mode';
        box.innerHTML = '<button type="button" class="difficulty-toggle" role="switch"><i></i><span>Dificultad personalizada</span></button><small class="auto-difficulty-note"></small>';
        box.querySelector('button').addEventListener('click', () => { this.sound?.play('click'); this.setCustomDifficulty(!this.settings.customDifficulty); });
        select.before(box); select.classList.add('difficulty-select');
      }
      const button = box.querySelector('button'); button.classList.toggle('on', custom); button.setAttribute('aria-checked', String(custom));
      const rival = select === this.quick_difficulty ? getTeamById(this.quickChoices?.rival) : null;
      box.querySelector('small').textContent = rival
        ? `${rival.name} ${'★'.repeat(Math.max(1, Math.min(5, rival.stars || 3)))} → IA ${difficultyLabel(difficultyForStars(rival.stars))}`
        : 'Según las estrellas del rival: 1★ Principiante … 5★ Champions';
    }
  }

  // ---- Progress (Progreso) ---------------------------------------------------
  progressData() { return computeProgress({ trophyIds: this.career.trophies.map(item => item.id), level: this.progression.level }); }
  goldUnlocked() { return this.progressData().complete; }
  unlockProgress(category, id, label) {
    const before = this.goldUnlocked();
    const added = this.unlockTrophy(progressId(category, id), `Progreso · ${label}`);
    if (added && !before && this.goldUnlocked()) {
      this.confetti.play(); this.trophy_toast_name.textContent = '¡100 %! Nombre dorado desbloqueado';
      this.settings.goldKit = true; this.persist(); this.applyGoldName();
    }
    if (added) this.progressScreen?.renderHome();
    return added;
  }
  // Milestones that can be read from saved data (career record, online rank).
  backfillProgress() {
    const best = loadCareerBest();
    if (best) {
      this.unlockProgress('career', 'finish', CAREER_MILESTONES[0].label);
      if (best.score >= 300) this.unlockProgress('career', 'pro', CAREER_MILESTONES[1].label);
      if (best.score >= 800) this.unlockProgress('career', 'star', CAREER_MILESTONES[2].label);
      if (best.score >= 1500) this.unlockProgress('career', 'legend', CAREER_MILESTONES[3].label);
    }
    this.trackOnlineRank(this.hub?.identity);
  }
  trackOnlineRank(identity) {
    if (!identity) return;
    const reached = rankIndex(identity.elo);
    RANKS.forEach((rank, index) => { if (index <= reached) this.unlockProgress('rank', rank.id, `Rango ${rank.name}`); });
  }
  trackProgress(result, won) {
    if (!won) return;
    const difficulty = this.game?.botAI?.difficulty;
    if (!['online', 'training', 'legends'].includes(result.mode) && DIFFICULTIES.some(item => item.id === difficulty)) this.unlockProgress('difficulty', difficulty, `Victoria en ${difficultyLabel(difficulty)}`);
    if (result.mode === 'legends' && this.currentMatchOptions?.legendId) {
      const legend = LEGEND_MATCHES.find(item => item.id === this.currentMatchOptions.legendId);
      if (legend) this.unlockProgress('legend', legend.id, legend.name);
    }
  }
  // Career milestones, called by the career screen.
  trackCareer(state, finished = false) {
    if (!state) return;
    const startTier = TEAM_LEAGUES.find(item => item.id === getTeamById(state.startClubId)?.league)?.tier ?? 1;
    const tierNow = TEAM_LEAGUES.find(item => item.id === careerLeagueOf(state, state.clubId))?.tier ?? 1;
    if (startTier >= 4 && (tierNow === 1 || state.history.some(item => item.tier === 1))) this.unlockProgress('career', 'climb', CAREER_MILESTONES[5].label);
    if (state.trophies.some(item => item.kind === 'world-cup')) this.unlockProgress('career', 'world-cup', CAREER_MILESTONES[4].label);
    if (finished) {
      const score = state.finalScore ?? 0;
      this.unlockProgress('career', 'finish', CAREER_MILESTONES[0].label);
      if (score >= 300) this.unlockProgress('career', 'pro', CAREER_MILESTONES[1].label);
      if (score >= 800) this.unlockProgress('career', 'star', CAREER_MILESTONES[2].label);
      if (score >= 1500) this.unlockProgress('career', 'legend', CAREER_MILESTONES[3].label);
    }
  }
  // Golden animated name on the profile and the online identity once the game is complete.
  applyGoldName() {
    const gold = this.goldUnlocked();
    for (const id of ['career-name', 'online-identity']) document.getElementById(id)?.classList.toggle('gold-name', gold);
  }

  // Career mode: plays the next key match of the saved career with the club or national team.
  startCareerMatch() {
    const state = loadCareer(), next = nextCareerMatch(state); if (!next) { this.careerScreen.returnFromMatch(); return; }
    const playerTeam = getTeamById(next.stage.teamId), opponentTeam = getTeamById(next.match.opponentId);
    const fieldTheme = next.stage.kind === 'league' ? `league-${next.stage.competitionId}` : next.stage.competitionId;
    const difficulty = this.settings.difficulty;
    this.start('career', { playerTeamId: playerTeam.id, playerTeam, opponentTeam, opponentName: opponentTeam.name, difficulty, fieldTheme,
      goalTarget: CAREER_GOAL_TARGET, competitionRound: next.match.label === 'Final' ? 4 : 3, duo: state.format === '2v2', mateDifficulty: this.mateDifficulty(),
      label: `MODO CARRERA · T${state.season}/${CAREER_SEASONS} · ${next.stage.name.toUpperCase()} · ${next.match.label.toUpperCase()} · A ${CAREER_GOAL_TARGET}` });
  }

  advanceCompetition() {
    this.sound?.play('click');
    if (this.currentMatchMode === 'career') {
      const state = loadCareer();
      if (state?.phase === 'season' && nextCareerMatch(state)) { this.startCareerMatch(); return; }
      this.leaveCareerMatch(); return;
    }
    if (this.tournament?.status === 'next') { this.tournament.status = 'playing'; this.launchTournamentRound(); return; }
    if (this.league?.status === 'next') { this.league.status = 'playing'; this.league.jornada++; this.launchLeagueRound(); }
  }

  pause(paused) {
    if (!this.game?.state.running || this.currentMatchMode === 'online' || !this.result_overlay.classList.contains('hidden')) return;
    this.sound?.setScene?.(paused ? 'menu' : 'game'); this.game.setPaused(paused); this.pause_overlay.classList.toggle('hidden', !paused);
    if (paused) this.saveCurrentCompetition();
    document.getElementById('pause-button').textContent = paused ? '▶' : 'Ⅱ';
  }

  leaveCareerMatch() {
    this.game?.stop(); this.currentMatchMode = null; this.currentMatchOptions = null;
    this.goal_banner.classList.add('hidden'); this.countdown_banner.classList.add('hidden'); this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden');
    this.careerScreen.returnFromMatch();
  }

  finishToMenu() {
    if (this.currentMatchMode === 'career') { this.leaveCareerMatch(); return; }
    if (this.currentMatchMode === 'online' && this.hub?.lobby) { this.hub.returnToLobby(); return; }
    if (this.league?.status === 'next' || this.tournament?.status === 'next') this.saveAndQuit(); else this.quit();
  }

  quit() {
    if (this.currentMatchMode === 'online' && this.hub?.lobby) { this.hub.action('leave'); return; }
    if (this.currentMatchMode === 'online') this.onlineMatch?.leave();
    if (this.league || this.tournament) { clearCompetitionSave(); this.refreshContinueButton(null); }
    this.game.stop(); this.tournament = null; this.league = null;
    this.currentMatchMode = null; this.currentMatchOptions = null;
    this.show('home'); this.goal_banner.classList.add('hidden'); this.countdown_banner.classList.add('hidden'); this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden'); this.refreshContinueButton();
  }
}

function readGuestProfile() {
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; } };
  const competitionSave = read('field-competition-save', null);
  const progression = read('field-progression', {}), career = read('field-career-profile', {});
  if (!career.stats?.wins && Number(progression.wins) > 0) career.stats = { ...(career.stats || {}), wins: Number(progression.wins), matches: Number(progression.wins) };
  return {
    settings: read('field-settings', {}),
    progression,
    career,
    competitionSave: competitionSave?.version === 1 ? competitionSave : null,
  };
}

function leagueTierLabel(id) {
  return `${TEAM_LEAGUES.find(league => league.id === id)?.tier || 1}ª CATEGORÍA`;
}

function formatMatchDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
