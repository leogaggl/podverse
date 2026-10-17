import { config } from '@api/config/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import { interpolateTermsMarkdown, loadTermsMarkdown } from './termsContent.js';

const SAMPLE = ['Hello {brand_name}', 'Write {contact_email}', '{legal_address}'].join('\n');

describe('interpolateTermsMarkdown', () => {
  const originalAddress = config.legal.address;
  const originalEmail = config.terms.contactEmail;

  afterEach(() => {
    config.legal.address = originalAddress;
    config.terms.contactEmail = originalEmail;
  });

  it('replaces a legal address and a contact email', () => {
    config.legal.address = '1 Main Street';
    config.terms.contactEmail = 'legal@example.test';

    const markdown = interpolateTermsMarkdown(SAMPLE);

    expect(markdown).toContain('1 Main Street');
    expect(markdown).toContain('legal@example.test');
    expect(markdown).toContain(`Hello ${config.brandName}`);
    expect(markdown).not.toContain('{legal_address}');
    expect(markdown).not.toContain('{contact_email}');
  });

  it('drops lines that contain an empty legal address or contact email', () => {
    config.legal.address = '   ';
    config.terms.contactEmail = '';

    const markdown = interpolateTermsMarkdown(SAMPLE);

    expect(markdown).toBe(`Hello ${config.brandName}`);
    expect(markdown).not.toContain('{legal_address}');
    expect(markdown).not.toContain('{contact_email}');
  });

  it('serves popularity tracking as optional in every locale', () => {
    const cases = [
      { locale: 'en-US', heading: 'Popularity Tracking', notice: 'an optional feature' },
      { locale: 'es', heading: 'Seguimiento de popularidad', notice: 'una función opcional' },
      { locale: 'fr', heading: 'Suivi de popularité', notice: 'une fonctionnalité optionnelle' },
      {
        locale: 'el-GR',
        heading: 'Παρακολούθηση δημοτικότητας',
        notice: 'μια προαιρετική λειτουργία',
      },
    ];

    for (const item of cases) {
      const markdown = loadTermsMarkdown(item.locale);
      expect(markdown).toContain(item.heading);
      expect(markdown).toContain(item.notice);
      expect(markdown).toContain(config.legal.address.trim());
      expect(markdown).not.toContain('{legal_address}');
    }
  });
});
