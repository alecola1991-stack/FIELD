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
