import {
  apiDocsUrl as apiDocsUrlForBase,
  apiDocsYamlUrl as apiDocsYamlUrlForBase,
} from '@podverse/helpers';

const docsUrl = (apiBaseUrl: string | null, build: (base: string) => string): string | null => {
  if (apiBaseUrl === null || apiBaseUrl === '') {
    return null;
  }
  return build(apiBaseUrl);
};

/** Swagger UI for this API base, or null when the app has no server address. */
export const apiDocsUrl = (apiBaseUrl: string | null): string | null =>
  docsUrl(apiBaseUrl, apiDocsUrlForBase);

/** Raw OpenAPI document URL for this API base, or null when the app has no server address. */
export const apiDocsYamlUrl = (apiBaseUrl: string | null): string | null =>
  docsUrl(apiBaseUrl, apiDocsYamlUrlForBase);
