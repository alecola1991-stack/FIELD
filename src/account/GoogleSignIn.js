// Local and LAN addresses (dev servers) are never forced to https.
const LOCAL_HOST = /^(localhost|\[::1\]|(\d+\.){3}\d+|[^.]+)$/;

export async function startGoogleSignIn(client, { projectUrl, publishableKey, location, fetcher = fetch, bridge = globalThis.fieldDesktop?.googleSignIn }) {
  // A public site opened over http: move to its https address (Google needs it) instead of failing.
  if (location.protocol === 'http:' && location.hostname && !LOCAL_HOST.test(location.hostname) && typeof location.replace === 'function') {
    location.replace(`https://${location.host}${location.pathname || '/'}${location.search || ''}`);
    return 'redirecting';
  }
  const desktop = location.protocol === 'arcade:';
  if (desktop && !bridge?.start) {
    throw new Error('Para entrar con Google descarga la última versión del juego para Windows (1.3.0 o posterior). Mientras tanto, entra con correo y contraseña.');
  }
  if (!desktop && location.protocol !== 'https:') {
    throw new Error('Para entrar con Google, abre la versión web del juego (https://futarcade.es). Aquí puedes usar correo y contraseña.');
  }
  const response = await fetcher(`${projectUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('No se pudo comprobar el acceso con Google. Inténtalo de nuevo.');
  const settings = await response.json();
  if (!settings.external?.google) throw new Error('El acceso con Google todavía no está disponible. Puedes entrar con correo y contraseña.');
  if (desktop) return desktopGoogleSignIn(client, bridge);
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}`, scopes: 'openid email profile' },
  });
  if (error) throw error;
}

// Desktop app (Windows 1.3.0+): Google opens in the system browser and comes back to a local
// address served by the app (see desktop/oauth.cjs); the code is exchanged here (PKCE).
async function desktopGoogleSignIn(client, bridge) {
  const redirectTo = await bridge.start();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo, scopes: 'openid email profile', skipBrowserRedirect: true },
  });
  if (error) { bridge.cancel?.(); throw error; }
  if (!data?.url) { bridge.cancel?.(); throw new Error('No se pudo abrir el acceso con Google.'); }
  const result = await bridge.open(data.url);
  if (!result?.code) throw new Error(result?.error || 'No se completó el acceso con Google.');
  const exchange = await client.auth.exchangeCodeForSession(result.code);
  if (exchange.error) throw exchange.error;
  return { session: exchange.data?.session || null };
}
