import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobileDevice } from '../src/mobileGate.js';

const media = ({ coarse = false, fine = true } = {}) => query => ({ matches: query.includes('any-pointer: fine') ? fine : query.includes('pointer: coarse') ? coarse : false });

test('phones and tablets are detected', () => {
  assert.ok(isMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' }, media()));
  assert.ok(isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile Safari/537.36' }, media()));
  assert.ok(isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X200) Chrome/126 Safari/537.36' }, media()));
  assert.ok(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 }, media()), 'iPadOS');
  assert.ok(isMobileDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, media({ coarse: true, fine: false })), 'touch-only device');
});

test('computers and the desktop app are not blocked', () => {
  assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36' }, media()), false);
  assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 0 }, media()), false);
  assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537.36' }, media({ coarse: true, fine: true })), false, 'touch laptop with mouse');
  assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) FIELD Electron/31' }, media({ coarse: true, fine: false })), false);
});
