import { loadSettings, saveSettings, setSettingsScope } from '../config/settings.js';
import { Progression } from '../game/Progression.js';
import { CareerProfile } from '../game/CareerProfile.js';
import { TEAM_LEAGUES, NATIONAL_GROUPS, TEAM_GROUPS, PROFILE_TEAMS, TEAMS, getTeamById } from '../config/teams.js';
import { CUP_COMPETITIONS, createChampionsDraw, createInternationalDraw, createLeagueOpponents, pickChampionsOpponent } from '../game/Competitions.js';
import { MenuBackdrop } from './MenuBackdrop.js';
import { clearCompetitionSave, loadCompetitionSave, setCompetitionSaveScope, storeCompetitionSave } from '../game/CompetitionSave.js';

const ROUND_NAMES = ['OCTAVOS DE FINAL', 'CUARTOS DE FINAL', 'SEMIFINAL', 'FINAL'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class UI {
  constructor(initialUser = null) {
    this.pendingGuestMigration = initialUser ? readGuestProfile() : null;
    this.user = initialUser; this.accountService = null; this.accountMode = 'login'; this.accountSyncTimer = 0; this.lastAccountSync = 0; this.accountSyncBusy = false;
    const storageScope = initialUser?.id || 'guest'; setSettingsScope(storageScope); setCompetitionSaveScope(storageScope);
    this.settings = loadSettings(); this.progression = new Progression(storageScope); this.career = new CareerProfile(storageScope); this.game = null; this.sound = null;
    if (this.career.stats.matches === 0 && this.career.stats.wins === 0 && this.progression.wins > 0) this.career.ensureProgressionWins(this.progression.wins);
    this.tournament = null; this.league = null; this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.selectedCompetition = 'champions'; this.competitionIndex = 0; this.selectedTeamId = ''; this.teamCursor = new Map();
    this.currentMatchMode = null; this.currentMatchOptions = null;
    this.activeLeague = TEAM_LEAGUES[0].id;
    this.screens = {
      home: document.querySelector('#home-screen'), customize: document.querySelector('#customize-screen'),
      settings: document.querySelector('#settings-screen'), account: document.querySelector('#account-screen'), competitions: document.querySelector('#competition-screen'), tournament: document.querySelector('#tournament-screen'),
      league: document.querySelector('#league-screen'), game: document.querySelector('#game-screen'),
    };
    this.cacheElements(); this.menuBackdrop = new MenuBackdrop(this.menu_backdrop); this.populateTeamPicker(); this.populateLeagueCompetitions(); this.fillInputs(); this.bind(); this.updateLeaguePreview(); this.renderProgress(); this.show('home'); this.refreshContinueButton();
  }

  cacheElements() {
    const ids = [
      'player-name','player-number','preview-name','preview-number','preview-ball','preview-team','saved-note','save-player',
      'difficulty','settings-difficulty','sound-enabled','volume','volume-value','score','timer','hud-player-name','hud-opponent-name','player-dot','opponent-dot',
      'goal-banner','countdown-banner','pause-overlay','result-overlay','result-eyebrow','result-title','result-copy','result-xp','result-level','result-xp-fill',
      'result-next','result-finish','training-tools','trajectory-toggle','mode-label','game-canvas','level-value','xp-label','wins-label','xp-fill',
      'team-position','league-competition','league-competition-summary','league-tabs','team-grid','teams-prev','teams-next','chosen-team-label','tournament-roster',
      'competition-trophy','competition-eyebrow','competition-title','competition-description','competition-dots','competition-select','competition-prev','competition-next',
      'competition-picker-card',
      'tournament-header-tag','tournament-eyebrow','tournament-title','tournament-description','tournament-emblem','tournament-team-count',
      'account-status','account-status-dot','account-message','account-form','account-name','account-name-wrap','account-email','account-password','account-submit','account-form-title','account-dashboard','account-auth-panel','account-email-label','account-sync-state','account-level','account-wins','account-matches','account-goals','account-conceded','account-seasons','account-trophy-count','account-trophies',
      'profile-eyebrow','profile-title','profile-copy','home-club-colors','home-club-name',
      'menu-backdrop',
      'continue-competition','continue-detail','league-goal-target','trajectory-enabled','shot-power-time',
    ];
    for (const id of ids) this[id.replaceAll('-', '_')] = document.getElementById(id);
  }

  attach(game, sound, accountService = null) {
    this.game = game; this.sound = sound; this.accountService = accountService;
    if (this.user && accountService) this.activateAccount(this.user).catch(error => this.setAccountMessage(error.message, true));
    else this.renderAccount();
  }

  populateTeamPicker() {
    for (const league of TEAM_GROUPS) {
      const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'league-tab';
      tab.dataset.league = league.id; tab.textContent = league.label.split(' · ')[0];
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false'); this.league_tabs.append(tab);
    }
    this.renderTeamCarousel();
    this.renderCompetitionPicker();
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
    if (this.selectedTeamId) {
      const index = PROFILE_TEAMS.filter(team => team.league === this.activeLeague).findIndex(team => team.id === this.selectedTeamId);
      if (index >= 0) this.teamCursor.set(this.activeLeague, index);
    }
    this.player_name.value = this.settings.profileReady ? this.settings.name : '';
    this.player_number.value = this.settings.profileReady ? this.settings.number : '';
    this.difficulty.value = this.settings.difficulty; this.settings_difficulty.value = this.settings.difficulty;
    this.sound_enabled.checked = this.settings.sound; this.volume.value = this.settings.volume; this.volume_value.textContent = `${this.settings.volume}%`;
    this.trajectory_enabled.checked = !!this.settings.trajectory;
    this.league_goal_target.value = String([2, 3, 5].includes(Number(this.settings.leagueGoalTarget)) ? this.settings.leagueGoalTarget : 2);
    this.renderTeamCarousel(); this.updateProfilePreview(); this.updateHomeClub(); this.updateProfileValidity();
  }

  bind() {
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      this.sound?.play('click');
      this.selectMode(button.dataset.action);
    }));
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      this.sound?.play('click');
      if (button.dataset.view === 'customize') { this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.openProfile(); }
      else this.show(button.dataset.view);
    }));
    document.getElementById('account-open').addEventListener('click', () => { this.renderAccount(); this.show('account'); });
    this.account_form.addEventListener('submit', event => { event.preventDefault(); this.submitAccount(); });
    document.getElementById('account-mode-toggle').addEventListener('click', () => this.toggleAccountMode());
    document.getElementById('account-sync-button').addEventListener('click', () => this.syncAccount(true));
    document.getElementById('account-logout').addEventListener('click', () => this.logOut());
    document.getElementById('profile-back').addEventListener('click', () => { this.pendingMode = null; this.pendingCompetition = null; this.pendingTeamType = 'all'; this.league_tabs.querySelectorAll('[data-league]').forEach(tab => { tab.hidden = false; }); this.show('home'); });
    this.league_tabs.addEventListener('click', event => {
      const tab = event.target.closest('[data-league]'); if (!tab) return;
      this.activeLeague = tab.dataset.league;
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
    this.player_name.addEventListener('input', () => { this.updateProfilePreview(); this.updateProfileValidity(); });
    this.player_number.addEventListener('input', () => { this.updateProfilePreview(); this.updateProfileValidity(); });
    document.getElementById('save-player').addEventListener('click', () => this.savePlayer());
    this.difficulty.addEventListener('change', () => { this.settings.difficulty = this.difficulty.value; this.settings_difficulty.value = this.difficulty.value; this.persist(); });
    this.settings_difficulty.addEventListener('change', () => { this.settings.difficulty = this.settings_difficulty.value; this.difficulty.value = this.settings.difficulty; this.persist(); });
    this.trajectory_enabled.addEventListener('change', () => {
      this.settings.trajectory = this.trajectory_enabled.checked; this.trajectory_toggle.checked = this.settings.trajectory;
      this.persist();
    });
    this.sound_enabled.addEventListener('change', () => { this.settings.sound = this.sound_enabled.checked; this.persist(); });
    this.volume.addEventListener('input', () => { this.settings.volume = Number(this.volume.value); this.volume_value.textContent = `${this.settings.volume}%`; this.persist(); });
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
    document.getElementById('pause-button').addEventListener('click', () => this.pause(true));
    document.getElementById('resume-button').addEventListener('click', () => this.pause(false));
    document.getElementById('quit-button').addEventListener('click', () => this.saveAndQuit());
    this.result_next.addEventListener('click', () => this.advanceCompetition());
    this.result_finish.addEventListener('click', () => this.quit());
    document.getElementById('reset-ball').addEventListener('click', () => this.game.resetBall());
    document.getElementById('reset-player').addEventListener('click', () => this.game.resetPlayer());
    this.trajectory_toggle.addEventListener('change', () => {
      this.settings.trajectory = this.trajectory_toggle.checked; this.trajectory_enabled.checked = this.settings.trajectory;
      this.game.trajectory = this.settings.trajectory; this.persist();
    });
    window.addEventListener('keydown', e => { if (e.code === 'Escape' && this.game?.state.running) { e.preventDefault(); this.pause(!this.game.state.paused); } });
    window.addEventListener('pagehide', () => { this.saveCurrentCompetition(); this.syncAccount(true); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { this.saveCurrentCompetition(); this.syncAccount(true); } });
  }

  toggleAccountMode() {
    this.accountMode = this.accountMode === 'login' ? 'signup' : 'login';
    const signup = this.accountMode === 'signup';
    this.account_name_wrap.classList.toggle('hidden', !signup);
    this.account_password.autocomplete = signup ? 'new-password' : 'current-password';
    this.account_form_title.textContent = signup ? 'Crear cuenta' : 'Inicia sesión';
    this.account_submit.innerHTML = signup ? 'Crear cuenta <span>↗</span>' : 'Entrar <span>↗</span>';
    document.getElementById('account-mode-toggle').textContent = signup ? 'Ya tengo cuenta · Iniciar sesión' : '¿Primera vez? Crear cuenta';
    this.setAccountMessage(signup ? 'Al crear la cuenta, Supabase puede pedirte confirmar el correo.' : 'El progreso local seguirá disponible sin cuenta.');
  }

  async submitAccount() {
    if (!this.accountService?.isConfigured) { this.setAccountMessage('Falta configurar Supabase para activar las cuentas. El progreso local sigue disponible.', true); return; }
    const email = this.account_email.value.trim(), password = this.account_password.value;
    if (!this.account_email.checkValidity() || (this.accountMode === 'signup' && !this.account_name.value.trim()) || password.length < 8) {
      this.setAccountMessage('Completa un correo válido, el nombre y una contraseña de 8 caracteres como mínimo.', true); return;
    }
    this.account_submit.disabled = true; this.setAccountMessage(this.accountMode === 'signup' ? 'Creando cuenta…' : 'Iniciando sesión…');
    try {
      const signingUp = this.accountMode === 'signup';
      const authResult = signingUp
        ? await this.accountService.signUp(email, password, this.account_name.value.trim())
        : await this.accountService.signIn(email, password);
      const currentUser = await this.accountService.currentUser();
      const user = currentUser || (!signingUp ? authResult?.user || authResult : null);
      if (!user) {
        this.setAccountMessage('Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.', false, true);
        this.accountMode = 'signup'; this.toggleAccountMode(); return;
      }
      await this.activateAccount(user);
      this.setAccountMessage('Cuenta conectada. Tu progreso ya está sincronizado.', false, true);
      this.account_email.value = ''; this.account_password.value = ''; this.show('account');
    } catch (error) {
      this.setAccountMessage(error?.message || 'No se pudo completar el acceso. Comprueba tus datos.', true);
    } finally { this.account_submit.disabled = false; }
  }

  currentCloudProfile() {
    return { settings: this.settings, progression: this.progression.toJSON(), career: this.career.toJSON(), competitionSave: loadCompetitionSave() };
  }

  async activateAccount(user) {
    if (!user?.id || !this.accountService) return;
    const priorScope = this.user?.id || 'guest';
    const guestProfile = priorScope === 'guest' ? this.currentCloudProfile() : this.pendingGuestMigration;
    this.pendingGuestMigration = null;
    if (priorScope !== user.id) {
      setSettingsScope(user.id); setCompetitionSaveScope(user.id);
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
    saveSettings(this.settings); this.game?.updateSettings(this.settings);
    this.fillInputs(); this.renderProgress(); this.renderAccount(); this.refreshContinueButton();
    await this.syncAccount(true);
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
    try { await this.accountService?.signOut(); } catch { /* Local scope still switches even if the network is unavailable. */ }
    if (this.accountSyncTimer) clearTimeout(this.accountSyncTimer);
    this.user = null; setSettingsScope('guest'); setCompetitionSaveScope('guest');
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
    this.account_email_label.textContent = this.user.email || 'Cuenta FIELD';
    this.account_level.textContent = String(this.progression.level); this.account_wins.textContent = String(stats.wins);
    this.account_matches.textContent = String(stats.matches); this.account_goals.textContent = String(stats.goalsFor + stats.trainingGoals);
    this.account_conceded.textContent = String(stats.goalsAgainst); this.account_seasons.textContent = String(stats.leagueSeasons);
    this.account_trophy_count.textContent = String(this.career.trophies.length); this.account_trophies.replaceChildren();
    if (!this.career.trophies.length) { const empty = document.createElement('span'); empty.className = 'empty-trophies'; empty.textContent = 'Tus copas aparecerán aquí al ganarlas.'; this.account_trophies.append(empty); }
    else for (const trophy of this.career.trophies) { const chip = document.createElement('span'); chip.className = 'trophy-chip'; const cup = document.createElement('i'); const title = document.createElement('span'); title.textContent = trophy.name; chip.append(cup, title); this.account_trophies.append(chip); }
  }

  setAccountMessage(message, error = false, success = false) {
    this.account_message.textContent = message; this.account_message.classList.toggle('error', error); this.account_message.classList.toggle('success', success);
  }

  recordGoal(side) {
    this.career.recordGoal(side, this.currentMatchMode === 'training'); this.renderAccount();
    this.syncAccount(false);
  }

  profileComplete() {
    const number = Number(this.settings.number);
    return this.settings.profileReady === true && !!getTeamById(this.settings.teamId)
      && !!String(this.settings.name || '').trim() && Number.isInteger(number) && number >= 0 && number <= 99;
  }

  selectMode(mode) {
    if (mode === 'competitions') { this.show('competitions'); this.renderCompetitionPicker(); return; }
    if (!this.profileComplete()) { this.pendingMode = mode; this.openProfile(); return; }
    if (mode === 'tournament') this.openTournamentSetup();
    else if (mode === 'league') { this.updateLeaguePreview(); this.show(mode); }
    else this.start(mode);
  }

  renderCompetitionPicker() {
    const trophies = {
      champions: '<svg viewBox="0 0 100 100"><path d="M31 17h38v13c0 18-8 29-19 33-11-4-19-15-19-33V17Zm-10 4h10v9c0 9 3 15 8 19-13-2-18-10-18-20v-8Zm58 0v8c0 10-5 18-18 20 5-4 8-10 8-19v-9h10ZM45 63h10v12h15v9H30v-9h15V63Z" fill="currentColor"/><path d="M39 24h22v6H39z" fill="#eaf8ee" opacity=".45"/></svg>',
      league: '<svg viewBox="0 0 100 100"><path d="M32 17h36l-3 18c-2 12-7 19-15 23-8-4-13-11-15-23l-3-18ZM23 22h11l2 13c1 7 4 12 9 16-14-1-22-8-22-19V22Zm54 0v10c0 11-8 18-22 19 5-4 8-9 9-16l2-13h11ZM45 57h10v14h14v9H31v-9h14V57Z" fill="currentColor"/><path d="m50 26 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8 2.4-5Z" fill="#10191b"/></svg>',
      'world-cup': '<svg viewBox="0 0 100 100"><path d="M50 13 61 19 64 31 58 39 66 48 61 58 56 64H44L39 58 34 48 42 39 36 31 39 19 50 13Z" fill="currentColor"/><path d="M43 19 50 25 57 19M38 31l12 7 12-7M40 45h20M43 57h14M46 64l-3 17h14l-3-17M39 82h22v6H39z" fill="none" stroke="#effaf1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/><circle cx="50" cy="36" r="17" fill="none" stroke="#effaf1" stroke-width="1.7" opacity=".55"/></svg>',
      euro: '<svg viewBox="0 0 100 100"><path d="M23 23c0-6 5-10 11-10h32c6 0 11 4 11 10v8c0 8-5 13-13 15l-9 2 8 18-13 12-13-12 8-18-9-2c-8-2-13-7-13-15v-8Z" fill="currentColor"/><path d="M34 24h32M39 32h22M44 41h12M46 68l4 11 4-11" stroke="#effaf1" stroke-width="2.5" stroke-linecap="round" opacity=".75"/></svg>',
      'copa-america': '<svg viewBox="0 0 100 100"><path d="M35 19h30l-2 10c-1 7-4 12-9 15v9c0 7 4 12 10 16l7 4v8H29v-8l7-4c6-4 10-9 10-16v-9c-5-3-8-8-9-15l-2-10Z" fill="currentColor"/><path d="M32 22h-9v9c0 12 6 18 18 20M68 22h9v9c0 12-6 18-18 20M40 29h20M43 38h14M43 54h14M41 69h18" fill="none" stroke="#effaf1" stroke-width="2.3" stroke-linecap="round" opacity=".8"/><path d="M29 81h42v6H29z" fill="#effaf1" opacity=".45"/></svg>',
    };
    const item = CUP_COMPETITIONS[this.competitionIndex] || CUP_COMPETITIONS[0];
    this.competition_trophy.innerHTML = trophies[item.id];
    this.competition_picker_card.style.setProperty('--competition-accent', ({ champions: '#78ddb0', league: '#73a9ed', 'world-cup': '#e7c56c', euro: '#7ab6ef', 'copa-america': '#69d2a0' })[item.id]);
    this.competition_eyebrow.textContent = item.eyebrow;
    this.competition_title.textContent = item.name;
    this.competition_description.textContent = item.description;
    this.competition_dots.replaceChildren(...CUP_COMPETITIONS.map((competition, i) => {
      const dot = document.createElement('i'); dot.className = i === this.competitionIndex ? 'active' : ''; dot.setAttribute('aria-label', competition.name); return dot;
    }));
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
    if (!this.profileComplete() || (required === 'club' && current?.type === 'national') || (required === 'national' && current?.type !== 'national')) {
      this.pendingMode = mode; this.pendingCompetition = competition.id; this.pendingTeamType = required; this.openProfile(); return;
    }
    if (mode === 'league') { this.updateLeaguePreview(); this.show('league'); }
    else this.openTournamentSetup(competition.id);
  }

  openTournamentSetup(competitionId = this.pendingCompetition || this.selectedCompetition || 'champions') {
    const competition = CUP_COMPETITIONS.find(item => item.id === competitionId) || CUP_COMPETITIONS[0];
    const isInternational = competition.type !== 'club';
    const current = getTeamById(this.settings.teamId);
    if (isInternational && current?.type !== 'national' || !isInternational && current?.type === 'national') {
      this.pendingMode = 'tournament'; this.pendingCompetition = competition.id; this.pendingTeamType = isInternational ? 'national' : 'club'; this.openProfile(); return;
    }
    const teams = isInternational ? createInternationalDraw(competition.id, this.settings.teamId) : createChampionsDraw(this.settings.teamId);
    this.tournament = { size: 16, teams, totalRounds: 4, round: 0, status: 'setup', competitionId: competition.id };
    this.renderTournamentSetup(competition);
    this.renderTournamentRoster(); this.show('tournament');
  }

  openProfile() {
    this.selectedTeamId = getTeamById(this.settings.teamId)?.id || '';
    const allowedGroups = this.pendingTeamType === 'club' ? TEAM_LEAGUES : this.pendingTeamType === 'national' ? NATIONAL_GROUPS : TEAM_GROUPS;
    const selectedTeam = getTeamById(this.selectedTeamId);
    if (this.pendingTeamType === 'club' && selectedTeam?.type === 'national' || this.pendingTeamType === 'national' && selectedTeam?.type !== 'national') this.selectedTeamId = '';
    else if (selectedTeam) this.activeLeague = selectedTeam.league;
    if (!allowedGroups.some(group => group.id === this.activeLeague)) this.activeLeague = allowedGroups[0].id;
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
    for (const tab of this.league_tabs.querySelectorAll('[data-league]')) {
      const group = TEAM_GROUPS.find(item => item.id === tab.dataset.league);
      tab.hidden = !!this.pendingTeamType && this.pendingTeamType !== 'all' && (this.pendingTeamType === 'national') !== (group?.type === 'national');
    }
    this.renderTeamCarousel(); this.updateProfilePreview(); this.updateProfileValidity(); this.show('customize');
  }

  renderTeamCarousel() {
    this.league_tabs.querySelectorAll('[data-league]').forEach(tab => {
      const active = tab.dataset.league === this.activeLeague; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active));
    });
    this.team_grid.replaceChildren();
    const leagueTeams = PROFILE_TEAMS.filter(team => team.league === this.activeLeague);
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
    card.setAttribute('aria-label', `${team.name}. ${chosen ? 'Equipo elegido' : 'Elegir este equipo'}`);
    card.setAttribute('aria-pressed', String(chosen)); card.classList.toggle('selected', chosen);
    const strip = document.createElement('span'); strip.className = 'team-card-colors';
    strip.style.background = `linear-gradient(90deg, ${team.primary} 0 50%, ${team.secondary} 50% 100%)`;
    const details = document.createElement('span'); details.className = 'team-card-details';
    const name = document.createElement('span'); name.className = 'team-card-name'; name.textContent = team.name;
    const league = document.createElement('small'); league.textContent = chosen ? 'EQUIPO ELEGIDO ✓' : 'PULSA PARA ELEGIR';
    details.append(name, league); card.append(strip, details); this.team_grid.append(card);
    this.team_position.textContent = `${index + 1} / ${leagueTeams.length}`;
    this.teams_prev.disabled = this.teams_next.disabled = leagueTeams.length < 2;
  }

  moveTeam(direction) {
    const leagueTeams = PROFILE_TEAMS.filter(team => team.league === this.activeLeague);
    const current = this.teamCursor.get(this.activeLeague) || 0;
    this.teamCursor.set(this.activeLeague, (current + direction + leagueTeams.length) % leagueTeams.length);
    this.renderTeamCarousel(); this.sound?.play('click');
  }

  selectTeam(teamId) {
    const chosen = getTeamById(teamId);
    if (!chosen || this.pendingTeamType === 'club' && chosen.type === 'national' || this.pendingTeamType === 'national' && chosen.type !== 'national') return;
    const firstSelection = this.player_name.disabled;
    this.selectedTeamId = teamId; this.activeLeague = getTeamById(teamId).league;
    const index = PROFILE_TEAMS.filter(item => item.league === this.activeLeague).findIndex(item => item.id === teamId);
    if (index >= 0) this.teamCursor.set(this.activeLeague, index);
    this.renderTeamCarousel(); this.updateProfilePreview(); this.updateProfileValidity();
    if (firstSelection) this.player_name.focus();
    this.sound?.play('click');
  }

  updateProfilePreview() {
    const team = getTeamById(this.selectedTeamId), name = this.player_name.value.trim() || 'TU NOMBRE';
    const rawNumber = this.player_number.value, number = rawNumber === '' ? '—' : clamp(Number(rawNumber) || 0, 0, 99);
    this.preview_name.textContent = name.toUpperCase(); this.preview_number.textContent = number;
    this.preview_ball.style.background = team ? `linear-gradient(90deg, ${team.primary} 0 50%, ${team.secondary} 50% 100%)` : '#33413b';
    this.preview_ball.style.boxShadow = team ? `0 8px 28px ${team.primary}55, inset -7px -8px 13px #0003` : 'none';
    this.preview_team.textContent = team ? team.name.toUpperCase() : 'ELIGE UN EQUIPO';
    const league = team && TEAM_GROUPS.find(item => item.id === team.league);
    this.chosen_team_label.textContent = team ? `${team.name} · ${league.label.split(' · ')[0]}` : 'SELECCIONA UN EQUIPO PRIMERO';
    this.player_name.disabled = !team; this.player_number.disabled = !team;
    this.updateProfileValidity(); this.updateHomeClub();
  }

  updateProfileValidity() {
    if (!this.save_player) return;
    const numberText = this.player_number.value, number = Number(numberText);
    const team = getTeamById(this.selectedTeamId);
    let typeMatches = !!team;
    if (this.pendingTeamType === 'national') typeMatches = team?.type === 'national';
    else if (this.pendingTeamType === 'club') typeMatches = team?.type !== 'national';
    const valid = !!team && typeMatches && !!this.player_name.value.trim()
      && numberText !== '' && Number.isInteger(number) && number >= 0 && number <= 99;
    this.save_player.disabled = !valid;
  }

  updateHomeClub() {
    const team = getTeamById(this.settings.teamId);
    this.home_club_name.textContent = team ? `${team.name.toUpperCase()} · ${team.type === 'national' ? 'SELECCIÓN' : 'CLUB'}` : 'SELECCIONA TU EQUIPO AL JUGAR';
    this.home_club_colors.style.background = team
      ? `linear-gradient(90deg, ${team.primary} 0 50%, ${team.secondary} 50% 100%)` : 'transparent';
    this.home_club_colors.classList.toggle('has-team', !!team);
  }

  savePlayer() {
    const team = getTeamById(this.selectedTeamId), name = this.player_name.value.trim();
    const numberText = this.player_number.value, number = Number(numberText);
    if (!team || this.pendingTeamType === 'club' && team.type === 'national' || this.pendingTeamType === 'national' && team.type !== 'national' || !name || numberText === '' || !Number.isInteger(number) || number < 0 || number > 99) return;
    this.settings.teamId = team.id; this.settings.name = name.slice(0, 16); this.settings.number = number; this.settings.profileReady = true;
    delete this.settings.color; this.persist(); this.updateHomeClub();
    const nextMode = this.pendingMode; this.pendingMode = null; this.sound?.play('click');
    const nextCompetition = this.pendingCompetition; this.pendingCompetition = null; this.pendingTeamType = 'all';
    this.league_tabs.querySelectorAll('[data-league]').forEach(tab => { tab.hidden = false; });
    if (nextMode === 'tournament') { this.openTournamentSetup(nextCompetition); return; }
    if (nextMode === 'league') { this.updateLeaguePreview(); this.show('league'); return; }
    if (nextMode) { this.show('home'); this.start(nextMode); }
    else this.saved_note.textContent = 'JUGADOR GUARDADO';
  }

  persist() { saveSettings(this.settings); this.game?.updateSettings(this.settings); this.syncAccount(false); }

  show(view) {
    for (const [key, screen] of Object.entries(this.screens)) screen.classList.toggle('hidden', key !== view);
    this.menuBackdrop?.setActive(view === 'home');
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
  }

  updateDifficultyControls() {
    const hardUnlocked = this.progression.level >= 5;
    if (!hardUnlocked && this.settings.difficulty === 'hard') {
      this.settings.difficulty = 'easy';
      saveSettings(this.settings);
    }
    for (const select of [this.difficulty, this.settings_difficulty]) {
      const hard = [...select.options].find(option => option.value === 'hard');
      if (hard) { hard.disabled = !hardUnlocked; hard.textContent = hardUnlocked ? 'Difícil' : 'Difícil · nivel 5'; }
      select.value = this.settings.difficulty;
    }
  }

  updateLeaguePreview() {
    const id = this.league_competition.value || TEAM_LEAGUES[0].id;
    const competition = TEAM_LEAGUES.find(item => item.id === id) || TEAM_LEAGUES[0];
    const count = TEAMS.filter(team => team.league === competition.id).length;
    this.league_competition_summary.textContent = `${competition.label.split(' · ')[0].toUpperCase()} · ${count} CLUBES · 16 JORNADAS`;
  }

  renderTournamentSetup(competition) {
    const international = competition.type !== 'club';
    const title = competition.id === 'champions' ? 'Camino a<br><em>Champions.</em>'
      : competition.id === 'world-cup' ? 'El sueño<br><em>mundial.</em>'
        : competition.id === 'euro' ? 'Camino a<br><em>la Euro.</em>'
          : 'Rumbo a<br><em>América.</em>';
    this.tournament_header_tag.textContent = competition.eyebrow;
    this.tournament_eyebrow.textContent = competition.eyebrow;
    this.tournament_title.innerHTML = title;
    this.tournament_description.textContent = international
      ? '16 selecciones, eliminatorias directas y cuatro rondas hasta levantar el trofeo.'
      : '16 clubes, eliminatorias directas y cuatro rondas hasta la final.';
    this.tournament_team_count.textContent = international ? '16 SELECCIONES' : '16 CLUBES';
    this.tournament_emblem.innerHTML = this.competition_trophy.innerHTML;
    this.tournament_emblem.style.color = getComputedStyle(this.competition_picker_card).getPropertyValue('--competition-accent').trim() || 'var(--green)';
    document.getElementById('tournament-start').innerHTML = `Empezar ${competition.name} <span>↗</span>`;
  }

  beginTournament() {
    const cupId = this.tournament?.competitionId || this.selectedCompetition || 'champions';
    const competition = CUP_COMPETITIONS.find(item => item.id === cupId) || CUP_COMPETITIONS[0];
    const team = getTeamById(this.settings.teamId);
    if (!this.profileComplete() || (competition.type === 'club' && team?.type === 'national') || (competition.type !== 'club' && team?.type !== 'national')) {
      this.pendingMode = 'tournament'; this.pendingCompetition = cupId; this.pendingTeamType = competition.type === 'club' ? 'club' : 'national'; this.openProfile(); return;
    }
    if (!this.tournament || this.tournament.status !== 'setup') this.openTournamentSetup(cupId);
    this.tournament.round = 0; this.tournament.status = 'playing';
    this.league = null; this.launchTournamentRound();
  }

  renderTournamentRoster() {
    this.tournament_roster.replaceChildren();
    for (const team of this.tournament.teams) {
      const item = document.createElement('div'); item.className = 'roster-team';
      if (team.id === this.settings.teamId) item.classList.add('user-team');
      const colors = document.createElement('span'); colors.className = 'roster-colors';
      colors.style.background = `linear-gradient(90deg, ${team.primary} 0 50%, ${team.secondary} 50% 100%)`;
      const name = document.createElement('span'); name.textContent = team.name;
      const flag = document.createElement('small'); flag.textContent = team.id === this.settings.teamId ? 'TÚ' : (team.type === 'national' ? 'SELECCIÓN' : 'CLUB');
      item.append(colors, name, flag); this.tournament_roster.append(item);
    }
  }

  launchTournamentRound() {
    const cup = this.tournament;
    cup.round++;
    const stage = ROUND_NAMES[cup.round - 1];
    const opponentTeam = pickChampionsOpponent(cup.teams, cup.round);
    const competition = CUP_COMPETITIONS.find(item => item.id === cup.competitionId) || CUP_COMPETITIONS[0];
    this.start('tournament', { opponentName: opponentTeam.name, opponentTeam, label: `${competition.name.toUpperCase()} · ${stage} · ${cup.round}/${cup.totalRounds}`, fieldTheme: competition.fieldTheme, competitionRound: cup.round }, true);
  }

  beginLeague() {
    if (!this.profileComplete() || getTeamById(this.settings.teamId)?.type === 'national') { this.pendingMode = 'league'; this.pendingCompetition = 'league'; this.pendingTeamType = 'club'; this.openProfile(); return; }
    const competitionId = this.league_competition.value;
    const opponents = createLeagueOpponents(competitionId, this.settings.teamId);
    const goalTarget = [2, 3, 5].includes(Number(this.league_goal_target.value)) ? Number(this.league_goal_target.value) : 2;
    this.league = { jornada: 1, wins: 0, losses: 0, points: 0, status: 'playing', competitionId, opponents, goalTarget };
    this.tournament = null; this.launchLeagueRound();
  }

  launchLeagueRound() {
    const round = this.league.jornada, competition = TEAM_LEAGUES.find(item => item.id === this.league.competitionId);
    const opponentTeam = this.league.opponents[round - 1] || null;
    const opponentName = opponentTeam?.name || 'RIVAL FC';
    this.start('league', { opponentName, opponentTeam, label: `LIGA NACIONAL · ${competition.label.split(' · ')[0].toUpperCase()} · JORNADA ${round}/16 · A ${this.league.goalTarget}`, fieldTheme: `league-${competition.id}`, competitionRound: round, goalTarget: this.league.goalTarget }, true);
  }

  start(mode, options = {}, preserveCompetition = false, snapshot = null) {
    if (!this.profileComplete()) { this.pendingMode = mode; this.openProfile(); return; }
    if (!preserveCompetition) { this.tournament = null; this.league = null; }
    this.currentMatchMode = mode; this.currentMatchOptions = options;
    this.countdown_banner.classList.add('hidden'); this.goal_banner.classList.add('hidden');
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden');
    this.show('game'); this.game.start(mode, snapshot?.difficulty || this.settings.difficulty, options);
    if (snapshot) this.game.restoreSnapshot(snapshot);
    this.trajectory_toggle.checked = this.game.trajectory; this.trajectory_enabled.checked = this.game.trajectory;
    this.hud_player_name.textContent = this.settings.name.toUpperCase(); this.player_dot.style.background = getTeamById(this.settings.teamId)?.primary || '#68746e';
    this.opponent_dot.style.background = options.opponentTeam?.primary || '#f19676';
    this.hud_opponent_name.textContent = mode === 'training' ? 'PRÁCTICA' : (options.opponentName || 'BOT');
    this.mode_label.textContent = options.label || (mode === 'training' ? 'MODO ENTRENAMIENTO' : `PARTIDO · ${this.settings.difficulty.toUpperCase()} · A 5 GOLES`);
    this.training_tools.classList.toggle('hidden', mode !== 'training');
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden'); this.goal_banner.classList.add('hidden');
    document.getElementById('pause-button').textContent = 'Ⅱ';
    this.updatePowerCooldown(this.game.player?.powerCooldown || 0); this.saveCurrentCompetition();
  }

  updateScore(player, bot) { this.score.innerHTML = `${player} <small>:</small> ${bot}`; }
  updateTime(time) { this.timer.textContent = time; }
  updatePowerCooldown(seconds) {
    this.shot_power_time.textContent = seconds > 0 ? `${Math.ceil(seconds)}s` : 'LISTO';
    document.getElementById('shot-power-status').classList.toggle('ready', seconds <= 0);
  }

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
    if (!saved) { this.continue_competition.classList.add('hidden'); return; }
    const competition = saved.competition || {};
    if (competition.mode === 'league') {
      const league = competition.league || {};
      this.continue_detail.textContent = league.status === 'next' ? `SIGUIENTE · JORNADA ${Math.min(16, (league.jornada || 1) + 1)}/16` : `LIGA · JORNADA ${league.jornada || 1}/16`;
    } else {
      const cup = competition.tournament || {};
      const stage = ROUND_NAMES[Math.max(0, Math.min(3, (cup.round || 1) - 1))];
      const cupName = CUP_COMPETITIONS.find(item => item.id === cup.competitionId)?.name || 'Champions';
      this.continue_detail.textContent = cup.status === 'next' ? `${cupName.toUpperCase()} · SIGUIENTE RONDA` : `${cupName.toUpperCase()} · ${stage}`;
    }
    this.continue_competition.classList.remove('hidden');
  }

  resumeCompetition() {
    const saved = loadCompetitionSave();
    if (!saved) { this.refreshContinueButton(null); return; }
    this.tournament = saved.competition.mode === 'tournament' ? saved.competition.tournament : null;
    this.league = saved.competition.mode === 'league' ? saved.competition.league : null;
    this.sound?.play('click');
    const finishedRound = saved.game.matchOver && (this.league?.status === 'next' || this.tournament?.status === 'next');
    if (finishedRound) { this.advanceCompetition(); return; }
    this.start(saved.match.mode, saved.match.options || {}, true, saved.game);
  }

  saveAndQuit() {
    this.game?.setPaused(true); this.saveCurrentCompetition(); this.game?.stop();
    this.syncAccount(true);
    this.currentMatchMode = null; this.currentMatchOptions = null;
    this.show('home'); this.goal_banner.classList.add('hidden'); this.countdown_banner.classList.add('hidden');
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.add('hidden'); this.refreshContinueButton();
  }

  showCountdown(value) {
    if (value === null || value === undefined) { this.countdown_banner.classList.add('hidden'); return; }
    this.countdown_banner.textContent = String(value); this.countdown_banner.classList.remove('hidden');
    this.countdown_banner.classList.remove('countdown-tick'); void this.countdown_banner.offsetWidth; this.countdown_banner.classList.add('countdown-tick');
  }
  goal() { this.goal_banner.classList.remove('hidden'); setTimeout(() => this.goal_banner.classList.add('hidden'), 1500); }

  handleMatchEnd(result) {
    const won = result.winner === 'player';
    if (result.mode !== 'training') this.career.recordMatch(won);
    const reward = won ? this.progression.awardWin() : null;
    this.renderProgress();
    const rewardText = !won ? 'Sin XP por esta derrota.' : (reward.gained ? `+${reward.gained} XP por la victoria.` : 'Nivel máximo alcanzado.');
    const levelText = reward?.leveledUp ? ` ¡Has subido al nivel ${reward.level}!` : '';
    this.result_xp.textContent = won ? (reward.gained ? `+${reward.gained} XP` : 'NIVEL MÁXIMO') : '0 XP';
    this.result_level.textContent = `NIVEL ${this.progression.level}`;
    this.result_xp_fill.style.width = `${this.progression.progressRatio() * 100}%`;
    this.result_copy.textContent = `${result.playerScore} – ${result.botScore}. ${rewardText}${levelText}`;
    this.result_next.classList.add('hidden'); this.result_finish.textContent = 'Volver al menú';
    this.result_eyebrow.textContent = 'FINAL DEL PARTIDO'; this.result_title.textContent = won ? 'Victoria' : 'Derrota';

    if (result.mode === 'tournament' && this.tournament) {
      const cup = this.tournament;
      if (!won) { cup.status = 'eliminated'; this.result_eyebrow.textContent = 'TORNEO TERMINADO'; this.result_title.textContent = 'Fin del camino'; this.result_copy.textContent = `El torneo acaba en ${ROUND_NAMES[cup.size === 16 ? cup.round - 1 : cup.round]}. ${rewardText}${levelText}`; }
      else if (cup.round >= cup.totalRounds) {
        cup.status = 'champion';
        const competition = CUP_COMPETITIONS.find(item => item.id === cup.competitionId) || CUP_COMPETITIONS[0];
        this.career.awardTrophy(cup.competitionId, competition.name);
        this.result_eyebrow.textContent = 'CAMPEONES'; this.result_title.textContent = '¡Ganaste la copa!'; this.result_copy.textContent = `Victorias: ${cup.totalRounds}. ${rewardText}${levelText}`;
      }
      else { cup.status = 'next'; this.result_eyebrow.textContent = `RONDA ${cup.round}/${cup.totalRounds} SUPERADA`; this.result_next.textContent = `Jugar ${ROUND_NAMES[cup.size === 16 ? cup.round : cup.round + 1].toLowerCase()} →`; this.result_next.classList.remove('hidden'); this.result_finish.textContent = 'Abandonar torneo'; }
    }

    if (result.mode === 'league' && this.league) {
      const season = this.league;
      if (won) { season.wins++; season.points += 3; } else season.losses++;
      if (season.jornada === 16) {
        season.status = 'complete'; this.result_eyebrow.textContent = 'TEMPORADA COMPLETADA'; this.result_title.textContent = 'Fin de la liga';
        this.career.recordLeagueSeason();
        if (season.points >= 30) {
          const competition = TEAM_LEAGUES.find(item => item.id === season.competitionId) || TEAM_LEAGUES[0];
          this.career.awardTrophy(`league-${season.competitionId}`, `Campeón · ${competition.label.split(' · ')[0]}`);
        }
        this.result_copy.textContent = `16 jornadas · ${season.points} puntos · ${season.wins}V ${season.losses}D. ${rewardText}${levelText}`;
      } else {
        season.status = 'next'; this.result_eyebrow.textContent = `JORNADA ${season.jornada}/16`; this.result_next.textContent = `Jugar jornada ${season.jornada + 1} →`; this.result_next.classList.remove('hidden'); this.result_finish.textContent = 'Abandonar liga';
        this.result_copy.textContent = `${season.points} puntos · ${season.wins} victorias · ${season.losses} derrotas. ${rewardText}${levelText}`;
      }
    }
    this.pause_overlay.classList.add('hidden'); this.result_overlay.classList.remove('hidden');
    this.renderAccount();
    if ((this.league?.status === 'next') || (this.tournament?.status === 'next')) this.saveCurrentCompetition();
    else if (result.mode === 'league' || result.mode === 'tournament') { clearCompetitionSave(); this.refreshContinueButton(null); }
    this.syncAccount(true);
  }

  advanceCompetition() {
    this.sound?.play('click');
    if (this.tournament?.status === 'next') { this.tournament.status = 'playing'; this.launchTournamentRound(); return; }
    if (this.league?.status === 'next') { this.league.status = 'playing'; this.league.jornada++; this.launchLeagueRound(); }
  }

  pause(paused) {
    if (!this.game?.state.running || !this.result_overlay.classList.contains('hidden')) return;
    this.game.setPaused(paused); this.pause_overlay.classList.toggle('hidden', !paused);
    if (paused) this.saveCurrentCompetition();
    document.getElementById('pause-button').textContent = paused ? '▶' : 'Ⅱ';
  }

  quit() {
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
