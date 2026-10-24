import { config } from '@api/config/index.js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS } from '@podverse/helpers';
import { getDefaultLocale } from '@podverse/orm';

const BUNDLED_FROM_MODULE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../legal/taste-profile-agreement'
);

export function resolveTasteProfileAgreementContentDir(): string {
  const fromEnv = config.tasteProfileAgreement.contentDir.trim();
  if (fromEnv !== '') {
    return fromEnv;
  }
  if (existsSync(path.join(BUNDLED_FROM_MODULE, 'en-US.md'))) {
    return BUNDLED_FROM_MODULE;
  }
  return path.join(process.cwd(), 'apps', 'api', 'legal', 'taste-profile-agreement');
}

function retentionDaysLabel(): string {
  const raw = config.terms.retentionDays.trim();
  const parsed = Number.parseInt(raw, 10);
  if (raw !== '' && Number.isFinite(parsed) && parsed > 0) {
    return String(parsed);
  }
  return String(DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS);
}

export function interpolateTasteProfileAgreementMarkdown(markdown: string): string {
  return markdown
    .replaceAll('{brand_name}', config.brandName)
    .replaceAll('{retention_days}', retentionDaysLabel());
}

function resolveDefaultLocale(): string {
  try {
    return getDefaultLocale();
  } catch {
    return 'en-US';
  }
}

export function resolveTasteProfileAgreementMarkdownPath(
  requestedLocale: string,
  contentDir = resolveTasteProfileAgreementContentDir()
): string {
  const defaultLocale = resolveDefaultLocale();
  const languagePrefix = requestedLocale.split('-')[0] ?? requestedLocale;
  const candidates = [requestedLocale, languagePrefix, defaultLocale, 'en-US'];
  const seen = new Set<string>();

  for (const locale of candidates) {
    if (seen.has(locale)) {
      continue;
    }
    seen.add(locale);
    const filePath = path.join(contentDir, `${locale}.md`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  throw new Error('Taste Profile agreement file is not available');
}

export function loadTasteProfileAgreementMarkdown(requestedLocale: string): string {
  return interpolateTasteProfileAgreementMarkdown(
    readFileSync(resolveTasteProfileAgreementMarkdownPath(requestedLocale), 'utf8')
  );
}
