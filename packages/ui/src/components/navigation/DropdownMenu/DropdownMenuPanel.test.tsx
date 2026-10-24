import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RefObject } from 'react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DropdownMenuPanelItem, DropdownMenuPanelProps } from './DropdownMenuPanel';
import { DropdownMenuPanel } from './DropdownMenuPanel';

type AnchorRect = { left: number; right: number; top: number; bottom: number };

const restoreFns: (() => void)[] = [];

afterEach(() => {
  cleanup();
  while (restoreFns.length > 0) {
    restoreFns.pop()?.();
  }
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function renderPanel(overrides: Partial<DropdownMenuPanelProps> = {}) {
  const menuRef = createRef<HTMLUListElement>();
  return render(
    <DropdownMenuPanel
      focusedIndex={0}
      handleMenuKeyDown={() => {}}
      menuItems={[{ label: 'One', onClick: () => {} }]}
      menuRef={menuRef}
      open
      setFocusedIndex={() => {}}
      setOpen={() => {}}
      {...overrides}
    />
  );
}

function createAnchor(rect: AnchorRect): {
  anchor: HTMLButtonElement;
  anchorRef: RefObject<HTMLElement | null>;
} {
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () => ({
    ...rect,
    x: rect.left,
    y: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    toJSON: () => ({}),
  });
  document.body.appendChild(anchor);
  return { anchor, anchorRef: { current: anchor } };
}

function stubMenuLayoutSize(width: number, height: number) {
  const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => height,
  });
  restoreFns.push(() => {
    if (widthDescriptor !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', widthDescriptor);
    }
    if (heightDescriptor !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightDescriptor);
    }
  });
}

describe('DropdownMenuPanel', () => {
  it('renders menu items when open', () => {
    renderPanel();

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('One')).toBeTruthy();
  });

  it('renders a named radio menu when items carry checked', () => {
    const menuItems: DropdownMenuPanelItem[] = [
      { label: 'Recent', onClick: () => {}, checked: true },
      { label: 'Top', onClick: () => {}, checked: false },
    ];
    renderPanel({ menuItems, ariaLabel: 'Sort' });

    expect(screen.getByRole('menu', { name: 'Sort' })).toBeTruthy();
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('aria-checked')).toBe('true');
    expect(rows[1]?.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('keeps plain menuitem rows when no item carries checked', () => {
    renderPanel({
      menuItems: [
        { label: 'One', onClick: () => {} },
        { label: 'Two', onClick: () => {} },
      ],
    });

    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(screen.getAllByRole('menuitem')[0]?.hasAttribute('aria-checked')).toBe(false);
  });

  it('renders the menu inside its container when no anchorRef is passed', () => {
    const { container } = renderPanel();

    expect(container.contains(screen.getByRole('menu'))).toBe(true);
  });

  it('renders the menu in a fixed portal on document.body when anchorRef is passed', () => {
    const { anchorRef } = createAnchor({ left: 100, right: 180, top: 40, bottom: 76 });
    const { container } = renderPanel({ anchorRef });

    const menu = screen.getByRole('menu');
    expect(container.contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.position).toBe('fixed');
  });

  it('lines the anchored menu up with the chosen edge of the anchor', () => {
    stubMenuLayoutSize(160, 120);
    const { anchorRef } = createAnchor({ left: 100, right: 180, top: 40, bottom: 76 });

    const left = renderPanel({ anchorRef, position: 'left' });
    const leftMenu = screen.getByRole('menu');
    expect(leftMenu.style.left).toBe('100px');
    expect(leftMenu.style.top).toBe('80px');
    left.unmount();

    renderPanel({ anchorRef, position: 'right' });
    const rightMenu = screen.getByRole('menu');
    expect(rightMenu.style.left).toBe('20px');
    expect(rightMenu.style.top).toBe('80px');
  });

  it('follows the anchor when a nested element scrolls', async () => {
    stubMenuLayoutSize(160, 120);
    const rect: AnchorRect = { left: 100, right: 180, top: 40, bottom: 76 };
    const { anchorRef } = createAnchor(rect);
    renderPanel({ anchorRef, position: 'left' });

    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('100px');

    rect.left = 200;
    rect.right = 280;
    rect.top = 140;
    rect.bottom = 176;
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(menu.style.left).toBe('200px');
      expect(menu.style.top).toBe('180px');
    });
  });

  it('closes once the anchor is scrolled fully out of sight', () => {
    const recorded: { report: ((entries: { isIntersecting: boolean }[]) => void) | null } = {
      report: null,
    };
    class RecordingIntersectionObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        recorded.report = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', RecordingIntersectionObserver);

    const setOpen = vi.fn();
    const { anchorRef } = createAnchor({ left: 100, right: 180, top: 40, bottom: 76 });
    renderPanel({ anchorRef, setOpen });

    expect(recorded.report).not.toBeNull();
    act(() => {
      recorded.report?.([{ isIntersecting: false }]);
    });

    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
