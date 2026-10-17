const { createRunOncePlugin, withEntitlementsPlist } = require('expo/config-plugins');

const ensureStringArray = (value) => {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
};

const withPodverseAssociatedDomains = (config, props = {}) => {
  const host = typeof props.host === 'string' ? props.host.trim() : '';
  if (host.length === 0) {
    return config;
  }
  const domainEntry = `applinks:${host}`;

  return withEntitlementsPlist(config, (modConfig) => {
    const key = 'com.apple.developer.associated-domains';
    const existing = ensureStringArray(modConfig.modResults[key]);
    const nextValues = existing.includes(domainEntry) ? existing : [...existing, domainEntry];
    modConfig.modResults[key] = nextValues;
    return modConfig;
  });
};

module.exports = createRunOncePlugin(
  withPodverseAssociatedDomains,
  'podverse-associated-domains',
  '1.0.0'
);
