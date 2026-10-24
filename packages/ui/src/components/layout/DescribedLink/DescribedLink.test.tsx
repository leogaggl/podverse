import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DescribedLink } from './DescribedLink';

afterEach(() => {
  cleanup();
});

describe('DescribedLink', () => {
  it('names the link with the title and points the description at that link', () => {
    render(
      <DescribedLink
        description="Opens the reference."
        href="https://example.com/docs"
        rel="noopener noreferrer"
        target="_blank"
        title="API Reference"
      />
    );

    const link = screen.getByRole('link', { name: 'API Reference' });
    expect(link.getAttribute('href')).toBe('https://example.com/docs');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');

    const describedBy = link.getAttribute('aria-describedby');
    if (describedBy === null) {
      throw new Error('DescribedLink is missing aria-describedby');
    }
    expect(document.getElementById(describedBy)?.textContent).toBe('Opens the reference.');
  });
});
