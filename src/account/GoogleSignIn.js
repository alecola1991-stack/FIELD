export async function startGoogleSignIn(client, { projectUrl, publishableKey, location, fetcher = fetch }) {
  if (location.protocol !== 'https:') {
    throw new Error('Para entrar con Google, abre la versión web del juego. En la portable puedes usar correo y contraseña.');
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
