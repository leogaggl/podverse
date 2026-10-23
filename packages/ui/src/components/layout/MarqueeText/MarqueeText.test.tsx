import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { marqueeScrollDurationMs } from '@podverse/helpers/marquee';

import { MarqueeText } from './MarqueeText';

const VIEWPORT_WIDTH = 100;
const CHARACTER_WIDTH = 10;
const SEAM_WIDTH = 24;
const REST_INSET = '12px';
const REST_INSET_WIDTH = 12;

const SHORT_TITLE = 'Short';
const LONG_TITLE = 'An episode title far too long for the bar';
const OTHER_LONG_TITLE = 'A different title that also overflows the bar by a lot';
/** 90 px of text: fits a 100 px box alone, overflows it once a 12 px inset is counted. */
const NEAR_FIT_TITLE = 'Nine char';

type AnimationStub = {
  cancel: Mock;
  element: HTMLElement;
  finished: Promise<void>;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  pause: Mock;
  play: Mock;
  resolveFinished: () => void;
};

let animations: AnimationStub[] = [];
let prefersReducedMotion = false;
const savedDescriptors = new Map<string, PropertyDescriptor | undefined>();

const textWidth = (text: string): number => text.length * CHARACTER_WIDTH;

/** Copies take their text width, the rest-inset spacer its inline width, and the seam its token. */
const trackChildWidth = (element: Element): number => {
  const text = element.textContent ?? '';
  if (text !== '') {
    return textWidth(text);
  }
  if (element instanceof HTMLElement && element.style.width !== '') {
    return REST_INSET_WIDTH;
  }
  return SEAM_WIDTH;
};

const offsetLeftInTrack = (element: Element): number => {
  let left = 0;
  let sibling = element.previousElementSibling;
  while (sibling !== null) {
    left += trackChildWidth(sibling);
    sibling = sibling.previousElementSibling;
  }
  return left;
};

const stubPrototype = (name: string, descriptor: PropertyDescriptor): void => {
  savedDescriptors.set(name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, ...descriptor });
};

const restorePrototype = (): void => {
  savedDescriptors.forEach((descriptor, name) => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, name);
    } else {
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  });
  savedDescriptors.clear();
};

/** Reports the first observation right away, as the browser does before the next paint. */
class ResizeObserverStub {
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  observe(): void {
    this.callback();
  }

  unobserve(): void {}

  disconnect(): void {}
}

function animateStub(
  this: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): AnimationStub {
  let resolveFinished = (): void => {};
  let rejectFinished = (_reason: unknown): void => {};
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = () => {
      resolve();
    };
    rejectFinished = reject;
  });
  const animation: AnimationStub = {
    cancel: vi.fn(() => {
      rejectFinished(new DOMException('The animation was cancelled.', 'AbortError'));
    }),
    element: this,
    finished,
    keyframes,
    options,
    pause: vi.fn(),
    play: vi.fn(),
    resolveFinished: () => {
      resolveFinished();
    },
  };
  animations.push(animation);
  return animation;
}

/** Leaf spans that show `text` and are not hidden from assistive technology. */
const exposedCopies = (root: Element, text: string): HTMLElement[] =>
  Array.from(root.querySelectorAll('span')).filter(
    (span) =>
      span.children.length === 0 &&
      span.textContent === text &&
      span.closest('[aria-hidden="true"]') === null
  );

const passKeyframes = (distance: number): Keyframe[] => [
  { transform: 'translateX(0)' },
  { transform: `translateX(-${distance}px)` },
];

beforeEach(() => {
  animations = [];
  prefersReducedMotion = false;
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverStub,
    writable: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => {},
      matches: prefersReducedMotion,
      media: query,
      removeEventListener: () => {},
    }),
    writable: true,
  });
  stubPrototype('clientWidth', { get: () => VIEWPORT_WIDTH });
  stubPrototype('getBoundingClientRect', {
    value: function (this: HTMLElement) {
      const inset = this.style.paddingInlineStart ? REST_INSET_WIDTH : 0;
      const width = textWidth(this.textContent ?? '') + inset;
      return { bottom: 0, height: 0, left: 0, right: width, top: 0, width, x: 0, y: 0 };
    },
  });
  stubPrototype('offsetLeft', {
    get(this: HTMLElement) {
      return offsetLeftInTrack(this);
    },
  });
  stubPrototype('animate', { value: animateStub });
});

afterEach(() => {
  cleanup();
  restorePrototype();
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('MarqueeText', () => {
  it('renders a label that fits as one copy and never animates it', () => {
    render(<MarqueeText data-testid="marquee">{SHORT_TITLE}</MarqueeText>);
    const root = screen.getByTestId('marquee');

    expect(root.getAttribute('data-marquee-layout')).toBe('fit');
    expect(exposedCopies(root, SHORT_TITLE)).toHaveLength(1);
    expect(animations).toHaveLength(0);
  });

  it('scrolls an overflowing label after a rest, exposing one copy to assistive technology', () => {
    render(<MarqueeText data-testid="marquee">{LONG_TITLE}</MarqueeText>);
    const root = screen.getByTestId('marquee');
    const distance = textWidth(LONG_TITLE) + SEAM_WIDTH;

    expect(root.getAttribute('data-marquee-layout')).toBe('scroll');
    expect(exposedCopies(root, LONG_TITLE)).toHaveLength(1);
    expect(animations).toHaveLength(1);
    expect(animations[0]?.keyframes).toEqual(passKeyframes(distance));
    expect(animations[0]?.options).toEqual({
      delay: 2500,
      duration: marqueeScrollDurationMs(distance),
      easing: 'linear',
    });
  });

  it('keeps an overflowing label still under reduced motion', () => {
    prefersReducedMotion = true;
    render(<MarqueeText data-testid="marquee">{LONG_TITLE}</MarqueeText>);

    expect(screen.getByTestId('marquee').getAttribute('data-marquee-layout')).toBe('fit');
    expect(animations).toHaveLength(0);
  });

  it('scrolls one label of a group at a time, lowest turn order first, then hands off', async () => {
    render(
      <>
        <MarqueeText data-testid="later" turnGroup="hand-off" turnOrder={1}>
          {LONG_TITLE}
        </MarqueeText>
        <MarqueeText data-testid="earlier" turnGroup="hand-off" turnOrder={0}>
          {OTHER_LONG_TITLE}
        </MarqueeText>
      </>
    );

    expect(animations).toHaveLength(1);
    expect(screen.getByTestId('earlier').contains(animations[0]?.element ?? null)).toBe(true);

    await act(async () => {
      animations[0]?.resolveFinished();
    });

    expect(animations).toHaveLength(2);
    expect(screen.getByTestId('later').contains(animations[1]?.element ?? null)).toBe(true);
  });

  it('starts the next pass of an ungrouped label as soon as one ends', async () => {
    render(<MarqueeText>{LONG_TITLE}</MarqueeText>);
    expect(animations).toHaveLength(1);

    await act(async () => {
      animations[0]?.resolveFinished();
    });

    expect(animations).toHaveLength(2);
    expect(animations[1]?.options.delay).toBe(2500);
  });

  it('cancels the running pass and measures again when the string changes', () => {
    const { rerender } = render(<MarqueeText data-testid="marquee">{LONG_TITLE}</MarqueeText>);
    const firstPass = animations[0];

    rerender(<MarqueeText data-testid="marquee">{OTHER_LONG_TITLE}</MarqueeText>);

    expect(firstPass?.cancel).toHaveBeenCalled();
    expect(animations).toHaveLength(2);
    expect(animations[1]?.keyframes).toEqual(
      passKeyframes(textWidth(OTHER_LONG_TITLE) + SEAM_WIDTH)
    );
    expect(exposedCopies(screen.getByTestId('marquee'), OTHER_LONG_TITLE)).toHaveLength(1);
  });

  it('pauses a running pass while the pointer is over the label', () => {
    render(<MarqueeText data-testid="marquee">{LONG_TITLE}</MarqueeText>);
    const root = screen.getByTestId('marquee');

    fireEvent.pointerEnter(root);
    expect(animations[0]?.pause).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(root);
    expect(animations[0]?.play).toHaveBeenCalledTimes(1);
  });

  it('counts the rest inset toward overflow and leaves it out of the travel distance', () => {
    render(
      <>
        <MarqueeText data-testid="inset" restInset={REST_INSET}>
          {NEAR_FIT_TITLE}
        </MarqueeText>
        <MarqueeText data-testid="no-inset">{NEAR_FIT_TITLE}</MarqueeText>
      </>
    );
    const inset = screen.getByTestId('inset');
    const spacer = inset.firstElementChild?.firstElementChild;

    expect(inset.getAttribute('data-marquee-layout')).toBe('scroll');
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
    expect(spacer?.textContent).toBe('');
    expect(animations).toHaveLength(1);
    expect(animations[0]?.keyframes).toEqual(passKeyframes(textWidth(NEAR_FIT_TITLE) + SEAM_WIDTH));
    expect(screen.getByTestId('no-inset').getAttribute('data-marquee-layout')).toBe('fit');
  });

  it('insets a left-aligned label that fits, and not a centered one', () => {
    render(
      <>
        <MarqueeText data-testid="left" restInset={REST_INSET}>
          {SHORT_TITLE}
        </MarqueeText>
        <MarqueeText align="center" data-testid="center" restInset={REST_INSET}>
          {SHORT_TITLE}
        </MarqueeText>
      </>
    );
    const [leftCopy] = exposedCopies(screen.getByTestId('left'), SHORT_TITLE);
    const [centerCopy] = exposedCopies(screen.getByTestId('center'), SHORT_TITLE);

    expect(screen.getByTestId('left').getAttribute('data-marquee-layout')).toBe('fit');
    expect(leftCopy?.style.paddingInlineStart).toBe(REST_INSET);
    expect(centerCopy?.style.paddingInlineStart).toBeFalsy();
  });

  it('server-renders an overflowing label with the string exposed', () => {
    const html = renderToString(<MarqueeText turnGroup="server">{LONG_TITLE}</MarqueeText>);
    const host = document.createElement('div');
    host.innerHTML = html;
    const root = host.firstElementChild;

    expect(root?.getAttribute('data-marquee-layout')).toBe('measuring');
    expect(root === null ? [] : exposedCopies(root, LONG_TITLE)).toHaveLength(1);
  });
});
