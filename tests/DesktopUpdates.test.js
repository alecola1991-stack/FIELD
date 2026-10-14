import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { hash, validateBundle, stageBundle, readCached, checkForUpdate, limitedBody } = require('../desktop/updates.cjs');
function bundle(build = 'a'.repeat(40), builtAt = 200) {
  const data = Buffer.from('<html>new game</html>');
  return { format: 1, minLauncher: 1, build, builtAt, files: [{ path: 'index.html', data: data.toString('base64'), sha256: hash(data) }] };
}
function directory(run) {
  const base = mkdtempSync(join(process.cwd(), 'update-test-'));
  return Promise.resolve().then(() => run(base)).finally(() => rmSync(base, { recursive: true, force: true }));
}
function githubFetch(update, digest = `sha256:${hash(Buffer.from(JSON.stringify(update)))}`) {
  let calls = 0;
  const fetch = async url => {
    calls++;
    if (url.includes('api.github.com')) return new Response(JSON.stringify({ assets: [{ name: 'game-update.json', digest, browser_download_url: 'https://github.com/alecola1991-stack/FIELD/releases/download/windows-latest/game-update.json' }] }));
    return new Response(JSON.stringify(update));
  };
  return { fetch, calls: () => calls };
}

test('a downloaded game becomes available on the next launch without touching profile data', () => directory(base => {
  writeFileSync(join(base, 'profile.json'), 'xp=120');
  const staged = stageBundle(base, bundle());
  const cached = readCached(base);
  assert.equal(cached.build, staged.build);
  assert.equal(readFileSync(join(cached.root, 'index.html'), 'utf8'), '<html>new game</html>');
  assert.equal(readFileSync(join(base, 'profile.json'), 'utf8'), 'xp=120');
}));

test('unsafe paths, duplicate Windows paths, invalid bytes and hashes are rejected', () => {
  for (const name of ['../index.html', '/index.html', 'C:/index.html', 'assets/../../index.html', 'assets\\index.html']) {
    const update = bundle(); update.files[0].path = name; assert.throws(() => validateBundle(update));
  }
  const duplicate = bundle(); duplicate.files.push({ ...duplicate.files[0], path: 'INDEX.HTML' });
  assert.throws(() => validateBundle(duplicate));
  const corrupt = bundle(); corrupt.files[0].sha256 = '0'.repeat(64); assert.throws(() => validateBundle(corrupt));
  const badBase64 = bundle(); badBase64.files[0].data = '!!!'; assert.throws(() => validateBundle(badBase64));
  assert.throws(() => validateBundle({ ...bundle(), minLauncher: 2 }));
});

test('a failed update preserves the last working cached game', () => directory(base => {
  stageBundle(base, bundle());
  const corrupt = bundle('b'.repeat(40), 300); corrupt.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => stageBundle(base, corrupt)); assert.equal(readCached(base).build, 'a'.repeat(40));
  writeFileSync(join(base, 'a'.repeat(40), 'game', 'index.html'), 'corrupted');
  assert.equal(readCached(base), null);
}));

test('GitHub release downloads are verified before staging and reused offline', () => directory(async base => {
  const remote = githubFetch(bundle());
  const updated = await checkForUpdate({ fetch: remote.fetch, current: { build: 'b'.repeat(40), builtAt: 100 }, base });
  assert.equal(updated.build, 'a'.repeat(40)); assert.equal(remote.calls(), 2);
  assert.ok(readCached(base));
  assert.equal(await checkForUpdate({ fetch: remote.fetch, current: updated, base }), null);
}));

test('a digest mismatch or unavailable GitHub release never replaces the saved game', () => directory(async base => {
  stageBundle(base, bundle('b'.repeat(40), 100));
  const remote = githubFetch(bundle(), `sha256:${'0'.repeat(64)}`);
  await assert.rejects(checkForUpdate({ fetch: remote.fetch, current: { build: 'b'.repeat(40), builtAt: 100 }, base }));
  await assert.rejects(checkForUpdate({ fetch: async () => { throw new Error('offline'); }, current: {}, base }));
  assert.equal(readCached(base).build, 'b'.repeat(40));
}));

test('older GitHub builds are ignored rather than downgrading the game', () => directory(async base => {
  const remote = githubFetch(bundle());
  assert.equal(await checkForUpdate({ fetch: remote.fetch, current: { build: 'b'.repeat(40), builtAt: 300 }, base }), null);
  assert.equal(readCached(base), null);
}));

test('network errors and oversized streamed downloads are rejected', async () => {
  await assert.rejects(limitedBody(new Response('error', { status: 500 }), 100));
  await assert.rejects(limitedBody(new Response('123456'), 5));
  await assert.rejects(limitedBody(new Response('x', { headers: { 'content-length': '200' } }), 100));
});
