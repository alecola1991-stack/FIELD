import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/game/Input.js';

globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, querySelectorAll: () => [] };

test('un toque rápido en disparar no se pierde entre dos frames', () => {
  const input = new Input();
  const classes = new Set();
  const button = {
    dataset: { touchCode: 'Space' },
    closest: selector => selector === '[data-touch-code]' ? button : null,
    setPointerCapture() {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
  };
  input.onPointerDown({ target: button, pointerId: 7, preventDefault() {} });
  input.onPointerEnd({ target: button, pointerId: 7 });

  assert.equal(input.down.has('Space'), false);
  assert.equal(input.consume('Space'), true);
  assert.equal(input.consume('Space'), false);
  assert.equal(classes.has('pressed'), false);
});

test('la cruceta permite mantener una dirección mientras se pulsa disparar', () => {
  const input = new Input();
  input.press('KeyD');
  input.press('Space');
  input.release('Space');

  assert.deepEqual(input.axes(), { x: 1, y: 0 });
  assert.equal(input.consume('Space'), true);
  input.release('KeyD');
  assert.deepEqual(input.axes(), { x: 0, y: 0 });
});
