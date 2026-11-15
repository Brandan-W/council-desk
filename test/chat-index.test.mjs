import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createChatIndex } from '../src/main/chat-index.js';

test('Desk chat index registers provider sessions without merging opaque histories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-chat-index-'));
  const index = createChatIndex(path.join(dir, 'desk-chats.json'));
  index.register({ providerId: 'copilot', accountId: 'local', sessionId: 's1', cwd: '/tmp/project', status: 'active' });
  index.register({ providerId: 'codex', accountId: 'school', sessionId: 's2', cwd: '/tmp/project', status: 'active' });
  index.recordEvent({ providerId: 'copilot', accountId: 'local', sessionId: 's1', type: 'busy', busy: true });
  assert.equal(index.list().find((chat) => chat.sessionId === 's1').status, 'working');
  assert.deepEqual(index.list().map(({ providerId, sessionId, cwd }) => ({ providerId, sessionId, cwd })), [
    { providerId: 'codex', sessionId: 's2', cwd: '/tmp/project' },
    { providerId: 'copilot', sessionId: 's1', cwd: '/tmp/project' },
  ]);
});
