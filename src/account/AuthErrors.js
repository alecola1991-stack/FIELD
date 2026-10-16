// Spanish, actionable messages for Supabase Auth errors (sign in, sign up, Google).
const GOOGLE_HINT = 'Si creaste la cuenta con Google, pulsa «Continuar con Google».';

export function authErrorMessage(error, context = 'signin') {
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  const text = String(error?.message || error?.error_description || error || '').toLowerCase();
  const has = (...parts) => parts.some(part => code === part || text.includes(part));
  if (has('invalid_credentials', 'invalid login credentials')) return `Correo o contraseña incorrectos. ${GOOGLE_HINT}`;
  if (has('user_already_exists', 'email_exists', 'user already registered', 'already been registered')) return `Ya existe una cuenta con ese correo. Inicia sesión con tu contraseña. ${GOOGLE_HINT}`;
  if (has('email_not_confirmed', 'email not confirmed')) return 'Tienes que confirmar el correo antes de entrar. Revisa tu bandeja de entrada (y el spam).';
  if (has('weak_password', 'password should be', 'password is too weak')) return 'La contraseña es demasiado débil. Usa al menos 8 caracteres, mezclando letras y números.';
  if (has('email_address_invalid', 'invalid email', 'unable to validate email')) return 'Ese correo no es válido. Revísalo e inténtalo de nuevo.';
  if (has('over_email_send_rate_limit', 'over_request_rate_limit', 'rate limit', 'too many requests')) return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  if (has('signup_disabled', 'signups not allowed')) return 'Ahora mismo no se pueden crear cuentas nuevas. Inténtalo más tarde.';
  if (has('provider_disabled', 'provider is not enabled', 'unsupported provider')) return 'El acceso con Google no está disponible ahora mismo. Puedes entrar con correo y contraseña.';
  if (has('access_denied')) return 'Has cancelado el acceso con Google. Puedes intentarlo de nuevo cuando quieras.';
  if (has('bad_oauth_state', 'oauth state', 'flow_state_expired', 'flow_state_not_found')) return 'El acceso con Google ha caducado. Pulsa «Continuar con Google» otra vez.';
  if (has('failed to fetch', 'networkerror', 'network request failed', 'load failed', 'authretryablefetcherror', 'timeout')) return 'No hay conexión con el servidor. Comprueba tu internet e inténtalo de nuevo.';
  const original = String(error?.message || error?.error_description || '').trim();
  if (original && /[áéíóúñ¿¡]|\b(el|la|de|con|para|tu)\b/i.test(original)) return original; // already Spanish
  return context === 'google' ? 'No se pudo entrar con Google. Inténtalo de nuevo o usa correo y contraseña.'
    : context === 'signup' ? 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.'
      : 'No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.';
}

// Errors returned in the URL after the Google redirect (?error=… or #error=…).
export function readAuthRedirectError(location) {
  const params = new URLSearchParams(String(location?.search || '').replace(/^\?/, ''));
  const hash = new URLSearchParams(String(location?.hash || '').replace(/^#/, ''));
  const get = key => params.get(key) || hash.get(key);
  const code = get('error_code') || get('error');
  if (!code) return null;
  return { code, message: authErrorMessage({ code, message: get('error_description') || code }, 'google') };
}

// Address without auth parameters, to clean the bar after reading them.
export function cleanAuthUrl(location) {
  const params = new URLSearchParams(String(location?.search || '').replace(/^\?/, ''));
  for (const key of ['error', 'error_code', 'error_description', 'code', 'state', 'sb']) params.delete(key);
  const search = params.toString();
  const hash = /(?:^|[#&])(error|access_token|error_description)=/.test(String(location?.hash || '')) ? '' : String(location?.hash || '');
  return `${location.pathname}${search ? `?${search}` : ''}${hash}`;
}
