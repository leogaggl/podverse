const withDocsPath = (apiBaseUrl: string | null, path: '/docs' | '/docs.yaml'): string | null => {
  if (apiBaseUrl === null || apiBaseUrl === '') {
    return null;
  }
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
};

/** Swagger UI for this API base, or null when the app has no server address. */
export const apiDocsUrl = (apiBaseUrl: string | null): string | null =>
  withDocsPath(apiBaseUrl, '/docs');

/** Raw OpenAPI document URL for this API base, or null when the app has no server address. */
export const apiDocsYamlUrl = (apiBaseUrl: string | null): string | null =>
  withDocsPath(apiBaseUrl, '/docs.yaml');
