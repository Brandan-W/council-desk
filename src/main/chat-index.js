import fs from 'node:fs';
import path from 'node:path';

export function createChatIndex(file) {
  let chats = [];
  try { chats = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (!Array.isArray(chats)) chats = [];
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(chats, null, 2));
    fs.renameSync(tmp, file);
  };
  return {
    register({ providerId, accountId = 'default', sessionId, cwd, title, status = 'active' }) {
      if (!sessionId) return;
      const current = chats.find((chat) => chat.providerId === providerId && chat.accountId === accountId && chat.sessionId === sessionId);
      const next = { ...(current || {}), providerId, accountId, sessionId, cwd, title: title || current?.title || '', status, lastModified: Date.now() };
      if (current) Object.assign(current, next);
      else chats.unshift(next);
      save();
    },
    updateStatus({ providerId, accountId = 'default', sessionId, status }) {
      const current = chats.find((chat) => chat.providerId === providerId && chat.accountId === accountId && chat.sessionId === sessionId);
      if (!current) return;
      current.status = status;
      current.lastModified = Date.now();
      save();
    },
    recordEvent({ providerId, accountId = 'default', sessionId, type, busy }) {
      if (!sessionId) return;
      if (type === 'busy') return this.updateStatus({ providerId, accountId, sessionId, status: busy ? 'working' : 'completed' });
      if (type === 'permission') return this.updateStatus({ providerId, accountId, sessionId, status: 'waiting' });
      if (type === 'permission_resolved') return this.updateStatus({ providerId, accountId, sessionId, status: 'working' });
      if (type === 'error') return this.updateStatus({ providerId, accountId, sessionId, status: 'error' });
      if (type === 'closed') return this.updateStatus({ providerId, accountId, sessionId, status: 'completed' });
    },
    list() { return chats.slice(); },
  };
}
