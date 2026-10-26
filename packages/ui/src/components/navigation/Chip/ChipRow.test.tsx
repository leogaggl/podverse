import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getChipRevealOffset } from '@podverse/helpers/chipRowReveal';

import { ChipRow } from './ChipRow';

type MediaKey = 'podcasts' | 'episodes' | 'clips';

const ITEMS: { key: MediaKey; label: string }[] = [
  { key: 'podcasts', label: 'Podcasts' },
  { key: 'episodes', label: 'Episodes' },
  { key: 'clips', label: 'Clips' },
];

const restoreFns: (() => void)[] = [];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  while (restoreFns.length > 0) {
    restoreFns.pop()?.();
  }
});

function rectAt(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    top: 0,
    width,
    height: 36,
    right: left + width,
    bottom: 36,
    toJSON: () => ({}),
  };
}

function isScroller(element: Element): boolean {
  return element.firstElementChild?.getAttribute('data-testid') === 'row-items';
}

/**
 * Scroller `left: 0`, `width: 300`, `clientWidth` 300, `scrollWidth` 900. The Clips chip sits at
 * `left: 400`, past the trailing edge; Podcasts and Episodes are visible.
 */
function stubRowLayout({ hiddenKey }: { hiddenKey?: MediaKey } = {}) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (isScroller(this)) {
      return rectAt(0, 300);
    }
    const testId = this.getAttribute('data-testid');
    if (testId === 'row-clips') {
      return rectAt(400, 80);
    }
    if (testId === 'row-episodes') {
      return rectAt(100, 80);
    }
    return rectAt(0, 80);
  });
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    const hidden =
      hiddenKey !== undefined && this.getAttribute('data-testid') === `row-${hiddenKey}`;
    return { length: hidden ? 0 : 1, item: () => null };
  });
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? 300 : 0;
  });
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? 900 : 0;
  });

  const scrollTo = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo');
  Object.defineProperty(Element.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollTo,
  });
  restoreFns.push(() => {
    if (descriptor !== undefined) {
      Object.defineProperty(Element.prototype, 'scrollTo', descriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, 'scrollTo');
    }
  });
  return { scrollTo };
}

describe('ChipRow', () => {
  it('renders items in order and presses only the selected one', () => {
    render(<ChipRow items={ITEMS} selectedKey="episodes" onSelect={() => {}} testId="row" />);

    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Podcasts', 'Episodes', 'Clips']);
    expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('presses no chip when selectedKey is null', () => {
    render(<ChipRow items={ITEMS} selectedKey={null} onSelect={() => {}} />);

    expect(
      screen.getAllByRole('button').every((chip) => chip.getAttribute('aria-pressed') === 'false')
    ).toBe(true);
  });

  it('calls onSelect with the clicked key, including the selected chip', () => {
    const onSelect = vi.fn();
    render(<ChipRow items={ITEMS} selectedKey="podcasts" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clips' }));
    fireEvent.click(screen.getByRole('button', { name: 'Podcasts' }));

    expect(onSelect.mock.calls).toEqual([['clips'], ['podcasts']]);
  });

  it('names the item group for assistive tech', () => {
    render(
      <ChipRow items={ITEMS} selectedKey="podcasts" onSelect={() => {}} ariaLabel="Media Type" />
    );

    expect(screen.getByRole('group', { name: 'Media Type' })).toBeTruthy();
  });

  it('renders trailing controls after the items, inside the same scroller', () => {
    render(
      <ChipRow
        items={ITEMS}
        selectedKey="podcasts"
        onSelect={() => {}}
        testId="row"
        trailing={<button type="button">Sort</button>}
      />
    );

    const items = screen.getByTestId('row-items');
    const trailing = screen.getByTestId('row-trailing');
    expect(trailing.parentElement).toBe(items.parentElement);
    expect(items.nextElementSibling).toBe(trailing);
    expect(trailing.textContent).toBe('Sort');
  });

  it('renders no trailing wrapper when trailing is undefined', () => {
    render(<ChipRow items={ITEMS} selectedKey="podcasts" onSelect={() => {}} testId="row" />);

    expect(screen.queryByTestId('row-trailing')).toBeNull();
  });

  it('jumps the selected chip into view on mount and leaves an already visible one alone', () => {
    const { scrollTo } = stubRowLayout();
    const { rerender } = render(
      <ChipRow items={ITEMS} selectedKey="clips" onSelect={() => {}} testId="row" />
    );

    const scroller = screen.getByTestId('row-items').parentElement;
    expect(scroller).not.toBeNull();
    const gap =
      scroller === null ? Number.NaN : Number.parseFloat(getComputedStyle(scroller).columnGap);
    const expectedOffset = getChipRevealOffset({
      chipX: 400,
      chipWidth: 80,
      scrollX: 0,
      viewportWidth: 300,
      contentWidth: 900,
      edgeInset: Number.isNaN(gap) ? 0 : gap,
    });
    expect(expectedOffset).not.toBeNull();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: expectedOffset, behavior: 'auto' });

    rerender(<ChipRow items={ITEMS} selectedKey="podcasts" onSelect={() => {}} testId="row" />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('marks a hideDesktop chip and leaves the others unmarked', () => {
    render(
      <ChipRow
        items={[
          { key: 'podcasts', label: 'Podcasts' },
          { key: 'episodes', label: 'Episodes', hideDesktop: true },
        ]}
        selectedKey="podcasts"
        onSelect={() => {}}
        testId="row"
      />
    );

    expect(screen.getByTestId('row-episodes').getAttribute('data-hide-desktop')).toBe('true');
    expect(screen.getByTestId('row-podcasts').hasAttribute('data-hide-desktop')).toBe(false);
  });

  function trackScrollLeft(element: HTMLElement) {
    let value = 0;
    Object.defineProperty(element, 'scrollLeft', {
      configurable: true,
      get: () => value,
      set: (next: number) => {
        value = next;
      },
    });
    return {
      read: () => value,
    };
  }

  function pointer(
    phase: 'pointerDown' | 'pointerMove' | 'pointerUp',
    target: Element,
    clientX: number,
    pointerType: 'mouse' | 'touch'
  ) {
    fireEvent[phase](target, {
      button: 0,
      buttons: phase === 'pointerUp' ? 0 : 1,
      clientX,
      isPrimary: true,
      pointerId: 1,
      pointerType,
    });
  }

  it('scrolls on a mouse drag and does not select the chip under the pointer', () => {
    stubRowLayout();
    const onSelect = vi.fn();
    render(<ChipRow items={ITEMS} selectedKey="podcasts" onSelect={onSelect} testId="row" />);

    const scroller = screen.getByTestId('row-items').parentElement;
    expect(scroller).not.toBeNull();
    if (scroller === null) {
      return;
    }
    const scrollLeft = trackScrollLeft(scroller);
    const podcasts = screen.getByRole('button', { name: 'Podcasts' });

    pointer('pointerDown', podcasts, 80, 'mouse');
    pointer('pointerMove', podcasts, 20, 'mouse');
    pointer('pointerUp', podcasts, 20, 'mouse');
    fireEvent.click(podcasts);

    expect(scrollLeft.read()).toBe(60);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not activate a trailing control when the drag starts on it', () => {
    stubRowLayout();
    const onSort = vi.fn();
    render(
      <ChipRow
        items={ITEMS}
        selectedKey="podcasts"
        onSelect={() => {}}
        testId="row"
        trailing={
          <button type="button" onClick={onSort}>
            Sort
          </button>
        }
      />
    );

    const scroller = screen.getByTestId('row-items').parentElement;
    expect(scroller).not.toBeNull();
    if (scroller === null) {
      return;
    }
    trackScrollLeft(scroller);
    const sort = screen.getByRole('button', { name: 'Sort' });

    pointer('pointerDown', sort, 80, 'mouse');
    pointer('pointerMove', sort, 20, 'mouse');
    pointer('pointerUp', sort, 20, 'mouse');
    fireEvent.click(sort);

    expect(onSort).not.toHaveBeenCalled();
  });

  it('keeps a short mouse movement as a click', () => {
    stubRowLayout();
    const onSelect = vi.fn();
    render(<ChipRow items={ITEMS} selectedKey="podcasts" onSelect={onSelect} testId="row" />);

    const scroller = screen.getByTestId('row-items').parentElement;
    expect(scroller).not.toBeNull();
    if (scroller === null) {
      return;
    }
    const scrollLeft = trackScrollLeft(scroller);
    const clips = screen.getByRole('button', { name: 'Clips' });

    pointer('pointerDown', clips, 80, 'mouse');
    pointer('pointerMove', clips, 82, 'mouse');
    pointer('pointerUp', clips, 82, 'mouse');
    fireEvent.click(clips);

    expect(scrollLeft.read()).toBe(0);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('clips');
  });

  it('leaves touch scrolling to the browser and still selects on tap', () => {
    stubRowLayout();
    const onSelect = vi.fn();
    render(<ChipRow items={ITEMS} selectedKey="podcasts" onSelect={onSelect} testId="row" />);

    const scroller = screen.getByTestId('row-items').parentElement;
    expect(scroller).not.toBeNull();
    if (scroller === null) {
      return;
    }
    const scrollLeft = trackScrollLeft(scroller);
    const clips = screen.getByRole('button', { name: 'Clips' });

    pointer('pointerDown', clips, 80, 'touch');
    pointer('pointerMove', clips, 20, 'touch');
    pointer('pointerUp', clips, 20, 'touch');
    fireEvent.click(clips);

    expect(scrollLeft.read()).toBe(0);
    expect(onSelect).toHaveBeenCalledWith('clips');
  });

  it('does not scroll to a selected chip that has no box', () => {
    const { scrollTo } = stubRowLayout({ hiddenKey: 'clips' });
    render(<ChipRow items={ITEMS} selectedKey="clips" onSelect={() => {}} testId="row" />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('resumes the remembered offset when a row with the same memoryKey mounts again', () => {
    const { scrollTo } = stubRowLayout();
    const setScrollLeft = vi.fn();
    vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(120);
    vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(setScrollLeft);

    const { unmount } = render(
      <ChipRow
        items={ITEMS}
        memoryKey="test-resume"
        onSelect={() => {}}
        selectedKey="podcasts"
        testId="row"
      />
    );
    const scroller = screen.getByTestId('row-items').parentElement;
    expect(scroller).not.toBeNull();
    if (scroller === null) {
      return;
    }
    fireEvent.scroll(scroller);
    unmount();

    setScrollLeft.mockClear();
    scrollTo.mockClear();
    render(
      <ChipRow
        items={ITEMS}
        memoryKey="test-resume"
        onSelect={() => {}}
        selectedKey="podcasts"
        testId="row"
      />
    );

    expect(setScrollLeft).toHaveBeenCalledWith(120);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('gives focus back to the pressed chip when the row mounts again', () => {
    const { unmount } = render(
      <ChipRow items={ITEMS} memoryKey="test-focus" onSelect={() => {}} selectedKey="podcasts" />
    );
    const clips = screen.getByRole('button', { name: 'Clips' });
    clips.focus();
    fireEvent.click(clips);
    unmount();

    render(
      <ChipRow items={ITEMS} memoryKey="test-focus" onSelect={() => {}} selectedKey="clips" />
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clips' }));
  });

  it('keeps hidden trailing controls in place and out of the focus order', () => {
    const { rerender } = render(
      <ChipRow
        items={ITEMS}
        onSelect={() => {}}
        selectedKey="podcasts"
        testId="row"
        trailing={<button type="button">Sort</button>}
        trailingHidden
      />
    );

    const trailing = screen.getByTestId('row-trailing');
    expect(trailing.hasAttribute('inert')).toBe(true);
    expect(trailing.textContent).toBe('Sort');

    rerender(
      <ChipRow
        items={ITEMS}
        onSelect={() => {}}
        selectedKey="podcasts"
        testId="row"
        trailing={<button type="button">Sort</button>}
      />
    );

    expect(screen.getByTestId('row-trailing').hasAttribute('inert')).toBe(false);
  });
});
