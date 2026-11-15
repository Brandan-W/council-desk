// Provider metadata shared by the main process and renderer. Runtime adapters stay
// provider-specific; these values only describe identity and supported capabilities.
export const PROVIDERS = Object.freeze({
  claude: Object.freeze({
    id: 'claude',
    name: 'Claude',
    status: 'available',
    capabilities: Object.freeze(['history', 'permissions', 'rewind', 'models', 'commands']),
  }),
  codex: Object.freeze({
    id: 'codex',
    name: 'Codex',
    status: 'external',
    capabilities: Object.freeze([]),
  }),
  copilot: Object.freeze({
    id: 'copilot',
    name: 'Copilot',
    status: 'available',
    capabilities: Object.freeze(['history', 'resume', 'models']),
  }),
});

export const providerList = () => Object.values(PROVIDERS).map((provider) => ({
  ...provider,
  capabilities: [...provider.capabilities],
}));

export const providerAvailable = (providers, id) =>
  providers.some((provider) => provider.id === id && provider.status === 'available');

export const sessionKey = ({ providerId = 'claude', accountId = 'default', sessionId }) =>
  `${providerId}:${accountId}:${sessionId || 'new'}`;

export function withProvider(record, { providerId = 'claude', accountId = 'default' } = {}) {
  return {
    ...record,
    providerId,
    accountId,
    providerName: PROVIDERS[providerId]?.name || providerId,
    capabilities: [...(PROVIDERS[providerId]?.capabilities || [])],
  };
}
