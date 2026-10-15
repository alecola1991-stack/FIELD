import test from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/ui/UI.js';

function fixture(result, restored = null) {
  const ui = Object.create(UI.prototype);
  Object.assign(ui, {
    accountMode: 'signup', account_email: { value: 'player@example.com', checkValidity: () => true },
    account_password: { value: 'test-password' }, account_name: { value: 'Player' }, account_submit: {},
    accountService: { isConfigured: true, signUp: async () => result, currentUser: async () => restored },
    messages: [], setAccountMessage(message) { this.messages.push(message); },
    async activateAccount(user) { this.activated = user.id; }, show(view) { this.view = view; },
    toggleAccountMode() { this.accountMode = 'login'; },
  });
  return ui;
}
test('signup enters online immediately using the returned authenticated session', async () => {
  const ui = fixture({ user: { id: 'player' }, session: { user: { id: 'player' } } });
  ui.accountService.currentUser = async () => { throw new Error('Session storage should not be needed'); };
  await ui.submitAccount();
  assert.equal(ui.activated, 'player'); assert.equal(ui.view, 'online');
  assert.equal(ui.account_password.value, ''); assert.equal(ui.account_submit.disabled, false);
});
test('signup without a session does not activate an unauthenticated user or promise an email', async () => {
  const ui = fixture({ user: { id: 'unconfirmed' }, session: null });
  await ui.submitAccount();
  assert.equal(ui.activated, undefined); assert.equal(ui.accountMode, 'login');
  assert.match(ui.messages.at(-1), /No se ha podido abrir la sesión/);
  assert.equal(ui.account_submit.disabled, false);
});
test('signup can recover an already persisted authenticated session', async () => {
  const ui = fixture({ session: null }, { id: 'persisted' });
  await ui.submitAccount(); assert.equal(ui.activated, 'persisted');
});
