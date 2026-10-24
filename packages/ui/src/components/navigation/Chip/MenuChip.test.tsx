import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MenuChip } from './MenuChip';

type ViewMode = 'grid' | 'rows';

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'grid', label: 'Grid View' },
  { value: 'rows', label: 'List View' },
];

afterEach(() => {
  cleanup();
});

describe('MenuChip', () => {
  it('uses label as the accessible name of an icon-only chip', () => {
    render(
      <MenuChip
        label="Change Layout View"
        icon={<span>*</span>}
        options={OPTIONS}
        value="grid"
        onSelect={() => {}}
        testId="view"
      />
    );

    const button = screen.getByRole('button', { name: 'Change Layout View' });
    expect(button.getAttribute('data-testid')).toBe('view-button');
  });

  it('names the chip `${label}: ${faceLabel}` when it has a face', () => {
    render(
      <MenuChip
        label="View"
        faceLabel="Grid View"
        options={OPTIONS}
        value="grid"
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'View: Grid View' })).toBeTruthy();
  });

  it('opens a named menu outside the chip wrapper', () => {
    render(
      <MenuChip
        label="Change Layout View"
        icon={<span>*</span>}
        options={OPTIONS}
        value="grid"
        onSelect={() => {}}
        menuLabel="Layout"
      />
    );

    const button = screen.getByRole('button', { name: 'Change Layout View' });
    fireEvent.click(button);

    const menu = screen.getByRole('menu', { name: 'Layout' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.parentElement?.contains(menu)).toBe(false);
    expect(
      screen.getByRole('menuitemradio', { name: 'Grid View' }).getAttribute('aria-checked')
    ).toBe('true');
  });

  it('calls onSelect and closes when another option is chosen', () => {
    const onSelect = vi.fn();
    render(
      <MenuChip
        label="Change Layout View"
        icon={<span>*</span>}
        options={OPTIONS}
        value="grid"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change Layout View' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List View' }));

    expect(onSelect).toHaveBeenCalledWith('rows');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes without onSelect when the current option is chosen', () => {
    const onSelect = vi.fn();
    render(
      <MenuChip
        label="Change Layout View"
        icon={<span>*</span>}
        options={OPTIONS}
        value="grid"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change Layout View' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Grid View' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
