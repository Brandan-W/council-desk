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
    list() { return chats.slice(); },
  };
}
