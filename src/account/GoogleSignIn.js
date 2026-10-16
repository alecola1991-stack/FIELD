// Local and LAN addresses (dev servers) are never forced to https.
const LOCAL_HOST = /^(localhost|\[::1\]|(\d+\.){3}\d+|[^.]+)$/;

export async function startGoogleSignIn(client, { projectUrl, publishableKey, location, fetcher = fetch }) {
  // A public site opened over http: move to its https address (Google needs it) instead of failing.
  if (location.protocol === 'http:' && location.hostname && !LOCAL_HOST.test(location.hostname) && typeof location.replace === 'function') {
    location.replace(`https://${location.host}${location.pathname || '/'}${location.search || ''}`);
    return 'redirecting';
  }
  if (location.protocol !== 'https:') {
    throw new Error(location.protocol === 'arcade:'
      ? 'En la versión de Windows entra con correo y contraseña. El acceso con Google funciona en futarcade.es.'
      : 'Para entrar con Google, abre la versión web del juego (https://futarcade.es). Aquí puedes usar correo y contraseña.');
  }
  const response = await fetcher(`${projectUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('No se pudo comprobar el acceso con Google. Inténtalo de nuevo.');
  const settings = await response.json();
  if (!settings.external?.google) throw new Error('El acceso con Google todavía no está disponible. Puedes entrar con correo y contraseña.');
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}`, scopes: 'openid email profile' },
  });
  if (error) throw error;
}
