import test from 'node:test';
import assert from 'node:assert/strict';
import { startGoogleSignIn } from '../src/account/GoogleSignIn.js';
const location = { protocol: 'https:', origin: 'https://alecola1991-stack.github.io', pathname: '/FIELD/', hash: '#ignored', search: '?ignored' };
function fixture(enabled = true) {
  const calls = [];
  return { calls, client: { auth: { signInWithOAuth: async options => { calls.push(options); return {}; } } }, options: {
    projectUrl: 'https://project.supabase.co', publishableKey: 'public-test-key', location,
    fetcher: async () => ({ ok: true, json: async () => ({ external: { google: enabled } }) }),
  } };
}
test('Google login requests only identity scopes and returns to the game path', async () => {
  const f = fixture(); await startGoogleSignIn(f.client, f.options);
  assert.deepEqual(f.calls, [{ provider: 'google', options: { redirectTo: 'https://alecola1991-stack.github.io/FIELD/', scopes: 'openid email profile' } }]);
});
test('disabled Google provider does not redirect the player into an error page', async () => {
  const f = fixture(false); await assert.rejects(startGoogleSignIn(f.client, f.options), /todavía no está disponible/);
  assert.equal(f.calls.length, 0);
});
test('portable keeps email login rather than starting an unsupported OAuth flow', async () => {
  const f = fixture(); f.options.location = { protocol: 'http:' };
  await assert.rejects(startGoogleSignIn(f.client, f.options), /versión web/); assert.equal(f.calls.length, 0);
});
test('provider failures are returned to the account screen', async () => {
  const f = fixture(); f.client.auth.signInWithOAuth = async () => ({ error: new Error('OAuth unavailable') });
  await assert.rejects(startGoogleSignIn(f.client, f.options), /OAuth unavailable/);
});

test('the public site opened over http moves to https instead of failing', async () => {
  const f = fixture(); let target = null;
  f.options.location = { protocol: 'http:', hostname: 'futarcade.es', host: 'futarcade.es', pathname: '/', search: '', replace: url => { target = url; } };
  assert.equal(await startGoogleSignIn(f.client, f.options), 'redirecting');
  assert.equal(target, 'https://futarcade.es/'); assert.equal(f.calls.length, 0);
  // Local and LAN dev servers keep the explanatory error.
  for (const hostname of ['localhost', '192.168.1.20']) {
    f.options.location = { protocol: 'http:', hostname, host: hostname, pathname: '/', replace: () => { throw new Error('no redirect'); } };
    await assert.rejects(startGoogleSignIn(f.client, f.options), /versión web/);
  }
  f.options.location = { protocol: 'arcade:', hostname: 'game' };
  await assert.rejects(startGoogleSignIn(f.client, f.options), /versión de Windows/);
});
