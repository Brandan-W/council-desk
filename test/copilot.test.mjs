import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CopilotSessionManager } from '../src/main/copilot.js';

test('Copilot adapter normalizes stable assistant JSON events and persists history', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-copilot-'));
  const events = [];
  const manager = new CopilotSessionManager({ dir, emit: (event) => events.push(event) });
  const record = { sessionId: 's1', messages: [] };
  manager.readEvent(JSON.stringify({ type: 'assistant.message', data: { content: 'hello' } }), record, 'copilot:local:s1');
  manager.readEvent(JSON.stringify({ type: 'result', data: { result: 'hello', usage: { input_tokens: 3, output_tokens: 2 } }, exitCode: 0 }), record, 'copilot:local:s1');
  assert.equal(record.messages[0].message.content[0].text, 'hello');
  assert.equal(events[0].type, 'sdk');
  assert.equal(events[1].msg.subtype, 'success');
  assert.deepEqual(record.usage, { requests: 0, inputTokens: 3, outputTokens: 2, costUsd: null });
});

test('Copilot adapter lists provider-qualified local sessions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-copilot-'));
  const file = path.join(dir, 'copilot-sessions.json');
  fs.writeFileSync(file, JSON.stringify([{ sessionId: 's1', cwd: '/tmp/project', messages: [], lastModified: 1 }]));
  const manager = new CopilotSessionManager({ dir, emit: () => {} });
  assert.equal(manager.list()[0].providerId, 'copilot');
  assert.equal(manager.list()[0].accountId, 'local');
});
