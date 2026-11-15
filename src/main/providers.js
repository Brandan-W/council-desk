import { providerList } from '../shared/providers.js';

// Provider registry boundary. Each provider owns its runtime-specific session manager.
export function createProviderRegistry({ claude, copilot }) {
  return {
    list: () => providerList(),
    get(id) {
      if (id === 'claude') return claude;
      if (id === 'copilot' && copilot) return copilot;
      throw new Error(`Unknown provider: ${id}`);
    },
  };
}
