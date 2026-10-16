import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage, readAuthRedirectError, cleanAuthUrl } from '../src/account/AuthErrors.js';

test('Supabase auth errors become actionable Spanish messages', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }), /Correo o contraseña incorrectos.*Google/);
  assert.match(authErrorMessage({ message: 'User already registered' }, 'signup'), /Ya existe una cuenta/);
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /Espera un minuto/);
  assert.match(authErrorMessage({ code: 'weak_password', message: 'Password should be at least 6 characters' }), /demasiado débil/);
  assert.match(authErrorMessage(new TypeError('Failed to fetch')), /conexión/);
  assert.equal(authErrorMessage(new Error('Para entrar con Google, abre la versión web del juego.')), 'Para entrar con Google, abre la versión web del juego.');
  assert.match(authErrorMessage({ message: 'Something unexpected' }, 'google'), /No se pudo entrar con Google/);
});

test('errors returned by the Google redirect are read and removed from the address', () => {
  const location = { pathname: '/', search: '?error=access_denied&error_code=access_denied&error_description=The+user+denied', hash: '' };
  assert.match(readAuthRedirectError(location).message, /cancelado/);
  assert.equal(cleanAuthUrl(location), '/');
  assert.match(readAuthRedirectError({ search: '', hash: '#error=server_error&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing' }).message, /caducado/);
  assert.equal(readAuthRedirectError({ search: '?r=1', hash: '' }), null);
  assert.equal(cleanAuthUrl({ pathname: '/', search: '?r=1&error=x', hash: '#error=x' }), '/?r=1');
});
