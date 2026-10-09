import { createClient } from '@supabase/supabase-js';

// These browser credentials are intentionally public; RLS controls all profile access.
const defaultProjectUrl = 'https://nughauzrbwwmyumkqjez.supabase.co';
const defaultPublishableKey = 'sb_publishable_awi-cCQxPd465kNBL3n57g_d5hqO0DD';
const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultProjectUrl;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || defaultPublishableKey;
const supabase = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null;

export class AccountService {
  get isConfigured() { return Boolean(supabase); }

  getRealtimeClient() { return this.requireClient(); }

  requireClient() {
    if (!supabase) throw new Error('Falta configurar Supabase en las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
    return supabase;
  }

  async restoreSession() {
    const client = this.requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return toAccountUser(data.session?.user);
  }

  async currentUser() {
    const { data, error } = await this.requireClient().auth.getSession();
    if (error) throw error;
    return toAccountUser(data.session?.user);
  }

  async signIn(email, password) {
    const { data, error } = await this.requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: toAccountUser(data.user) };
  }

  async signUp(email, password, name) {
    const { data, error } = await this.requireClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    return { user: toAccountUser(data.user), session: data.session };
  }

  async signOut() {
    const { error } = await this.requireClient().auth.signOut();
    if (error) throw error;
  }

  async fetchProfile() {
    const client = this.requireClient();
    const user = await this.currentUser();
    if (!user) throw new Error('Inicia sesión para cargar tu progreso.');
    const { data, error } = await client.from('player_profiles')
      .select('profile')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw accountDatabaseError(error);
    return { profile: data?.profile || null, account: { email: user.email } };
  }

  async saveProfile(profile) {
    const client = this.requireClient();
    const user = await this.currentUser();
    if (!user) throw new Error('Inicia sesión para guardar el progreso.');
    const { error } = await client.rpc('save_player_profile', { profile_data: profile });
    if (error) throw accountDatabaseError(error);
  }

  async recordOnlineResult(result = {}) {
    const client = this.requireClient();
    const user = await this.currentUser();
    if (!user) return false;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(result.matchId || ''))) {
      throw new Error('No se pudo identificar esta partida online.');
    }
    const playerScore = Number(result.playerScore), opponentScore = Number(result.opponentScore);
    if (![playerScore, opponentScore].every(score => Number.isInteger(score) && score >= 0 && score <= 5)) {
      throw new Error('El marcador del partido no es válido.');
    }
    const { error } = await client.from('online_match_results').insert({
      match_id: result.matchId,
      user_id: user.id,
      player_name: String(result.playerName || 'JUGADOR').trim().slice(0, 16) || 'JUGADOR',
      opponent_name: String(result.opponentName || 'RIVAL').trim().slice(0, 16) || 'RIVAL',
      player_score: playerScore,
      opponent_score: opponentScore,
    });
    if (error?.code === '23505') return false;
    if (error) throw accountDatabaseError(error);
    return true;
  }

  async listOnlineLeaderboard() {
    const { data, error } = await this.requireClient().from('online_match_results')
      .select('user_id,player_name,player_score,opponent_score,played_at')
      .order('played_at', { ascending: false })
      .limit(5000);
    if (error) throw accountDatabaseError(error);
    const players = new Map();
    for (const result of data || []) {
      const row = players.get(result.user_id) || { playerName: result.player_name, wins: 0, played: 0, goals: 0, conceded: 0 };
      row.played++;
      row.wins += Number(result.player_score > result.opponent_score);
      row.goals += Number(result.player_score) || 0;
      row.conceded += Number(result.opponent_score) || 0;
      players.set(result.user_id, row);
    }
    return [...players.values()].sort((a, b) => b.wins - a.wins
      || (b.wins / b.played) - (a.wins / a.played) || b.goals - a.goals || b.played - a.played)
      .slice(0, 50).map(row => ({ ...row, winRate: Math.round(row.wins / row.played * 100) }));
  }
}

function toAccountUser(user) {
  return user ? { id: user.id, email: user.email || '' } : null;
}

function accountDatabaseError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new Error('Falta instalar la función SQL de FIELD en Supabase. Ejecuta supabase/schema.sql en el SQL Editor.');
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return new Error('Falta crear la tabla de progreso en Supabase. Ejecuta supabase/schema.sql en el SQL Editor.');
  }
  return new Error(error?.message || 'No se pudo sincronizar el progreso con Supabase.');
}
