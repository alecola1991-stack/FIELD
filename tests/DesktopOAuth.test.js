import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { startCallback, isGoogleAuthorizeUrl } = require('../desktop/oauth.cjs');

const ports = [47911, 47912];
test('desktop Google callback: serves only /auth/callback on 127.0.0.1 and hands over the code', async () => {
  const flow = await startCallback({ ports, timeout: 5000 });
  try {
    assert.equal(flow.redirectTo, 'http://127.0.0.1:47911/auth/callback');
    assert.equal((await fetch('http://127.0.0.1:47911/other')).status, 404);
    const page = await fetch(`${flow.redirectTo}?code=abcDEF123-456_789`);
    assert.equal(page.status, 200); assert.match(await page.text(), /Sesión iniciada/);
    assert.deepEqual(await flow.wait(), { code: 'abcDEF123-456_789' });
  } finally { flow.close(); }
});

test('desktop Google callback: errors, busy ports and timeouts', async () => {
  const first = await startCallback({ ports, timeout: 5000 });
  const second = await startCallback({ ports, timeout: 40 });
  try {
    assert.equal(second.redirectTo, 'http://127.0.0.1:47912/auth/callback', 'next free port');
    await fetch(`${first.redirectTo}?error=access_denied&error_description=Cancelado`);
    assert.deepEqual(await first.wait(), { error: 'Cancelado' });
    assert.match((await second.wait()).error, /tiempo/);
    await assert.rejects(startCallback({ ports, timeout: 40 }), /puertos/);
  } finally { first.close(); second.close(); }
});

test('desktop Google callback: only the Supabase Google authorize URL for that callback opens', () => {
  const back = 'http://127.0.0.1:47821/auth/callback';
  const ok = `https://abc.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}&code_challenge=x`;
  assert.equal(isGoogleAuthorizeUrl(ok, back), true);
  assert.equal(isGoogleAuthorizeUrl(ok.replace('abc.supabase.co', 'evil.example'), back), false);
  assert.equal(isGoogleAuthorizeUrl(ok.replace('provider=google', 'provider=github'), back), false);
  assert.equal(isGoogleAuthorizeUrl(ok, 'http://127.0.0.1:47822/auth/callback'), false);
  assert.equal(isGoogleAuthorizeUrl('file:///etc/passwd', back), false);
});
