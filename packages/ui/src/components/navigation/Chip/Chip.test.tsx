import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';

afterEach(() => {
  cleanup();
});

describe('Chip', () => {
  it('sets aria-pressed from pressed and leaves it off when pressed is omitted', () => {
    render(
      <>
        <Chip pressed>Podcasts</Chip>
        <Chip pressed={false}>Episodes</Chip>
        <Chip>Clips</Chip>
      </>
    );

    expect(screen.getByRole('button', { name: 'Podcasts' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByRole('button', { name: 'Episodes' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(screen.getByRole('button', { name: 'Clips' }).hasAttribute('aria-pressed')).toBe(false);
  });

  it('marks a menu trigger with aria-haspopup and aria-expanded', () => {
    render(
      <>
        <Chip menuExpanded={false}>Sort</Chip>
        <Chip menuExpanded>Range</Chip>
        <Chip>Plain</Chip>
      </>
    );

    const closed = screen.getByRole('button', { name: 'Sort' });
    expect(closed.getAttribute('aria-haspopup')).toBe('menu');
    expect(closed.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Range' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    const plain = screen.getByRole('button', { name: 'Plain' });
    expect(plain.hasAttribute('aria-haspopup')).toBe(false);
    expect(plain.hasAttribute('aria-expanded')).toBe(false);
  });

  it('keeps a passed aria-expanded on a chip that is not a menu', () => {
    render(
      <>
        <Chip aria-expanded={false}>Categories</Chip>
        <Chip aria-expanded>Categories open</Chip>
      </>
    );

    expect(screen.getByRole('button', { name: 'Categories' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    expect(
      screen.getByRole('button', { name: 'Categories open' }).getAttribute('aria-expanded')
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'Categories' }).hasAttribute('aria-haspopup')).toBe(
      false
    );
  });

  it('throws when an icon-only chip has no aria-label', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Chip icon={<span>*</span>} />)).toThrow(
      'Chip: icon-only chips require aria-label'
    );

    consoleError.mockRestore();
  });
});
