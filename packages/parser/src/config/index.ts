// Re-export config types for app-level use
export * from './types.js';

// Proxy so callers read config from the current context.
import { getParserConfig } from '../context.js';

// Create a proxy object that delegates property access to the context's config
export const config = new Proxy({} as ReturnType<typeof getParserConfig>, {
  get(_target, prop) {
    return getParserConfig()[prop as keyof ReturnType<typeof getParserConfig>];
  },
});
