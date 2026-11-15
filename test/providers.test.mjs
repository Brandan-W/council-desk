import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/main/providers.js';
import { providerAvailable, providerList, sessionKey, withProvider } from '../src/shared/providers.js';

test('provider metadata exposes Claude, Codex, and the local Copilot adapter', () => {
  assert.deepEqual(providerList().map(({ id, status }) => ({ id, status })), [
    { id: 'claude', status: 'available' },
    { id: 'codex', status: 'external' },
    { id: 'copilot', status: 'available' },
  ]);
});

test('session identity includes provider and account without changing the opaque session id', () => {
  const record = withProvider({ sessionId: 'same-id', summary: 'A session' }, { providerId: 'copilot', accountId: 'local' });
  assert.equal(record.sessionId, 'same-id');
  assert.equal(record.providerId, 'copilot');
  assert.equal(record.accountId, 'local');
  assert.equal(sessionKey(record), 'copilot:local:same-id');
});

test('agent selection accepts configured providers and rejects external placeholders', () => {
  const providers = providerList();
  assert.equal(providerAvailable(providers, 'claude'), true);
  assert.equal(providerAvailable(providers, 'copilot'), true);
  assert.equal(providerAvailable(providers, 'codex'), false);
});

test('Copilot registry returns the configured runtime adapter', () => {
  const registry = createProviderRegistry({ claude: { name: 'Claude adapter' }, copilot: { name: 'Copilot adapter' } });
  assert.equal(registry.get('claude').name, 'Claude adapter');
  assert.equal(registry.get('copilot').name, 'Copilot adapter');
});
