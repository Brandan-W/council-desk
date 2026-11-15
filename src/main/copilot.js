import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { withProvider } from '../shared/providers.js';

const DEFAULT_BIN = '/opt/homebrew/bin/copilot';

function readJson(file, fallback) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value;
  } catch {
    return fallback;
  }
}

export class CopilotSessionManager {
  constructor({ emit, log, dir, bin = process.env.COPILOT_BIN || DEFAULT_BIN, accountId = 'local' }) {
    this.emit = emit;
    this.log = log;
    this.bin = bin;
    this.accountId = accountId;
    this.file = path.join(dir, 'copilot-sessions.json');
    this.sessions = readJson(this.file, []);
    if (!Array.isArray(this.sessions)) this.sessions = [];
    this.live = new Map();
  }

  persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.sessions, null, 2));
    fs.renameSync(tmp, this.file);
  }

  list() {
    return this.sessions.map((session) => withProvider(session, { providerId: 'copilot', accountId: this.accountId }));
  }

  history(sessionId) {
    return this.sessions.find((session) => session.sessionId === sessionId)?.messages || [];
  }

  rename(sessionId, title) {
    const session = this.sessions.find((item) => item.sessionId === sessionId);
    if (!session) throw new Error('Copilot session not found.');
    session.customTitle = String(title || '').trim() || session.customTitle;
    this.persist();
    return true;
  }

  tag() {
    return true;
  }

  isActive(sessionId) {
    return this.live.has(sessionId);
  }

  async remove(sessionId) {
    this.live.get(sessionId)?.kill();
    this.live.delete(sessionId);
    this.sessions = this.sessions.filter((session) => session.sessionId !== sessionId);
    this.persist();
    return true;
  }

  send({ key, sessionId, cwd, text, model, agent }) {
    const id = sessionId || randomUUID();
    const existing = this.sessions.find((session) => session.sessionId === id);
    const record = existing || {
      sessionId: id,
      cwd,
      createdAt: Date.now(),
      lastModified: Date.now(),
      firstPrompt: text,
      summary: text,
      messages: [],
      usage: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: null },
    };
    if (!existing) this.sessions.unshift(record);
    record.cwd = cwd;
    record.lastModified = Date.now();
    record.usage = record.usage || { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: null };
    record.usage.requests += 1;
    record.messages.push({ type: 'user', uuid: randomUUID(), message: { role: 'user', content: text } });
    this.persist();
    this.emit({ key, type: 'session', sessionId: id, cwd, model: model || 'auto', mode: 'default' });
    this.emit({ key, type: 'busy', busy: true });
    const args = [
      '-C', cwd,
      '--prompt', text,
      '--output-format', 'json',
      '--silent',
      '--no-auto-update',
      '--session-id', id,
    ];
    if (model) args.push('--model', model);
    if (agent) args.push('--agent', agent);
    const child = spawn(this.bin, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    this.live.set(id, child);
    let buffer = '';
    const finish = (error = null) => {
      if (this.live.get(id) === child) this.live.delete(id);
      this.emit({ key, type: 'busy', busy: false });
      if (error) this.emit({ key, type: 'error', message: error.message || String(error) });
      this.persist();
    };
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) this.readEvent(line, record, key);
    });
    child.stderr.on('data', (chunk) => this.log?.(`[copilot ${id}] ${chunk.toString().trimEnd()}`));
    child.on('error', finish);
    child.on('close', (code) => {
      if (buffer.trim()) this.readEvent(buffer, record, key);
      finish(code ? new Error(`Copilot exited with code ${code}.`) : null);
    });
  }

  readEvent(line, record, key) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    const data = event.data || event;
    if (event.type === 'assistant.message' && data.content) {
      const message = { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: data.content }] } };
      record.messages.push(message);
      record.lastModified = Date.now();
      this.emit({ key, type: 'sdk', msg: message });
    } else if (event.type === 'result') {
      const usage = data.usage || event.usage || {};
      record.usage = record.usage || { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: null };
      record.usage.inputTokens += Number(usage.input_tokens || usage.inputTokens || 0);
      record.usage.outputTokens += Number(usage.output_tokens || usage.outputTokens || 0);
      if (data.cost_usd != null || event.cost_usd != null) record.usage.costUsd = Number(data.cost_usd ?? event.cost_usd);
      this.emit({ key, type: 'sdk', msg: { type: 'result', subtype: event.exitCode === 0 ? 'success' : 'error', result: data.result || '' } });
    }
  }

  usage() {
    return this.sessions.reduce((total, session) => {
      const usage = session.usage || {};
      return {
        requests: total.requests + Number(usage.requests || 0),
        inputTokens: total.inputTokens + Number(usage.inputTokens || 0),
        outputTokens: total.outputTokens + Number(usage.outputTokens || 0),
        costUsd: total.costUsd == null || usage.costUsd == null ? null : total.costUsd + usage.costUsd,
      };
    }, { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
  }

  interrupt(sessionId) {
    this.live.get(sessionId)?.kill('SIGINT');
  }

  close(sessionId) {
    this.interrupt(sessionId);
  }

  closeAll() {
    for (const child of this.live.values()) child.kill('SIGTERM');
    this.live.clear();
  }
}
